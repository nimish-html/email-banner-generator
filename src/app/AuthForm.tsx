"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { createClient } from '@/lib/supabase/client'; // Use the client helper

export default function AuthForm() {
  const supabase = createClient(); // Initialize client-side Supabase client
  const router = useRouter(); // <-- Initialize router

  useEffect(() => {
    // Correctly destructure the subscription object
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_IN') {
          console.log('AuthForm: SIGNED_IN event detected, redirecting to /builder');
          // Use replace instead of push to avoid adding the auth page to history
          router.replace('/builder'); 
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      // Call unsubscribe on the correctly destructured subscription
      subscription?.unsubscribe(); 
    };
  }, [supabase, router]); // <-- Add dependencies

  return (
    <div className="bg-white p-6 rounded-lg shadow-md relative z-10">
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: {
            default: {
              colors: {
                brand: '#2563eb', // blue-600
                brandAccent: '#1d4ed8', // blue-700
                brandButtonText: 'white',
                inputBorderFocus: '#3b82f6', // blue-500
              },
              borderWidths: {
                buttonBorderWidth: '1px',
                inputBorderWidth: '1px',
              },
              radii: {
                borderRadiusButton: '0.5rem', // rounded-lg
                buttonBorderRadius: '0.5rem', // rounded-lg
                inputBorderRadius: '0.5rem', // rounded-lg
              },
            },
          },
          style: {
            button: {
              borderRadius: '0.5rem',
              fontSize: '16px',
              padding: '10px 15px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              transition: 'all 200ms ease-in-out',
            },
            input: {
              borderRadius: '0.5rem',
              fontSize: '16px',
              padding: '10px 15px',
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            },
            anchor: {
              color: '#3b82f6', // blue-500
              transition: 'color 200ms ease-in-out',
            },
            message: {
              borderRadius: '0.375rem',
              padding: '10px 15px',
            },
          },
        }}
        theme="light"
        providers={[]} // Example: Add providers if needed, e.g., ['github', 'google']
        redirectTo={`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/builder`} // Redirect directly to the builder page
      />
    </div>
  );
}
