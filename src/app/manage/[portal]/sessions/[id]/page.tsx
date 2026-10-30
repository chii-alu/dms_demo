import { redirect } from "next/navigation";

export default async function SessionIndex({ params }: { params: Promise<{ portal: string; id: string }> }) {
  const { portal, id } = await params;
  redirect(`/manage/${portal}/sessions/${id}/forms`);
}
