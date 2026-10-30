// Sends one email through Resend (SPEC §2, §9). Without RESEND_API_KEY and MELA_EMAIL_FROM,
// nothing is sent and the caller records status 'not_configured'.
export type SendResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

export async function sendEmail(
  input: { to: string; subject: string; text: string },
  env: { apiKey?: string; from?: string } = {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.MELA_EMAIL_FROM,
  },
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  if (!env.apiKey || !env.from) return { status: "not_configured" };

  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.from, to: input.to, subject: input.subject, text: input.text }),
    });
    if (!res.ok) return { status: "failed", error: `The email provider responded with ${res.status}.` };
    const json = (await res.json()) as { id?: string };
    return { status: "sent", providerMessageId: json.id ?? "" };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : "The email could not be sent." };
  }
}
