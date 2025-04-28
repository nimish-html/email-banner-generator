"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client'; // Use client component helper
import type { User } from '@supabase/supabase-js';
// FileObject import removed as it's not used

interface BannerGeneratorFormProps {
  user: User;
  onGenerationComplete: () => void; // Add the callback prop
}

// Updated default prompt details from PRD
const defaultPromptDetails = {
  "design_type": "Valentine's Day sale promotional banners for e-commerce",
  "aesthetics": "Bold, modern, attention-grabbing with a focus on high contrast and strong hierarchy. Uses minimalistic product photography, typographic emphasis, and subtle themed backgrounds (e.g., hearts).",
  "primary_colors": [
    "deep red",
    "white",
    "black",
    "light gray"
  ],
  "additional_details": "Headlines use a bold, condensed sans-serif typeface with all caps, white letters for maximum contrast (e.g., 'SLEEP BETTER THIS VALENTINE’S DAY FOR 50% OFF.'). Subheadlines and supporting text are in smaller, regular sans-serif font (white). Button styles are horizontal, pill-shaped with solid white fill and black bold text, centered on banners. Product images are foregrounded, slightly overlapping, with a prominent '+' symbol between them. Text hierarchy is clear: headline (largest, boldest), followed by subheadline (smaller), then call-to-action (button). Informational icons are simple, monochrome white, with short explanatory text below each. Background is a rich red, sometimes with faint heart icons for the holiday theme."
};

// Interface for previously uploaded images
interface PreviousUpload {
  name: string;
  url: string;
}

export default function BannerGeneratorForm({ user, onGenerationComplete }: BannerGeneratorFormProps) {
  const supabase = createClient();
  const [promptDetails, setPromptDetails] = useState(JSON.stringify(defaultPromptDetails, null, 2));
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // State for previous uploads
  const [previousUploads, setPreviousUploads] = useState<PreviousUpload[]>([]);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [previousUploadsError, setPreviousUploadsError] = useState<string | null>(null);
  const [selectedPreviousName, setSelectedPreviousName] = useState<string | null>(null); // To highlight selected previous image

  // Fetch previous uploads
  const fetchPreviousUploads = useCallback(async () => {
    if (!user) return;
    setIsLoadingPrevious(true);
    setPreviousUploadsError(null);
    setPreviousUploads([]); // Clear previous results

    try {
      // List files in the user's folder within product-images
      const { data: fileList, error: listError } = await supabase.storage
        .from('product-images')
        .list(user.id, {
          limit: 100, // Adjust limit as needed
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (listError) throw listError;

      if (!fileList || fileList.length === 0) {
        setIsLoadingPrevious(false);
        return; // No previous uploads
      }

      // Get public URLs for each file
      const uploadsWithUrls: PreviousUpload[] = [];
      for (const file of fileList) {
        // Skip potential placeholder files if Supabase Storage adds them
        if (file.name === '.emptyFolderPlaceholder') continue;

        const { data: urlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(`${user.id}/${file.name}`); // Construct full path

        if (urlData?.publicUrl) {
          uploadsWithUrls.push({ name: file.name, url: urlData.publicUrl });
        }
      }

      setPreviousUploads(uploadsWithUrls);

    } catch (error) {
      console.error('Error fetching previous uploads:', error);
      setPreviousUploadsError(`Failed to load previous uploads: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoadingPrevious(false);
    }
  }, [supabase, user]);

  // Fetch uploads on component mount or user change
  useEffect(() => {
    fetchPreviousUploads();
  }, [fetchPreviousUploads]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Basic validation (can be expanded based on PRD Step 7)
    if (file.size > 20 * 1024 * 1024) { // 20MB limit
      setUploadError("File size exceeds 20MB limit.");
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setUploadError("Invalid file type. Please upload PNG, JPG, or JPEG.");
      return;
    }

    setUploadError(null);
    setUploadedImageUrl(null); // Clear any previously selected image (from previous uploads or old file)
    setSelectedPreviousName(null); // Clear previous selection highlight
    setIsUploading(true);

    // Construct the path relative to the bucket root, using user ID as a folder
    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    try {
      const { data, error } = await supabase.storage
        .from('product-images') // Use 'product-images' bucket as per PRD
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL (or signed URL if bucket isn't public - needs adjustment)
      // Assuming 'product-images' might need signed URLs for the edge function
      // For simplicity now, let's try to get a temporary public URL if possible or handle signed URL generation.
      // NOTE: The edge function needs access to this image. If the bucket is private,
      // we might need to generate a signed URL here and pass that, or adjust bucket permissions.
      // Let's assume for now the edge function *can* access it via service key, but this needs verification.
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
      setUploadedImageUrl(urlData.publicUrl);
      // Optionally refresh the list of previous uploads immediately
      fetchPreviousUploads();

    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploadedImageUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectPrevious = (upload: PreviousUpload) => {
    setUploadedImageUrl(upload.url);
    setSelectedPreviousName(upload.name); // Highlight selection
    setUploadError(null); // Clear any upload error
    // Clear the file input visually (if possible, depends on browser/React handling)
    const fileInput = document.getElementById('productImage') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
  };

  const handleGenerate = async () => {
    if (!uploadedImageUrl || !user) {
      setGenerateError("Please upload or select an image first.");
      return;
    }

    let parsedPromptDetails;
    try {
      parsedPromptDetails = JSON.parse(promptDetails);
    } catch (_) {
      setGenerateError("Invalid JSON format in prompt details.");
      return;
    }

    setGenerateError(null);
    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate_banner', {
        body: {
          user_id: user.id,
          prompt_details: parsedPromptDetails,
          input_image_url: uploadedImageUrl // Pass the URL obtained after upload
        }
      });

      if (error) throw error;

      console.log('Generated Banners:', data);
      // Call the onGenerationComplete callback
      onGenerationComplete();

    } catch (error) {
      console.error('Error generating banners:', error);
      setGenerateError(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 p-4 border rounded-lg shadow-sm bg-white">
      {/* Image Selection Area */}
      <div className="space-y-4">
         <h3 className="text-lg font-medium text-gray-900">Select or Upload Image/Logo</h3>

         {/* Previous Uploads Section */}
         <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Use Previous Upload</label>
            {isLoadingPrevious && <p className="text-sm text-gray-500">Loading previous uploads...</p>}
            {previousUploadsError && <p className="text-sm text-red-600">{previousUploadsError}</p>}
            {!isLoadingPrevious && !previousUploadsError && previousUploads.length === 0 && (
                <p className="text-sm text-gray-500">No previous uploads found.</p>
            )}
            {!isLoadingPrevious && !previousUploadsError && previousUploads.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto border p-2 rounded">
                    {previousUploads.map((upload) => (
                        <button
                            key={upload.name}
                            onClick={() => handleSelectPrevious(upload)}
                            disabled={isGenerating || isUploading}
                            className={`relative border rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-all duration-200 ease-in-out z-10 ${selectedPreviousName === upload.name ? 'ring-2 ring-blue-500 ring-offset-2' : 'border-gray-300 hover:border-blue-400'}`}
                            title={`Use ${upload.name}`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={upload.url}
                                alt={upload.name}
                                className="w-full h-16 object-contain bg-gray-100"
                            />
                            {selectedPreviousName === upload.name && (
                                <div className="absolute inset-0 bg-blue-500 bg-opacity-40 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
         </div>

         {/* Separator */}
         <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center">
                <span className="px-2 bg-white text-sm text-gray-500">OR</span>
            </div>
        </div>

        {/* File Upload Section */}
        <div>
            <label htmlFor="productImage" className="block text-sm font-medium text-gray-700 mb-1">Upload New Image (.png, .jpg, max 20MB)</label>
            <input
              id="productImage"
              type="file"
              accept=".png, .jpg, .jpeg"
              onChange={handleFileChange}
              disabled={isUploading || isGenerating}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50 transition-colors duration-200 ease-in-out relative z-10"
            />
            {isUploading && <p className="text-sm text-blue-600 mt-1">Uploading...</p>}
            {uploadError && <p className="text-sm text-red-600 mt-1">{uploadError}</p>}
        </div>

        {/* Combined Preview Area */}
        {uploadedImageUrl && (
          <div className="mt-2">
            <p className="text-sm text-green-600">Using this image:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={uploadedImageUrl} alt="Selected or Uploaded preview" className="mt-1 h-20 w-auto object-contain border rounded bg-gray-50" />
          </div>
        )}
      </div>

      {/* Prompt Details */}
      <div>
        <label htmlFor="promptDetails" className="block text-sm font-medium text-gray-700 mb-1">Banner Prompt Details (JSON)</label>
        <textarea
          id="promptDetails"
          rows={6}
          value={promptDetails}
          onChange={(e) => setPromptDetails(e.target.value)}
          disabled={isGenerating}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono disabled:opacity-50 disabled:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white relative z-10"
          placeholder='Enter banner design details as JSON...' />
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={!uploadedImageUrl || isUploading || isGenerating}
        className="w-full inline-flex justify-center py-3 px-6 border border-transparent shadow-md text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
      >
        {isGenerating ? 'Generating...' : 'Generate Banners'}
      </button>
      {generateError && <p className="text-sm text-red-600 mt-1 text-center">{generateError}</p>}
    </div>
  );
}
