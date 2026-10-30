"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SessionTabs({ sessionId, selective }: { sessionId: string; selective: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { slug: "forms", label: "Forms" },
    { slug: "people", label: selective ? "Applications and selection" : "Registrations" },
    { slug: "attendance", label: "Attendance" },
    { slug: "feedback", label: "Feedback" },
    { slug: "details", label: "Session details" },
  ];
  const base = `/manage/sessions/${sessionId}`;

  return (
    <nav aria-label="Session sections" className="mt-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const href = `${base}/${t.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3.5 py-2 font-medium ${
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
