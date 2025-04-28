// src/types/Banner.ts

export interface Banner {
  id: string;
  user_id: string;
  prompt_details: any; // Consider defining a more specific type if possible
  input_image_url: string;
  generated_urls: string[];
  created_at: string;
}
