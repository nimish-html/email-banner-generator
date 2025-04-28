'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component from shadcn/ui

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/'); // Redirect to home page after logout
    router.refresh(); // Refresh the page to reflect logout state
  };

  return (
    <Button 
      variant="outline" 
      onClick={handleLogout}
      className="relative z-20 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-200 ease-in-out"
    >
      Logout
    </Button>
  );
}
