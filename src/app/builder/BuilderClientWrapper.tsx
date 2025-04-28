"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import BannerGeneratorForm from './BannerGeneratorForm';
import BannerGallery from './BannerGallery';
import type { Banner } from '@/types/Banner';

interface BuilderClientWrapperProps {
  user: User;
}

export default function BuilderClientWrapper({ user }: BuilderClientWrapperProps) {
  const supabase = createClient();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBanners = useCallback(async () => {
    console.log("Fetching banners for user:", user.id);
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('banners')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log("Fetched banners data:", data); 
      console.log("Fetched banners length:", data?.length); 
      console.log("Fetched banners first item:", data?.[0]); 
      setBanners(data || []);
    } catch (err) {
      console.error('Error fetching banners:', err); 
      console.error('Error message:', err instanceof Error ? err.message : 'Unknown error'); 
      setError(`Failed to load banners: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setBanners([]); // Clear banners on error
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user.id]);

  useEffect(() => {
    if (user) {
      fetchBanners();
    }
  }, [fetchBanners, user]); // Depend on user object as well

  const refreshBanners = () => {
    console.log("Refresh triggered");
    fetchBanners();
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Generate Banners</h2>
          {/* Pass user and refresh function to the form */}
          <BannerGeneratorForm user={user} onGenerationComplete={refreshBanners} />
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Your Banner Gallery</h2>
          {/* Pass fetched banners and loading state to the gallery */}
          <BannerGallery banners={banners} isLoading={isLoading} error={error} />
        </div>
      </div>
    </div>
  );
}
