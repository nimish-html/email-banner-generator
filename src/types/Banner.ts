// src/types/Banner.ts

export interface Banner {
  id: string;
  user_id: string;
  prompt_details: Record<string, unknown>; // More specific type than 'any'
  input_image_url: string;
  generated_urls: string[];
  created_at: string;
}
