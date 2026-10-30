import { NextResponse, type NextRequest } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { allowRequest } from "@/lib/rate-limit";
import { validateAnswers, type FieldSpec } from "@/lib/forms/fields";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_000;
const LIMIT_PER_MINUTE = 20;

// Form question ids that describe the person. They are kept on the person's record, so returning students are not asked again.
// Every other answer is kept with this registration.
const PROFILE_FIELDS: Record<string, string> = {
  institution: "institution",
  student_email: "student_email",
  personal_email: "email",
  full_name: "full_name",
  whatsapp: "phone",
  gender: "gender",
  nationality: "nationality",
  country_of_residence: "country_of_residence",
  humanitarian: "humanitarian",
  disability: "disability",
  residence: "residence",
  enrolment_status: "enrolment_status",
  programme: "programme",
  consent: "consent",
};

const error = (status: number, message: string, fieldErrors?: Record<string, string>) =>
  NextResponse.json({ ok: false, error: message, fieldErrors }, { status });

// Postgres errors raised by the registration rules (see the masterclass_registration migration).
function fromDbError(e: { code?: string; message: string }) {
  if (e.code === "P0002") return error(404, e.message);
  if (e.code === "23505") return error(409, e.message);
  if (e.code === "P0001" || e.code === "22023") return error(422, e.message);
  console.error("registration failed", e);
  return error(500, "Something went wrong. Please try again.");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const supabase = createPublicClient();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    if (!(await allowRequest(supabase, `${ip}:register:${code}`, LIMIT_PER_MINUTE))) {
      return error(429, "Too many attempts. Wait a minute and try again.");
    }
  } catch (e) {
    console.error("rate limiter unavailable", e);
    return error(503, "The form is busy right now. Please try again in a moment.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return error(413, "That submission is too large.");
  let body: { values?: unknown; website?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return error(400, "Could not read the form.");
  }

  // Honeypot: real visitors never fill the hidden field. Pretend success and store nothing.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, data: { registered: true } });
  }

  const { data: form, error: formError } = await supabase.rpc("get_registration_form", { p_code: code });
  if (formError) return fromDbError(formError);
  if (!form) return error(404, "This form does not exist.");

  const f = form as { status: string; questions: FieldSpec[] };
  if (f.status !== "open") return error(409, "This form is not accepting responses.");

  const values = typeof body.values === "object" && body.values ? (body.values as Record<string, unknown>) : {};
  const parsed = validateAnswers(f.questions, values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return error(400, "Some answers need attention.", fieldErrors);
  }

  const answers = parsed.data as Record<string, unknown>;
  const profile: Record<string, unknown> = {};
  const registration: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined) continue;
    if (key in PROFILE_FIELDS) profile[PROFILE_FIELDS[key]] = value;
    else registration[key] = value;
  }

  const { data, error: rpcError } = await supabase.rpc("submit_registration", {
    p_code: code,
    p_profile: profile,
    p_answers: registration,
  });
  if (rpcError) return fromDbError(rpcError);
  return NextResponse.json({ ok: true, data });
}
