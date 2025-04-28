import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server"; // Use server client
import { cookies } from 'next/headers'; // Import cookies

export async function GET() {
  const cookieStore = cookies(); // Get cookie store
  const supabase = await createClient(); // No need to pass cookieStore as it's handled in the function

  // Get user session
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  
  // Basic error handling
  if (error) {
    console.error('Error fetching banners:', error);
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 });
  }

  return NextResponse.json({ banners: data });
}
