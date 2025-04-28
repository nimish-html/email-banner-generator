"use client";

import { useState } from 'react'; 
import type { Banner } from '@/types/Banner';

interface BannerGalleryProps {
  banners: Banner[];
  isLoading: boolean;
  error: string | null;
}

export default function BannerGallery({ banners, isLoading, error }: BannerGalleryProps) {
  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // Log received props
  console.log("BannerGallery Props:", { banners, isLoading, error });

  // Function to open modal
  const handleImageClick = (url: string) => {
    setSelectedImageUrl(url);
    setIsModalOpen(true);
  };

  // Function to close modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedImageUrl(null);
  };

  return (
    <div className="p-4 border rounded-lg shadow-md bg-white dark:bg-gray-700 min-h-[200px] relative z-10">
      {isLoading && <p className="text-center text-gray-500 dark:text-gray-300">Loading banners...</p>}
      {error && <p className="text-center text-red-600">{error}</p>}
      {!isLoading && !error && banners.length === 0 && (
        <p className="text-center text-gray-500 dark:text-gray-300">No banners generated yet. Use the form to create some!</p>
      )}
      {!isLoading && !error && banners.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {banners.map((banner) => (
            banner.generated_urls.map((url: string, index: number) => {
              console.log(`Rendering banner image URL: ${url}`);
              return (
                // Add onClick to the wrapper div
                <div 
                  key={`${banner.id}-${index}`} 
                  className="aspect-[16/9] border rounded overflow-hidden group relative cursor-pointer" 
                  onClick={() => handleImageClick(url)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Generated Banner ${index + 1}`}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" 
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', url);
                    }}
                  />
                </div>
              );
            })
          ))}
        </div>
      )}

      {/* Modal Structure */}
      {isModalOpen && selectedImageUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-300 ease-in-out" 
          onClick={handleCloseModal} 
        >
          <div 
            className="relative bg-white dark:bg-gray-800 p-4 rounded-lg shadow-xl max-w-3xl max-h-[80vh] overflow-auto" 
            onClick={(e) => e.stopPropagation()} 
          >
            <button 
              onClick={handleCloseModal} 
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 dark:text-white dark:hover:text-gray-300 text-2xl font-bold z-10 transition-colors duration-200 ease-in-out"
            >
              &times; 
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedImageUrl} 
              alt="Selected Banner" 
              className="w-full h-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
