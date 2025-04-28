Product Requirements Document (PRD)  
Visual Email‐Banner Builder for E-Commerce

1. Overview  
We’re building a Next.js 14 App-Router application (“EmailBannerBuilder”) that lets logged-in merchants:  
• Upload a product image or brand logo  
• Enter a text description of the required banner  
• Hit “Generate” to get 1 custom landscape banner via OpenAI’s gpt-image-1 model  
• Store generated banners in Supabase Storage & metadata in Supabase Postgres  
• Drag-and-drop these banners into an email template  

Tech Stack  
• Frontend/Backend: Next.js 14 (App Router, React Server Components)  
• Auth/DB/Storage/Edge Functions: Supabase  
• Image Gen: OpenAI Images API (gpt-image-1)  

2. Goals & Success Criteria  
• 1× high-quality, brand-aligned banner per request  
• Secure user auth, isolation of banners by user  
• Simple API surface for image gen (via Supabase Edge Function)  
• Email template editor that can export HTML  

3. High-Level User Flow  
1. User signs up/logs in via Supabase Auth  
2. On “Create Banner” page: upload product image, enter text prompt  
3. Click “Generate” → client invokes Supabase Edge Function → calls OpenAI → stores images → returns URLs  
4. Client reads from “banners” table → displays gallery  
5. User drags banners into email blocks; exports email HTML  

4. Data Model  
Table: banners  
• id (uuid, pk)  
• user_id (uuid, fk→auth.users.id)  
• prompt_details (jsonb)  
• input_image_url (text)  
• generated_urls (text[] )  
• created_at (timestamp with time zone default now())  

Supabase Storage Buckets  
• product-images (public: false) – for user uploads  
• banner-images (public: true) – for generated banners  

5. Step-by-Step Implementation  

**[COMPLETED]** Step 1 Configure Next.js & Supabase  
• npx create-next-app@latest --ts –-experimental-app  
• Install `@supabase/ssr`, `@supabase/supabase-js`  
• .env.local:  
  NEXT_PUBLIC_SUPABASE_URL=...  
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...  
  SUPABASE_SERVICE_ROLE_KEY=...  
  OPENAI_API_KEY=...  

Step 2 Supabase DB Setup [COMPLETED]
• Create project at app.supabase.com  
• Enable “Auth” (email/password)  
• Create buckets: product-images, banner-images  
• Create table “banners” via SQL:  
```sql
create table banners (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  prompt_details jsonb not null,
  input_image_url text not null,
  generated_urls text[] not null,
  created_at timestamptz default now()
);
```

**[COMPLETED]** Step 3 Supabase Edge Function  
Location: supabase/functions/generate_banner/index.ts  

Pseudocode (Reflects Current Implementation):  
```ts
import { serve } from "std/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { user_id, prompt_details, input_image_url } = await req.json();
  // 1. Validate (including env vars)
  if (!user_id || !prompt_details || !input_image_url || !Deno.env.get("OPENAI_API_KEY") || !Deno.env.get("SUPABASE_URL") || !Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Invalid input or server config" }), { status: 400 });
  }
  // 2. Call OpenAI
  const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
  const response = await openai.images.generate({
    model: "gpt-image-1", // Using latest model
    prompt: JSON.stringify(prompt_details),
    n: 1,             // Generating 1 banner
    size: "auto",       // Automatic size selection
    response_format: "b64_json"
  });
  const urls: string[] = [];
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  for (const [i, data] of response.data.entries()) {
    if (!data.b64_json) continue;
    const b64 = data.b64_json;
    const buffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const path = `banner-images/${user_id}/${Date.now()}_${i}.png`;
    // 3. Upload to Supabase Storage
    const { error: uploadError } = await supa.storage.from("banner-images").upload(path, buffer, { contentType: "image/png", upsert: true });
    if (uploadError) { /* Handle error */ return new Response(JSON.stringify({ error: 'Upload failed' }), { status: 500 }); }

    const { data: publicUrlData } = supa.storage.from("banner-images").getPublicUrl(path);
    if (!publicUrlData?.publicUrl) { /* Handle error */ return new Response(JSON.stringify({ error: 'URL fetch failed' }), { status: 500 }); }
    urls.push(publicUrlData.publicUrl);
  }
  // 4. Insert metadata
  const { error: insertError } = await supa
    .from("banners")
    .insert({ user_id, prompt_details, input_image_url, generated_urls: urls });
  if (insertError) { /* Handle error */ return new Response(JSON.stringify({ error: 'DB insert failed' }), { status: 500 }); }

  return Response.json({ urls }, { headers: corsHeaders });
});

**[COMPLETED]** Step 4 Next.js Library & Auth (Full @supabase/ssr Implementation)

*   **Middleware:** Create `middleware.ts` at the root.
    ```ts
    // middleware.ts
    import { createServerClient, type CookieOptions } from '@supabase/ssr'
    import { NextResponse, type NextRequest } from 'next/server'

    export async function middleware(request: NextRequest) {
      let response = NextResponse.next({
        request: {
          headers: request.headers,
        },
      })

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
              request.cookies.set({
                name,
                value,
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value,
                ...options,
              })
            },
            remove(name: string, options: CookieOptions) {
              request.cookies.set({
                name,
                value: '',
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value: '',
                ...options,
              })
            },
          },
        }
      )

      // Refresh session if expired - required for Server Components
      await supabase.auth.getSession()

      return response
    }

    export const config = {
      matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
      ],
    }
    ```

*   **Client-side Hook:** Refactored `src/hooks/useUser.ts` to use `createBrowserClient` from `@supabase/ssr` for managing client-side user sessions.

*   **Auth UI (Optional but recommended):** Install `@supabase/auth-ui-react` and `@supabase/auth-ui-shared` for pre-built login/signup components.

Step 5 UI Components & Pages [COMPLETED]

*Note: Migration complete. The application now fully utilizes `@supabase/ssr` for both server-side session handling (middleware, Server Components) and client-side session management (via the `useUser` hook), adhering to current best practices for Next.js App Router.*

5.1 /app/layout.tsx  
• No longer requires `<SupabaseProvider>` or `<SessionContextProvider>`. Ensure `<html>` and `<body>` tags are present. Add global styles if needed.

5.2 /app/page.tsx  
• Landing page → redirect to /builder if logged in  

5.3 /app/builder/page.tsx  
```tsx
"use client";
import BannerGeneratorForm from "./BannerGeneratorForm";
import BannerGallery from "./BannerGallery";

export default function BuilderPage() {
  return (
    <main>
      <h1>Create Promotional Banners</h1>
      <BannerGeneratorForm />
      <BannerGallery />
    </main>
  );
}
```

5.4 BannerGeneratorForm.tsx  
• File input → onChange: upload to “product-images” bucket → get URL  
• Textarea for custom prompt (preloaded with JSON design object)  
• “Generate” button → calls:
```ts
const { data } = await supabaseClient.functions.invoke("generate_banner", {
  body: { user_id, prompt_details: designJson, input_image_url }
});
```
• Handle loading, errors  

5.5 BannerGallery.tsx  
• Fetch `/api/banners` or use supabase.from("banners").select()  
• Display fetched generated_urls as thumbnails  

5.6 EmailEditor.tsx  
• Simple drag-and-drop area: accept image URLs from gallery  
• Inline styling + export to HTML  

**[COMPLETED]** Step 6 Next.js API Routes (app/api)  
app/api/banners/route.ts  
```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server"; // Use server client
import { cookies } from 'next/headers'; // Import cookies

export async function GET(req: Request) {
  const cookieStore = cookies(); // Get cookie store
  const supabase = createClient(cookieStore); // Pass cookieStore

  // Get user session
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  return NextResponse.json({ banners: data });
}
```

**[COMPLETED]** Step 7 Edge function for creating storage folders for each user

Edge Function Logic: When uploading files (to Bucket 1 or Bucket 2), you must construct the file path to include the user's ID as the first folder.
Example (JavaScript): const filePath = `${user.id}/${Date.now()}_${file.name}`;
Then use this `filePath` in your `supabase.storage.from('your_bucket_name').upload(filePath, file)` call.

*Implementation Note: Updated `supabase/functions/generate_banner/index.ts` (for `banner-images` bucket) and `src/app/builder/BannerGeneratorForm.tsx` (for `product-images` bucket) to use the `user_id/timestamp_filename` path structure for uploads, ensuring user-specific folders.*

Step 8 Edge Cases & Error Handling  
• Auth: redirect unauthorized to /login  
• File uploads: limit to 20 MB, validate file type (.png, .jpg)  
• OpenAI errors: display retry option  
• Supabase storage errors: fallback & notify  
• Empty galleries: show placeholder  
• Rate-limit: disable “Generate” while pending  

6. File Structure  

.
├── .env.local  
├── next.config.ts  
├── package.json  
├── tsconfig.json  
├── supabase  
│   └── functions  
│       └── generate_banner  
│           └── index.ts  
├── src  
│   ├── app  
│   │   ├── layout.tsx  
│   │   ├── page.tsx  
│   │   └── builder  
│   │       ├── page.tsx  
│   │       ├── BannerGeneratorForm.tsx  
│   │       ├── BannerGallery.tsx  
│   │       └── EmailEditor.tsx  
│   ├── api  
│   │   └── banners  
│   │       └── route.ts  
│   ├── hooks  
│   │   └── useUser.ts  
│   ├── lib  
│   │   └── supabaseClient.ts  
│   └── utils  
│       └── designPrompt.json  ← contains the Valentine’s Day JSON  
└── README.md  

7. Sample designPrompt.json  
```json
{
  "design_type": "Valentine's Day sale promotional banners for e-commerce",
  "aesthetics": "Bold, modern, attention-grabbing with a focus on high contrast and strong hierarchy. Uses minimalistic product photography, typographic emphasis, and subtle themed backgrounds (e.g., hearts).",
  "primary_colors": [
    "deep red",
    "white",
    "black",
    "light gray"
  ],
  "additional_details": "Headlines use a bold, condensed sans-serif typeface with all caps, white letters for maximum contrast (e.g., 'SLEEP BETTER THIS VALENTINE’S DAY FOR 50% OFF.'). Subheadlines and supporting text are in smaller, regular sans-serif font (white). Button styles are horizontal, pill-shaped with solid white fill and black bold text, centered on banners. Product images are foregrounded, slightly overlapping, with a prominent '+' symbol between them. Text hierarchy is clear: headline (largest, boldest), followed by subheadline (smaller), then call-to-action (button). Informational icons are simple, monochrome white, with short explanatory text below each. Background is a rich red, sometimes with faint heart icons for the holiday theme."
}
```
When invoking generation, merge with user text:  
```ts
const prompt_details = {
  ...designPrompt,
  user_text: "Happy easter sale, buy stocks before they run out, 70% off on mouth tapes"
};
```

8. Testing & QA  
• Unit test Edge Function with valid/invalid payloads  
• Integration test generation flow (mock OpenAI)  
• E2E test builder page (Cypress/Playwright)  

9. Deployment  
• Deploy Next.js to Vercel  
• Deploy Supabase Edge Function via supabase CLI  
• Set env vars in Vercel & Supabase  

This PRD provides a developer-ready blueprint to implement the entire flow—from user auth, prompt input, image generation, storage, to email assembly—covering all edge cases and integration points.


OpenAI Docs:
Image generation
================

Learn how to generate or edit images.

Overview
--------

The OpenAI API lets you generate and edit images from text prompts, using the GPT Image or DALL·E models.

Currently, image generation is only available through the [Image API](/docs/api-reference/images). We’re actively working on expanding support to the [Responses API](/docs/api-reference/responses).

The [Image API](/docs/api-reference/images) provides three endpoints, each with distinct capabilities:

*   **Generations**: [Generate images](#generate-images) from scratch based on a text prompt
*   **Edits**: [Modify existing images](#edit-images) using a new prompt, either partially or entirely
*   **Variations**: [Generate variations](#image-variations) of an existing image (available with DALL·E 2 only)

You can also [customize the output](#customize-image-output) by specifying the quality, size, format, compression, and whether you would like a transparent background.

### Model comparison

Our latest and most advanced model for image generation is `gpt-image-1`, a natively multimodal language model.

We recommend this model for its high-quality image generation and ability to use world knowledge in image creation. However, you can also use specialized image generation models—DALL·E 2 and DALL·E 3—with the Image API.

|Model|Endpoints|Use case|
|---|---|---|
|DALL·E 2|Image API: Generations, Edits, Variations|Lower cost, concurrent requests, inpainting (image editing with a mask)|
|DALL·E 3|Image API: Generations only|Higher image quality than DALL·E 2, support for larger resolutions|
|GPT Image|Image API: Generations, Edits – Responses API support coming soon|Superior instruction following, text rendering, detailed editing, real-world knowledge|

This guide focuses on GPT Image, but you can also switch to the docs for [DALL·E 2](/docs/guides/image-generation?image-generation-model=dall-e-2) and [DALL·E 3](/docs/guides/image-generation?image-generation-model=dall-e-3).

To ensure this model is used responsibly, you may need to complete the [API Organization Verification](https://help.openai.com/en/articles/10910291-api-organization-verification) from your [developer console](https://platform.openai.com/settings/organization/general) before using `gpt-image-1`.

![a vet with a baby otter](https://cdn.openai.com/API/docs/images/otter.png)

Generate Images
---------------

You can use the [image generation endpoint](/docs/api-reference/images/create) to create images based on text prompts. To learn more about customizing the output (size, quality, format, transparency), refer to the [customize image output](#customize-image-output) section below.

You can set the `n` parameter to generate multiple images at once in a single request (by default, the API returns a single image).

Generate an image

```javascript
import OpenAI from "openai";
import fs from "fs";
const openai = new OpenAI();

const prompt = `
A children's book drawing of a veterinarian using a stethoscope to 
listen to the heartbeat of a baby otter.
`;

const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
});

// Save the image to a file
const image_base64 = result.data[0].b64_json;
const image_bytes = Buffer.from(image_base64, "base64");
fs.writeFileSync("otter.png", image_bytes);
```

```python
from openai import OpenAI
import base64
client = OpenAI()

prompt = """
A children's book drawing of a veterinarian using a stethoscope to 
listen to the heartbeat of a baby otter.
"""

result = client.images.generate(
    model="gpt-image-1",
    prompt=prompt
)

image_base64 = result.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("otter.png", "wb") as f:
    f.write(image_bytes)
```

```bash
curl -X POST "https://api.openai.com/v1/images/generations" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-type: application/json" \
    -d '{
        "model": "gpt-image-1",
        "prompt": "A childrens book drawing of a veterinarian using a stethoscope to listen to the heartbeat of a baby otter."
    }' | jq -r '.data[0].b64_json' | base64 --decode > otter.png
```

Edit Images
-----------

The [image edits](/docs/api-reference/images/createEdit) endpoint lets you:

*   Edit existing images
*   Generate new images using other images as a reference
*   Edit parts of an image by uploading an image and mask indicating which areas should be replaced (a process known as **inpainting**)

### Create a new image using image references

You can use one or more images as a reference to generate a new image.

In this example, we'll use 4 input images to generate a new image of a gift basket containing the items in the reference images.

[![Body Lotion](https://cdn.openai.com/API/docs/images/body-lotion.png)](https://cdn.openai.com/API/docs/images/body-lotion.png)[![Soap](https://cdn.openai.com/API/docs/images/soap.png)](https://cdn.openai.com/API/docs/images/soap.png)[![Incense Kit](https://cdn.openai.com/API/docs/images/incense-kit.png)](https://cdn.openai.com/API/docs/images/incense-kit.png)[![Bath Bomb](https://cdn.openai.com/API/docs/images/bath-bomb.png)](https://cdn.openai.com/API/docs/images/bath-bomb.png)

![Bath Gift Set](https://cdn.openai.com/API/docs/images/bath-set-result.png)

Edit an image

```python
import base64
from openai import OpenAI
client = OpenAI()

prompt = """
Generate a photorealistic image of a gift basket on a white background 
labeled 'Relax & Unwind' with a ribbon and handwriting-like font, 
containing all the items in the reference pictures.
"""

result = client.images.edit(
    model="gpt-image-1",
    image=[
        open("body-lotion.png", "rb"),
        open("bath-bomb.png", "rb"),
        open("incense-kit.png", "rb"),
        open("soap.png", "rb"),
    ],
    prompt=prompt
)

image_base64 = result.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("gift-basket.png", "wb") as f:
    f.write(image_bytes)
```

```javascript
import fs from "fs";
import OpenAI, { toFile } from "openai";

const client = new OpenAI();

const imageFiles = [
    "bath-bomb.png",
    "body-lotion.png",
    "incense-kit.png",
    "soap.png",
];

const images = await Promise.all(
    imageFiles.map(async (file) =>
        await toFile(fs.createReadStream(file), null, {
            type: "image/png",
        })
    ),
);

const rsp = await client.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt: "Create a lovely gift basket with these four items in it",
});

// Save the image to a file
const image_base64 = rsp.data[0].b64_json;
const image_bytes = Buffer.from(image_base64, "base64");
fs.writeFileSync("basket.png", image_bytes);
```

```bash
curl -s -D >(grep -i x-request-id >&2) \
  -o >(jq -r '.data[0].b64_json' | base64 --decode > gift-basket.png) \
  -X POST "https://api.openai.com/v1/images/edits" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=gpt-image-1" \
  -F "image[]=@body-lotion.png" \
  -F "image[]=@bath-bomb.png" \
  -F "image[]=@incense-kit.png" \
  -F "image[]=@soap.png" \
  -F 'prompt=Generate a photorealistic image of a gift basket on a white background labeled "Relax & Unwind" with a ribbon and handwriting-like font, containing all the items in the reference pictures'
```

### Edit an image using a mask (inpainting)

You can provide a mask to indicate where the image should be edited. The transparent areas of the mask will be replaced, while the filled areas will be left unchanged.

You can use the prompt to describe what you want the final edited image to be or what you want to edit specifically. If you provide multiple input images, the mask will be applied to the first image.

Edit an image

```python
from openai import OpenAI
client = OpenAI()

result = client.images.edit(
    model="gpt-image-1",
    image=open("sunlit_lounge.png", "rb"),
    mask=open("mask.png", "rb"),
    prompt="A sunlit indoor lounge area with a pool containing a flamingo"
)

image_base64 = result.data[0].b64_json
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("composition.png", "wb") as f:
    f.write(image_bytes)
```

```javascript
import fs from "fs";
import OpenAI, { toFile } from "openai";

const client = new OpenAI();

const rsp = await client.images.edit({
    model: "gpt-image-1",
    image: await toFile(fs.createReadStream("sunlit_lounge.png"), null, {
        type: "image/png",
    }),
    mask: await toFile(fs.createReadStream("mask.png"), null, {
        type: "image/png",
    }),
    prompt: "A sunlit indoor lounge area with a pool containing a flamingo",
});

// Save the image to a file
const image_base64 = rsp.data[0].b64_json;
const image_bytes = Buffer.from(image_base64, "base64");
fs.writeFileSync("lounge.png", image_bytes);
```

```bash
curl -s -D >(grep -i x-request-id >&2) \
  -o >(jq -r '.data[0].b64_json' | base64 --decode > lounge.png) \
  -X POST "https://api.openai.com/v1/images/edits" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F "model=gpt-image-1" \
  -F "mask=@mask.png" \   
  -F "image[]=@sunlit_lounge.png" \
  -F 'prompt=A sunlit indoor lounge area with a pool containing a flamingo'
```

|Image|Mask|Output|
|---|---|---|
||||

Prompt: a sunlit indoor lounge area with a pool containing a flamingo

#### Mask requirements

The image to edit and mask must be of the same format and size (less than 25MB in size).

The mask image must also contain an alpha channel. If you're using an image editing tool to create the mask, make sure to save the mask with an alpha channel.

Add an alpha channel to a black and white mask

You can modify a black and white image programmatically to add an alpha channel.

Add an alpha channel to a black and white mask

```python
from PIL import Image
from io import BytesIO

# 1. Load your black & white mask as a grayscale image
mask = Image.open(img_path_mask).convert("L")

# 2. Convert it to RGBA so it has space for an alpha channel
mask_rgba = mask.convert("RGBA")

# 3. Then use the mask itself to fill that alpha channel
mask_rgba.putalpha(mask)

# 4. Convert the mask into bytes
buf = BytesIO()
mask_rgba.save(buf, format="PNG")
mask_bytes = buf.getvalue()

# 5. Save the resulting file
img_path_mask_alpha = "mask_alpha.png"
with open(img_path_mask_alpha, "wb") as f:
    f.write(mask_bytes)
```

Customize Image Output
----------------------

You can configure the following output options:

*   **Size**: Image dimensions (e.g., `1024x1024`, `1024x1536`)
*   **Quality**: Rendering quality (e.g. `low`, `medium`, `high`)
*   **Format**: File output format
*   **Compression**: Compression level (0-100%) for JPEG and WebP formats
*   **Background**: Transparent or opaque

`size`, `quality`, and `background` support the `auto` option, where the model will automatically select the best option based on the prompt.

### Size and quality options

Square images with standard quality are the fastest to generate. The default size is 1024x1024 pixels.

|Available sizes|1024x1024 (square)1536x1024 (landscape)1024x1536 (portrait)auto (default)|
|Quality options|lowmediumhighauto (default)|

### Output format

The Image API returns base64-encoded image data. The default format is `png`, but you can also request `jpeg` or `webp`.

If using `jpeg` or `webp`, you can also specify the `output_compression` parameter to control the compression level (0-100%). For example, `output_compression=50` will compress the image by 50%.

### Transparency

The `gpt-image-1` model supports transparent backgrounds. To enable transparency, set the `background` parameter to `transparent`.

It is only supported with the `png` and `webp` output formats.

Transparency works best when setting the quality to `medium` or `high`.

Generate an image with a transparent background

```javascript
import OpenAI from "openai";
import fs from "fs";
const openai = new OpenAI();

const result = await openai.images.generate({
    model: "gpt-image-1",
    prompt: "Draw a 2D pixel art style sprite sheet of a tabby gray cat",
    size: "1024x1024",
    background: "transparent",
    quality: "high",
});

// Save the image to a file
const image_base64 = result.data[0].b64_json;
const image_bytes = Buffer.from(image_base64, "base64");
fs.writeFileSync("sprite.png", image_bytes);
```

```python
from openai import OpenAI
import base64
client = OpenAI()

result = client.images.generate(
    model="gpt-image-1",
    prompt="Draw a 2D pixel art style sprite sheet of a tabby gray cat",
    size="1024x1024",
    background="transparent",
    quality="high",
)

image_base64 = result.json()["data"][0]["b64_json"]
image_bytes = base64.b64decode(image_base64)

# Save the image to a file
with open("sprite.png", "wb") as f:
    f.write(image_bytes)
```

```bash
curl -X POST "https://api.openai.com/v1/images" \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "Content-type: application/json" \
    -d '{
        "prompt": "Draw a 2D pixel art style sprite sheet of a tabby gray cat",
        "quality": "high",
        "size": "1024x1024",
        "background": "transparent"
    }' | jq -r 'data[0].b64_json' | base64 --decode > sprite.png
```

Limitations
-----------

The GPT-4o Image model is a powerful and versatile image generation model, but it still has some limitations to be aware of:

*   **Latency:** Complex prompts may take up to 2 minutes to process.
*   **Text Rendering:** Although significantly improved over the DALL·E series, the model can still struggle with precise text placement and clarity.
*   **Consistency:** While capable of producing consistent imagery, the model may occasionally struggle to maintain visual consistency for recurring characters or brand elements across multiple generations.
*   **Composition Control:** Despite improved instruction following, the model may have difficulty placing elements precisely in structured or layout-sensitive compositions.

### Content Moderation

All prompts and generated images are filtered in accordance with our [content policy](https://labs.openai.com/policies/content-policy).

For image generation using `gpt-image-1`, you can control moderation strictness with the `moderation` parameter. This parameter supports two values:

*   `auto` (default): Standard filtering that seeks to limit creating certain categories of potentially age-inappropriate content.
*   `low`: Less restrictive filtering.

Cost and latency
----------------

This model generates images by first producing specialized image tokens. Both latency and eventual cost are proportional to the number of tokens required to render an image—larger image sizes and higher quality settings result in more tokens.

The number of tokens generated depends on image dimensions and quality:

|Quality|Square (1024×1024)|Portrait (1024×1536)|Landscape (1536×1024)|
|---|---|---|---|
|Low|272 tokens|408 tokens|400 tokens|
|Medium|1056 tokens|1584 tokens|1568 tokens|
|High|4160 tokens|6240 tokens|6208 tokens|

Note that you will also need to account for [input tokens](/docs/guides/images-vision#gpt-image-1): text tokens for the prompt and image tokens for the input images if editing images.

So the final cost is the sum of:

*   input text tokens
*   input image tokens if using the edits endpoint
*   image output tokens

Refer to our [pricing page](/pricing#image-generation) for more information about price per text and image tokens.

Was this page useful?