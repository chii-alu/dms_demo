import { createClient } from "@/lib/supabase/server";
import { RegistryTable, type RegistryRow } from "@/components/manage/RegistryTable";

export default async function RegistryPage() {
  const supabase = await createClient();

  const [{ data: people, error }, { data: entries }, { data: attendance }] = await Promise.all([
    supabase.from("participants").select("id, pid, name, email, gender, age_group, country").order("pid"),
    supabase.from("entries").select("participant_id, session_id, sessions(pillar)"),
    supabase.from("attendance").select("participant_id, session_id"),
  ]);
  if (error) throw new Error(`Could not load participants: ${error.message}`);

  const rows: RegistryRow[] = (people ?? []).map((p) => {
    const mine = (entries ?? []).filter((e) => e.participant_id === p.id);
    const pillars = [...new Set(mine.map((e) => (e.sessions as unknown as { pillar: string } | null)?.pillar).filter(Boolean))] as string[];
    const sessions = new Set(mine.map((e) => e.session_id)).size;
    const attended = new Set((attendance ?? []).filter((a) => a.participant_id === p.id).map((a) => a.session_id)).size;
    return {
      pid: p.pid,
      name: p.name,
      email: p.email,
      gender: p.gender,
      age: p.age_group,
      country: p.country,
      pillars,
      sessions,
      attended,
    };
  });

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Participant registry</h1>
        <p className="mt-2 max-w-2xl text-muted">
          One record per person, matched by email. Every registration, application, check-in and feedback response links to the participant ID, so you can count unique reach and follow someone across pillars.
        </p>
      </div>
      <RegistryTable rows={rows} />
    </section>
  );
}
