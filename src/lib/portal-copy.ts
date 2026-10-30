// Introductions for the three main pages, one set per portal. Edit the wording here.
import type { Portal } from "@/lib/auth/portals";

export type PortalCopy = { overview: string; registry: string; feedback: string; data: string };

export const PORTAL_COPY: Record<Portal, PortalCopy> = {
  admin: {
    overview:
      "All three pillars in one view: sessions, people reached and attendance, and what needs attention across HENT, HEMP and HECO.",
    registry:
      "One record per person across all pillars, matched by email. Use it to count unique reach and to follow someone's journey from one pillar to another.",
    feedback:
      "Every feedback response from sessions across HENT, HEMP and HECO, newest first. Open a session to see its full feedback, or a participant ID to see their journey.",
    data:
      "Everything collected across the three pillars, stored in six linked tables. The dashboard reads these tables or the reporting views. Downloads are for admins only, because they contain personal data.",
  },
  hent: {
    overview:
      "HENT sessions, people and attendance. Start with Needs attention: applications to review, attendance still to record, and feedback forms still to open.",
    registry:
      "Everyone in the registry, including people who have taken part in other pillars. Open a person to see their full journey across sessions.",
    feedback:
      "Feedback from HENT sessions, newest first. Open a session to see its full feedback, or a participant ID to see their journey.",
    data:
      "HENT figures feed the dashboard. Downloads are admin-only because they contain personal data, so ask an admin if you need a copy.",
  },
  hemp: {
    overview:
      "HEMP sessions, people and attendance. Start with Needs attention: applications to review, attendance still to record, and feedback forms still to open.",
    registry:
      "Everyone in the registry, including people who have taken part in other pillars. Open a person to see their full journey across sessions.",
    feedback:
      "Feedback from HEMP sessions, newest first. Open a session to see its full feedback, or a participant ID to see their journey.",
    data:
      "HEMP figures feed the dashboard. Downloads are admin-only because they contain personal data, so ask an admin if you need a copy.",
  },
  heco: {
    overview:
      "HECO sessions, people and attendance. Start with Needs attention: applications to review, attendance still to record, and feedback forms still to open.",
    registry:
      "Everyone in the registry, including people who have taken part in other pillars. Open a person to see their full journey across sessions.",
    feedback:
      "Feedback from HECO sessions, newest first. Open a session to see its full feedback, or a participant ID to see their journey.",
    data:
      "HECO figures feed the dashboard. Downloads are admin-only because they contain personal data, so ask an admin if you need a copy.",
  },
};
