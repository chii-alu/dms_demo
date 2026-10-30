"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavIntervention = { id: string; name: string; type: "open" | "selective"; sessionCount: number };
export type NavPillar = { pillar: "HENT" | "HEMP" | "HECO"; interventions: NavIntervention[] };

const PILLAR_COLOR: Record<NavPillar["pillar"], string> = {
  HENT: "var(--hent)",
  HEMP: "var(--hemp)",
  HECO: "var(--heco)",
};

function NavLink({ href, children, count }: { href: string; children: React.ReactNode; count?: number }) {
  const pathname = usePathname();
  const active = href === "/manage" ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm hover:bg-sunk ${
        active ? "bg-accent-soft font-semibold text-accent" : ""
      }`}
    >
      {children}
      {count !== undefined && <span className="ml-auto text-xs tabular-nums text-muted">{count || ""}</span>}
    </Link>
  );
}

export function ManageNav({ pillars, signOutAction }: { pillars: NavPillar[]; signOutAction: () => Promise<void> }) {
  return (
    <nav aria-label="Pillars and interventions" className="flex h-full flex-col">
      <div className="px-2.5 pb-4 pt-1">
        <div className="font-display text-xl font-semibold">MELA</div>
        <div className="text-xs text-muted">Intervention manager</div>
      </div>

      <NavLink href="/manage">Overview</NavLink>
      <NavLink href="/manage/registry">Participant registry</NavLink>
      <NavLink href="/manage/data">Data for the dashboard</NavLink>

      {pillars.map(({ pillar, interventions }) => (
        <div key={pillar}>
          <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-4 text-xs font-semibold tracking-wider text-muted">
            <span className="h-3.5 w-1 rounded-sm" style={{ background: PILLAR_COLOR[pillar] }} />
            {pillar}
          </div>
          {interventions.map((i) => (
            <NavLink key={i.id} href={`/manage/interventions/${i.id}`} count={i.sessionCount}>
              <span
                className={`inline-block h-2 w-2 flex-none rounded-full border-[1.5px] border-muted ${
                  i.type === "selective" ? "bg-muted" : ""
                }`}
                title={i.type}
              />
              {i.name}
            </NavLink>
          ))}
        </div>
      ))}

      <div className="mt-auto border-t border-line pt-4 text-sm">
        <Link href="/dashboard" className="block px-2.5 py-1.5 text-accent hover:underline">
          Dashboard
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="px-2.5 py-1.5 text-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
