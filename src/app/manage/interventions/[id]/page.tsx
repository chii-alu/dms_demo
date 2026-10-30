import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function InterventionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: intervention } = await supabase
    .from("interventions")
    .select("name, pillar, type")
    .eq("id", id)
    .maybeSingle();
  if (!intervention) notFound();

  return (
    <section>
      <p className="text-sm text-muted">
        {intervention.pillar} · {intervention.type === "selective" ? "Selective" : "Open"}
      </p>
      <h1 className="font-display text-3xl font-semibold">{intervention.name}</h1>
      <p className="mt-2 max-w-2xl text-muted">Sessions table and New session arrive in milestone 2.</p>
    </section>
  );
}
