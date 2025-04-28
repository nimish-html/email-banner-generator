"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// Define the shape of the hook's return value
interface UseUserReturn {
  user: User | null;
  supa: SupabaseClient | null;
  isLoading: boolean;
}

export const useUser = (): UseUserReturn => {
  const [supa, setSupa] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Add loading state

  useEffect(() => {
    // Create the browser client instance only once
    const client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    setSupa(client);

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", event, session?.user?.id);
      setUser(session?.user ?? null);
      setIsLoading(false); // Set loading to false after first check
    });

    // Initial check for user session
    client.auth.getUser().then(({ data: { user } }) => {
       if (!user && !isLoading) { // Avoid setting loading false if already handled by onAuthStateChange
            setIsLoading(false);
       }
       // setUser is handled by onAuthStateChange which fires on getUser too
    }).catch(() => setIsLoading(false)); // Handle potential errors during initial check


    // Cleanup subscription on unmount
    return () => {
      subscription?.unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return { user, supa, isLoading }; // Include isLoading in the return
};
