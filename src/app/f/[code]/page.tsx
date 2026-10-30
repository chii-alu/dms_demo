// Public forms (SPEC §7). No login. Renders intake, check-in or feedback by form code in milestone 3.
export default async function PublicFormPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="text-sm text-muted">Form {code}</p>
      <p className="mt-2">Public forms arrive in milestone 3.</p>
    </main>
  );
}
