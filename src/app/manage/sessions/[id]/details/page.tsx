import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionDetails } from "@/components/manage/SessionDetails";

export default async function SessionDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, title, kind, dates, mode, venue, facilitator, capacity, application_deadline, entries(count)")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  return (
    <SessionDetails
      sessionId={s.id}
      selective={s.kind === "application"}
      registrations={s.entries[0]?.count ?? 0}
      defaults={{
        title: s.title,
        dates: s.dates,
        mode: s.mode as "In person" | "Online" | "Hybrid",
        capacity: s.capacity,
        venue: s.venue,
        facilitator: s.facilitator,
        applicationDeadline: s.application_deadline,
      }}
    />
  );
}
