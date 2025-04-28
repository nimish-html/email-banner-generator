export const runtime = 'nodejs';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BuilderClientWrapper from './BuilderClientWrapper';
import LogoutButton from './LogoutButton';
import { AuroraBackground } from '@/components/ui/aurora-background';

export default async function BuilderPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  // console.log('[BuilderPage Server] getUser result:', user ? `User ID: ${user.id}` : 'No user'); // <-- Remove log

  // If no user, redirect to the login page
  if (!user) {
    redirect('/');
  }

  return (
    <AuroraBackground>
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold dark:text-white">Email Banner Builder</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">Customize your promotional banners</p>
          </div>
          <div className="z-10 relative">
            <LogoutButton />
          </div>
        </div>

        {/* Render the client wrapper with z-index to ensure clickability */}
        <div className="relative z-10">
          <BuilderClientWrapper user={user} />
        </div>
      </main>
    </AuroraBackground>
  );
}
