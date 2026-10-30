import { signIn } from "./actions";
import { PORTAL_LABEL, isPortal, type Portal } from "@/lib/auth/portals";

// The order the views appear in on the sign-in page.
const VIEW_ORDER: Portal[] = ["admin", "hent", "hemp", "heco"];

const messages: Record<string, string> = {
  invalid: "That email and password did not match a MELA staff account.",
  "no-access": "This account is signed in but has no MELA staff role. Ask an admin to add you.",
  portal: "Your account does not have access to that view. Choose a view you belong to.",
  choose: "Choose a view before signing in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; portal?: string }>;
}) {
  const { error, next, portal } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[10px] border border-line bg-surface p-6">
        <h1 className="font-display text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">MELA staff only. Choose the portal you work in.</p>

        {error && messages[error] && (
          <p role="alert" className="mt-4 rounded-md bg-bad-soft p-3 text-sm text-bad">
            {messages[error]}
          </p>
        )}

        <form action={signIn} className="mt-5 flex flex-col gap-4">
          <input type="hidden" name="next" value={next && next !== "/manage" ? next : ""} />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold">Choose a view</legend>
            <div className="grid grid-cols-2 gap-2">
              {VIEW_ORDER.map((p) => (
                <label key={p} className="cursor-pointer">
                  <input
                    type="radio"
                    name="portal"
                    value={p}
                    required
                    className="peer sr-only"
                  />
                  <span className="block rounded-md border border-line px-3 py-2 text-center text-sm font-medium hover:border-muted peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                    {PORTAL_LABEL[p]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-line bg-surface px-3 py-2 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-md border border-line bg-surface px-3 py-2 font-normal"
            />
          </label>
          <button type="submit" className="rounded-md bg-accent px-3 py-2 font-medium text-surface">
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
