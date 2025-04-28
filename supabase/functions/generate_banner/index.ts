import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.29.1";
import { corsHeaders } from '../_shared/cors.ts';

console.log("generate_banner function started (v2 - using edits)");

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, prompt_details, input_image_url } = await req.json();
    console.log("Received request:", { user_id, prompt_details, input_image_url });

    // 1. Validate input
    if (!user_id || !prompt_details || !input_image_url) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 2. Validate Server Config
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

    // 3. Fetch the input image (logo) from the provided URL
    console.log("Fetching input image from URL:", input_image_url);
    const imageResponse = await fetch(input_image_url);

    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch input image: ${imageResponse.statusText}`);
    }
    const imageData = await imageResponse.blob();
    console.log("Input image fetched, blob type:", imageData.type); // Log the detected blob type

    // Create a File object with explicit type
    const imageFile = new File([imageData], "input_image.png", { type: "image/png" });

    // 4. Call OpenAI Image Edit API
    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Construct a more descriptive prompt for the edit endpoint
    const editPrompt = `Create a promotional banner based on the following user request: ${JSON.stringify(prompt_details)}. Use the provided image as a primary reference for style, colors, branding elements (like logos if present), and overall theme. Ensure the generated banner is landscape format (e.g., 1024x576 or similar) and incorporates the essence of the reference image.`;
    console.log("Calling OpenAI Images Edit API with prompt:", editPrompt);

    // Perform multipart upload directly
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("prompt", editPrompt);
    formData.append("n", "1");
    formData.append("size", "1024x1024");
    formData.append("image", imageFile, "input_image.png");

    const editRes = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openaiApiKey}` },
      body: formData,
    });
    if (!editRes.ok) {
      const errJson = await editRes.json();
      throw new Error(`OpenAI edit error: ${errJson.error.message}`);
    }
    const imageEditResponse = await editRes.json();
    console.log("OpenAI edit response received.");

    // 5. Process OpenAI Response and Upload Generated Banner
    const generatedUrls: string[] = [];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    for (const [i, data] of imageEditResponse.data.entries()) {
      if (!data.b64_json) {
        console.warn(`No b64_json data found for generated image index ${i}`);
        continue;
      }
      const b64 = data.b64_json;
      const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      // Save the *generated* banner to the 'banner-images' bucket
      const generatedPath = `${user_id}/generated_${Date.now()}_${i}.png`;

      console.log(`Uploading generated banner to: ${generatedPath}`);
      const { error: uploadError } = await supabase.storage
        .from("banner-images")
        .upload(generatedPath, buffer, { contentType: "image/png", upsert: true });

      if (uploadError) {
        console.error("Supabase storage upload error (generated banner):", uploadError);
        // Consider whether to return error or just log and skip this image
         return new Response(JSON.stringify({ error: `Failed to upload generated image: ${uploadError.message}` }), {
             headers: { ...corsHeaders, "Content-Type": "application/json" },
             status: 500,
         });
      }
      console.log("Generated banner uploaded successfully");

      // Get public URL for the *generated* banner
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

    // 6. Insert metadata into 'banners' table
    // Note: We store the original prompt_details and input_image_url (logo)
    // along with the URLs of the banners generated *from* them.
    console.log("Inserting banner metadata into DB...");
    const { error: insertError } = await supabase.from("banners").insert({
        user_id,
        prompt_details, // The original user prompt details
        input_image_url, // The URL of the user's uploaded logo/image
        generated_urls: generatedUrls // The URLs of the banners generated using the logo
    });

    if (insertError) {
      console.error("Supabase DB insert error:", insertError);
      return new Response(JSON.stringify({ error: `Failed to save banner metadata: ${insertError.message}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    console.log("Banner metadata inserted successfully");

    // 7. Return generated banner URLs
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

console.log("generate_banner function deployed and listening (v2 - using edits)");
