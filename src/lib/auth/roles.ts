import type { SupabaseClient } from "@supabase/supabase-js";
import type { StaffRole } from "@/lib/sessions/tabs";

// The signed-in user's staff role, or null if they have none. RLS lets a user read their own row.
export async function currentStaffRole(supabase: SupabaseClient): Promise<StaffRole | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("staff_roles").select("role").eq("user_id", user.id).maybeSingle();
  return (data?.role as StaffRole | undefined) ?? null;
}
