// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Define a function to create a Supabase client for server-side operations
export async function createClient() { 
  const cookieStore = await cookies() 
  // Note: Ensure this runs in Node.js runtime so process.env is accessible.

  // Create a server-side Supabase client with the provided cookieStore
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Define a function to get a cookie by name
        get(name: string) { 
          return cookieStore.get(name)?.value 
        },
        // Define a function to set a cookie
        set(name: string, value: string, options: CookieOptions) { 
          try {
            cookieStore.set({ name, value, ...options }) 
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        // Define a function to remove a cookie
        remove(name: string, options: CookieOptions) { 
          try {
            cookieStore.set({ name, value: '', ...options }) 
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
