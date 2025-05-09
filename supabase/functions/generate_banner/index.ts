import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.29.1"; 
import { corsHeaders } from '../_shared/cors.ts';

console.log("generate_banner function started (v3 - trying edits with size)");

type AspectRatio = 'square' | 'landscape' | 'portrait';
const sizeMap: Record<AspectRatio, string> = {
    square: '1024x1024',
    landscape: '1792x1024',
    portrait: '1024x1792',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, prompt_details, input_image_url, aspect_ratio = 'square' }: {
        user_id: string;
        prompt_details: Record<string, any>; 
        input_image_url: string;
        aspect_ratio?: AspectRatio; 
    } = await req.json();

    console.log("Received request:", { user_id, prompt_details, input_image_url, aspect_ratio });

    if (!user_id || !prompt_details || !input_image_url) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!sizeMap[aspect_ratio]) {
       console.error("Invalid aspect_ratio value:", aspect_ratio);
       return new Response(JSON.stringify({ error: "Invalid aspect ratio provided" }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
         status: 400,
       });
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!openaiApiKey || !supabaseUrl || !supabaseServiceKey) {
        console.error("Server configuration error: Missing API keys or URL");
        return new Response(JSON.stringify({ error: "Server configuration error" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }

    console.log("Fetching input image from URL:", input_image_url);
    const imageResponse = await fetch(input_image_url);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch input image: ${imageResponse.statusText}`);
    }
    const imageData = await imageResponse.blob();
    console.log("Input image fetched, blob type:", imageData.type); 

    const imageFile = new File([imageData], "input_image.png", { type: "image/png" });

    const targetFormatDesc = aspect_ratio === 'square' ? 'square format' :
                             aspect_ratio === 'landscape' ? 'landscape format (e.g., 16:9 aspect ratio)' :
                             'portrait format (e.g., 9:16 aspect ratio)';

    const editPrompt = `Create a promotional banner based on the following user request: ${JSON.stringify(prompt_details)}. Use the provided image as a primary reference for style, colors, branding elements (like logos if present), and overall theme. Ensure the generated banner is in ${targetFormatDesc} and incorporates the essence of the reference image.`;
    console.log("Calling OpenAI Images Edit API with prompt:", editPrompt);
    console.log("Target size for API call:", sizeMap[aspect_ratio]);

    const formData = new FormData();
    formData.append("model", "gpt-image-1"); 
    formData.append("prompt", editPrompt);
    formData.append("n", "1");
    formData.append("size", sizeMap[aspect_ratio]); 
    formData.append("image", imageFile, "input_image.png"); 

    const editRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiApiKey}` }, 
      body: formData,
    });

    if (!editRes.ok) {
        console.error("OpenAI API Error Status:", editRes.status, editRes.statusText);
        let errorBodyText = `OpenAI API returned status ${editRes.status}`;
        try {
            const errJson = await editRes.json();
            console.error("OpenAI API Error Body:", errJson);
            errorBodyText = errJson.error?.message || JSON.stringify(errJson);
        } catch (parseError) {
            console.error("Could not parse OpenAI error response as JSON:", parseError);
            try {
                const textResponse = await editRes.text();
                console.error("OpenAI API Error Body (Text):", textResponse);
                errorBodyText = textResponse || errorBodyText;
            } catch (textError) {
                 console.error("Could not read OpenAI error response as text:", textError);
            }
        }
        throw new Error(`OpenAI edit error: ${errorBodyText}`);
    }

    const imageEditResponse = await editRes.json();
    console.log("OpenAI edit response received successfully.");

    const generatedUrls: string[] = [];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    for (const [i, data] of imageEditResponse.data.entries()) {
      if (!data.b64_json) {
        console.warn(`No b64_json data found for generated image index ${i}`);
        continue;
      }
      const b64 = data.b64_json;
      const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const generatedPath = `${user_id}/generated_${Date.now()}_${i}_${aspect_ratio}.png`; 

      console.log(`Uploading generated banner to: ${generatedPath}`);
      const { error: uploadError } = await supabase.storage
        .from("banner-images")
        .upload(generatedPath, buffer, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.error("Supabase storage upload error (generated banner):", uploadError);
         return new Response(JSON.stringify({ error: `Failed to upload generated image: ${uploadError.message}` }), {
             headers: { ...corsHeaders, "Content-Type": "application/json" },
             status: 500,
         });
      }
      console.log("Generated banner uploaded successfully");

      const { data: publicUrlData } = supabase.storage.from("banner-images").getPublicUrl(generatedPath);

       if (!publicUrlData || !publicUrlData.publicUrl) {
         console.error("Failed to get public URL for generated banner:", generatedPath);
         return new Response(JSON.stringify({ error: "Failed to get public URL for generated image" }), {
             headers: { ...corsHeaders, "Content-Type": "application/json" },
             status: 500,
         });
       }
      generatedUrls.push(publicUrlData.publicUrl);
      console.log(`Generated banner public URL: ${publicUrlData.publicUrl}`);
    }

    if (generatedUrls.length === 0) {
       console.error("No banners were successfully generated or uploaded.");
       return new Response(JSON.stringify({ error: "Banner generation failed to produce results." }), {
           headers: { ...corsHeaders, "Content-Type": "application/json" },
           status: 500,
       });
    }

    console.log("Inserting banner metadata into DB...");
    const { error: insertError } = await supabase.from("banners").insert({
        user_id,
        prompt_details, 
        input_image_url, 
        generated_urls: generatedUrls, 
        // aspect_ratio: aspect_ratio 
    });

    if (insertError) {
      console.error("Supabase DB insert error:", insertError);
      return new Response(JSON.stringify({ error: `Failed to save banner metadata: ${insertError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    console.log("Banner metadata inserted successfully");

    return new Response(JSON.stringify({ urls: generatedUrls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Unhandled error in generate_banner function:", error);
    return new Response(JSON.stringify({ error: error.message || "An unexpected error occurred" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

console.log("generate_banner function deployed and listening (v3 - trying edits with size)");
