import { describe, expect, it, vi } from "vitest";
import { sendEmail } from "./send";

const input = { to: "aline@example.org", subject: "Update", text: "Hello" };

describe("sendEmail", () => {
  it("does nothing without configuration", async () => {
    const f = vi.fn();
    expect(await sendEmail(input, {}, f)).toEqual({ status: "not_configured" });
    expect(f).not.toHaveBeenCalled();
  });

  it("posts to Resend with the key and returns the message id", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const r = await sendEmail(input, { apiKey: "re_test", from: "MELA <no-reply@example.org>" }, f as unknown as typeof fetch);
    expect(r).toEqual({ status: "sent", providerMessageId: "msg_1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer re_test");
  });

  it("reports a failed send without throwing", async () => {
    const f = vi.fn(async () => new Response("nope", { status: 422 }));
    const r = await sendEmail(input, { apiKey: "k", from: "f" }, f as unknown as typeof fetch);
    expect(r).toEqual({ status: "failed", error: "The email provider responded with 422." });
  });

  it("reports a network error without throwing", async () => {
    const f = vi.fn(async () => {
      throw new Error("offline");
    });
    const r = await sendEmail(input, { apiKey: "k", from: "f" }, f as unknown as typeof fetch);
    expect(r).toEqual({ status: "failed", error: "offline" });
  });
});
