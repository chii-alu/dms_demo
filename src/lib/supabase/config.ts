// Public Supabase settings. The anon key is safe in the browser; RLS is the protection.
// Never add SUPABASE_SERVICE_ROLE_KEY here: it is read only in server-side code.
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill it in.",
    );
  }
  return { url, anonKey };
}
