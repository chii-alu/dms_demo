import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentStaffRole } from "@/lib/auth/roles";
import { fallbackTab, visibleTabs, type TabSlug } from "./tabs";

// Sends a user who may not use this tab (a reviewer, for example) to the tab they can use (SPEC §8).
export async function requireTab(slug: TabSlug, sessionId: string) {
  const supabase = await createClient();
  const role = await currentStaffRole(supabase);
  if (!visibleTabs(role).includes(slug)) {
    redirect(`/manage/sessions/${sessionId}/${fallbackTab(role)}`);
  }
}
