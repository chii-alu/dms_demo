import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { RegistrationForm } from "@/components/forms/RegistrationForm";
import type { FieldSpec } from "@/lib/forms/fields";
import { card } from "@/components/ui/styles";

// Public registration page for a series. The form and its questions come from the database.
export default async function RegisterPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { data, error } = await createPublicClient().rpc("get_registration_form", { p_code: code });
  if (error) throw new Error("The registration form could not be loaded.");
  if (!data) notFound();

  const form = data as { title: string; intro: string; status: string; questions: FieldSpec[] };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-semibold text-ink">{form.title}</h1>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{form.intro}</p>
      </header>

      {form.status === "open" ? (
        <RegistrationForm code={code} fields={form.questions} />
      ) : (
        <div className={`${card} text-center text-muted`}>Registration for this series is closed.</div>
      )}
    </main>
  );
}
