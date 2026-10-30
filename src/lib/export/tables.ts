// CSV exports for /api/export/[table] (SPEC §8: exports are admin only; §3 data definitions).
import type { SupabaseClient } from "@supabase/supabase-js";
import { applicationScore } from "@/lib/rules/scoring";
import { sessionStatus } from "@/lib/rules/session-status";
import { todayIso } from "@/lib/dates";

export const EXPORT_TABLES = ["participants", "interventions", "sessions", "registrations", "attendance", "feedback"] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

type Row = Record<string, unknown>;

// Reads every row, 1000 at a time, so large tables are not truncated.
async function fetchAll(
  page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

type Def = { columns: string[]; load: (db: SupabaseClient) => Promise<Row[]> };

export const EXPORTS: Record<ExportTable, Def> = {
  participants: {
    columns: ["pid", "name", "email", "phone", "gender", "age_group", "country", "affiliation", "disability", "created_at"],
    load: (db) =>
      fetchAll((from, to) =>
        db
          .from("participants")
          .select("pid, name, email, phone, gender, age_group, country, affiliation, disability, created_at")
          .order("pid")
          .range(from, to),
      ),
  },

  interventions: {
    columns: ["id", "pillar", "name", "type"],
    load: (db) => fetchAll((from, to) => db.from("interventions").select("id, pillar, name, type").order("id").range(from, to)),
  },

  sessions: {
    columns: ["id", "intervention_id", "pillar", "intervention", "title", "kind", "dates", "mode", "venue", "capacity", "application_deadline", "status"],
    load: async (db) => {
      const today = todayIso();
      const rows = await fetchAll((from, to) =>
        db
          .from("sessions")
          .select("id, intervention_id, pillar, title, kind, dates, mode, venue, capacity, application_deadline, interventions(name)")
          .order("id")
          .range(from, to),
      );
      return rows.map((r) => {
        const dates = (r.dates as string[]) ?? [];
        return {
          ...r,
          intervention: (r.interventions as { name: string } | null)?.name ?? "",
          dates: [...dates].sort().join(" | "),
          status: sessionStatus(dates, today),
        };
      });
    },
  },

  registrations: {
    columns: ["id", "session_id", "pid", "form_type", "status", "source", "score", "submitted_at"],
    load: async (db) => {
      const entries = await fetchAll((from, to) =>
        db
          .from("entries")
          .select("id, session_id, status, source, submitted_at, participants(pid), sessions(kind)")
          .order("id")
          .range(from, to),
      );
      const criteria = await fetchAll((from, to) =>
        db.from("rubric_criteria").select("id, session_id, weight").order("id").range(from, to),
      );
      const scores = await fetchAll((from, to) =>
        db.from("scores").select("entry_id, criterion_id, reviewer_id, score").order("entry_id").range(from, to),
      );

      const byEntry = new Map<string, Record<string, Record<string, number>>>();
      for (const s of scores) {
        const entry = s.entry_id as string;
        const reviewers = byEntry.get(entry) ?? {};
        (reviewers[s.reviewer_id as string] ??= {})[s.criterion_id as string] = s.score as number;
        byEntry.set(entry, reviewers);
      }

      return entries.map((e) => {
        const sid = e.session_id as string;
        const crit = criteria.filter((c) => c.session_id === sid).map((c) => ({ id: c.id as string, weight: c.weight as number }));
        const score = crit.length ? applicationScore(crit, byEntry.get(e.id as string) ?? {}) : null;
        return {
          id: e.id,
          session_id: sid,
          pid: (e.participants as { pid: string } | null)?.pid ?? "",
          form_type: (e.sessions as { kind: string } | null)?.kind ?? "",
          status: e.status,
          source: e.source,
          score: score ?? "",
          submitted_at: e.submitted_at,
        };
      });
    },
  },

  attendance: {
    columns: ["session_id", "pid", "date", "checked_in_at", "method"],
    load: async (db) => {
      const rows = await fetchAll((from, to) =>
        db
          .from("attendance")
          .select("session_id, date, checked_in_at, method, participants(pid)")
          .order("session_id")
          .range(from, to),
      );
      return rows.map((r) => ({
        session_id: r.session_id,
        pid: (r.participants as { pid: string } | null)?.pid ?? "",
        date: r.date,
        checked_in_at: r.checked_in_at,
        method: r.method,
      }));
    },
  },

  feedback: {
    columns: ["session_id", "pid", "submitted_at", "satisfaction", "relevance", "nps", "most_useful", "improve", "session_answers"],
    load: async (db) => {
      const rows = await fetchAll((from, to) =>
        db
          .from("feedback")
          .select("session_id, submitted_at, satisfaction, relevance, nps, most_useful, improve, answers, participants(pid)")
          .order("id")
          .range(from, to),
      );
      return rows.map((r) => ({
        session_id: r.session_id,
        pid: (r.participants as { pid: string } | null)?.pid ?? "",
        submitted_at: r.submitted_at,
        satisfaction: r.satisfaction,
        relevance: r.relevance,
        nps: r.nps,
        most_useful: r.most_useful,
        improve: r.improve,
        session_answers: r.answers,
      }));
    },
  },
};
