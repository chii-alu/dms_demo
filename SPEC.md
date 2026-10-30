# MELA Intervention Tracker — Build Spec

> Hand this file to the coding agent together with `prototype.html` (the clickable prototype). The prototype is the source of truth for screens, wording and behaviour; this spec defines the architecture, data model and rules for the production React build.

## 1. What we are building

A data management platform for the MELA (Monitoring, Evaluation, Learning & Adaptation) team to run and track interventions across three pillars: **HECO, HENT, HEMP**.

- Each **pillar** has **interventions** (e.g. HENT → Masterclass).
- Each intervention runs many **sessions** (e.g. three different masterclasses at different dates). A session can span several dates (multi-day event, cohort with monthly meetings).
- **Every session gets its own forms**, each with a unique code, public link and QR code.
- Two intervention types:
  - **Open** → Registration → Attendance → Feedback
  - **Selective** → Application → Selection (rubric scoring) → Attendance → Feedback
- All submissions link to **one participant registry** (one person = one participant ID, matched by email) so MELA can count unique reach and follow people across pillars.
- The analytics **dashboard is being built separately in Next.js** and is out of scope for this spec. This platform lives in the same Next.js app (or monorepo) and the dashboard reads its database through the reporting views in §3. Our job is clean, well-structured tables plus those views.

## 2. Tech stack

The repo is a **single Next.js app** that holds both this Intervention Tracker (`/manage`) and the MELA analytics dashboard (`/dashboard`, built separately). They share auth, UI components, TypeScript types and the database. The app started as a fresh scaffold, so there was no existing dashboard to match.

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, latest stable) + React 19 + TypeScript. Next 16 renames middleware to `src/proxy.ts`; read `node_modules/next/dist/docs` before changing framework code |
| Data mutations | Server Actions for staff screens; Route Handlers (`app/api/...`) for public form submissions |
| Data reads | Server Components querying Supabase; TanStack Query only where client-side refresh is needed (attendance toggles, live counts) |
| Forms & validation | react-hook-form + zod (same zod schemas reused on server) |
| Styling | Tailwind CSS (port design tokens from the prototype's `:root`); reuse the dashboard's component library if it has one |
| Backend / DB | Supabase (Postgres, Auth via `@supabase/ssr`, Row Level Security). Development uses the local Supabase CLI stack (`npx supabase start`, which needs Docker). Secrets live in `.env.local` (git-ignored); `.env.example` lists the keys |
| QR codes | `qrcode.react` (download as PNG/SVG for printing) |
| Email notifications | Resend (or SMTP) called from Server Actions; log to `email_log` |
| CSV export | Route Handler streaming CSV (`papaparse` or manual) |
| Tests | Vitest + React Testing Library; Playwright for the public form flows |
| Hosting | Vercel |

The dashboard reads the reporting views in §3 directly from the same Supabase database. Its routes live under `/dashboard`, so they never collide with `/manage`, `/f` or `/api`.

### Route plan (fixed: avoids future conflicts)
| Path | Purpose | Auth |
|---|---|---|
| `/` | Landing page with links to Manage and Dashboard | public |
| `/login` | Staff sign-in (email and password) | public |
| `/manage/...` | Intervention Tracker (all staff screens in §7) | staff role |
| `/dashboard/...` | MELA analytics dashboard (placeholder until built) | staff role |
| `/f/[code]` | Public forms (intake, check-in, feedback) | public, mobile-first |
| `/api/forms/[code]/submit` | Public submission endpoint (rate-limited) | public |
| `/api/export/[table]` | CSV export | admin only |

### Suggested app structure
```
src/
  proxy.ts                           # session refresh + redirect signed-out visitors to /login
  app/
    layout.tsx, globals.css          # fonts and design tokens from the prototype
    page.tsx                         # landing: Manage / Dashboard
    login/page.tsx, login/actions.ts # staff sign-in and sign-out (Server Actions)
    manage/
      layout.tsx                     # staff-role check + sidebar (pillars → interventions)
      page.tsx                       # Overview
      interventions/[id]/page.tsx
      sessions/[id]/forms|people|attendance|feedback|details/page.tsx
      registry/page.tsx
      data/page.tsx
    dashboard/page.tsx               # placeholder; the dashboard is built here later
    f/[code]/page.tsx                # public forms (no auth, mobile-first)
    api/forms/[code]/submit/route.ts # public submission endpoint (rate-limited)
    api/export/[table]/route.ts      # CSV export (admin only)
  components/
    manage/ManageNav.tsx             # sidebar (client component: active link)
    DynamicForm.tsx, QrCard.tsx, StatusSelect.tsx, ...
  lib/
    supabase/{config,server,client,proxy}.ts
    redirect.ts                      # safeNext(): blocks open redirects
    forms/core-questions.ts          # locked core questions (§5)
    forms/schema.ts                  # zod schema builder for DynamicForm
    rules/                           # scoring, eligibility, capacity, completion (pure, unit-tested)
supabase/
  config.toml
  migrations/                        # SQL from §3 + RPCs + RLS
  seed.sql                           # interventions (§6)
e2e/                                 # Playwright
```

## 3. Data model (Postgres)

```sql
-- Reference
create type pillar as enum ('HECO','HENT','HEMP');
create type intervention_type as enum ('open','selective');
create type session_kind as enum ('registration','application');
create type form_kind as enum ('intake','attendance','feedback');
create type form_status as enum ('draft','open','closed');
create type entry_status as enum (
  'registered','waitlisted','cancelled',            -- open
  'applied','shortlisted','selected','rejected','withdrawn'  -- selective (+ waitlisted)
);

create table interventions (
  id uuid primary key default gen_random_uuid(),
  pillar pillar not null,
  name text not null,
  type intervention_type not null,
  active boolean default true,
  created_at timestamptz default now(),
  unique (pillar, name)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references interventions(id),
  pillar pillar not null,                 -- denormalised for RLS + reporting
  seq int not null,                       -- per-system running number, used in form codes
  kind session_kind not null,             -- fixed at creation from intervention.type
  title text not null,
  dates date[] not null,                  -- sorted, unique; attendance is taken per date
  mode text check (mode in ('In person','Online','Hybrid')),
  venue text, facilitator text,
  capacity int, application_deadline date,
  completion_threshold numeric default 0.75,  -- share of dates needed to count as "completed"
  created_by uuid references auth.users, created_at timestamptz default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  kind form_kind not null,
  code text unique not null,              -- e.g. HENT-M-004-REG / -APP / -ATT / -FBK
  status form_status not null default 'draft',
  questions jsonb not null default '[]',  -- custom questions only (see §5)
  unique (session_id, kind)
);

create table rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null, weight int not null check (weight between 0 and 100), position int
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  pid text unique not null,               -- human ID: MELA-0001 (sequence)
  email citext unique not null,
  name text not null, phone text,
  gender text, age_group text, country text, affiliation text, disability text,
  consent_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz
);

create table entries (                    -- registrations AND applications
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  participant_id uuid not null references participants(id),
  status entry_status not null,
  answers jsonb not null default '{}',    -- keyed by question id
  source text default 'self',             -- self | staff | walkin
  submitted_at timestamptz default now(),
  unique (session_id, participant_id)
);

create table scores (
  entry_id uuid references entries(id) on delete cascade,
  criterion_id uuid references rubric_criteria(id) on delete cascade,
  reviewer_id uuid references auth.users,
  score int check (score between 1 and 5),
  primary key (entry_id, criterion_id, reviewer_id)
);

create table attendance (
  session_id uuid references sessions(id) on delete cascade,
  participant_id uuid references participants(id),
  date date not null,
  checked_in_at timestamptz default now(),
  method text default 'self',             -- self | staff | walkin
  primary key (session_id, participant_id, date)
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  participant_id uuid references participants(id),
  satisfaction int check (satisfaction between 1 and 5),
  relevance int check (relevance between 1 and 5),
  nps int check (nps between 0 and 10),
  most_useful text, improve text,
  answers jsonb default '{}',
  submitted_at timestamptz default now(),
  unique (session_id, participant_id)
);

create table status_history (            -- audit trail for selection decisions
  id bigserial primary key, entry_id uuid references entries(id) on delete cascade,
  from_status entry_status, to_status entry_status,
  changed_by uuid references auth.users, changed_at timestamptz default now()
);
```

### Reporting views (for the dashboard)
Create read-only views; grant `select` to a `dashboard_reader` role:
- `v_session_summary` — per session: pillar, intervention, title, first/last date, status (upcoming/in progress/completed), intake count, eligible count, unique attendees, attendance rate, feedback count, response rate, avg satisfaction, avg relevance, NPS.
- `v_participant_activity` — one row per participant × session with status, dates attended, completed flag, feedback given.
- `v_reach_by_pillar` — unique participants per pillar/intervention/month, disaggregated by gender, age group, country, disability.
- `v_selection_funnel` — applied → shortlisted → selected → attended → completed per selective session.

## 4. Business rules (implement server-side: Postgres functions / RPCs called from Server Actions and Route Handlers; keep pure logic in `lib/rules` with unit tests)

1. **Session status** derives from dates vs today: all dates past = Completed; first date in future = Upcoming; else In progress.
2. **Form codes**: `{PILLAR}-{INTERVENTION_INITIALS}-{SEQ:000}-{REG|APP|ATT|FBK}`. Created automatically with the session (3 forms + default rubric if selective).
3. **Creating a session** may copy custom questions (and rubric) from a previous session of the same intervention, or start from the pillar's default template (§5).
4. **Intervention type change** affects only new sessions; existing sessions keep their `kind`.
5. **Public form submission** only when form `status = 'open'` (preview mode for staff bypasses this but must not save unless explicitly testing).
6. **Participant matching**: lower-cased email. Existing participant → update profile fields, reuse PID. New → create with next `MELA-####`. Never create duplicates.
7. **One entry per participant per session** → friendly error "already registered/applied".
8. **Capacity** (open sessions): when `registered` count ≥ capacity, new registrations become `waitlisted`.
9. **Selective intake** always lands as `applied`. Applications after `application_deadline` are rejected by the form with a clear message.
10. **Eligible for attendance**: open → `registered`; selective → `selected`. Check-in validates email + date ∈ session dates + eligibility; duplicate check-in for same date is rejected.
11. **Walk-ins** (open sessions, staff only): creates/matches participant, entry with `source='walkin'`, status `registered`, and marks attendance for the chosen date.
12. **Feedback** requires at least one attendance record for that session; one response per participant per session.
13. **Rubric score** = Σ(score/5 × weight) / Σweight × 100, averaged across reviewers. Shown only when all criteria are scored. Warn if weights ≠ 100.
14. **Completion** (multi-date sessions) = attended ≥ `completion_threshold` × number of dates.
15. Every status change writes to `status_history`.

## 5. Form schema

Standard (locked) questions are defined in code and always rendered first; only custom questions are stored in `forms.questions`.

- **Intake core**: full name, email, phone, gender, age group, country of residence, current affiliation, disability, consent (required checkbox).
- **Feedback core**: email, satisfaction (1–5), relevance (1–5), NPS (0–10), most useful (paragraph), improve (paragraph).
- **Attendance**: email + date picker limited to session dates (default today if it's a session date).

Custom question JSON:
```ts
type Question = {
  id: string;            // stable, used as key in answers
  label: string;
  type: 'text'|'long'|'email'|'number'|'date'|'single'|'multi'|'rating'|'scale10'|'yesno';
  options?: string[];    // single | multi
  required: boolean;
};
```

Default custom questions per pillar (see `defaultCustom()` / `defaultFbCustom()` in the prototype):
- HENT: venture name, venture stage (+ feedback: confidence applying to venture)
- HEMP: field of study/career interest, employment status (+ feedback: improved career readiness)
- HECO: organisation, role (+ feedback: applicability to public/health sector work)
- Applications add: motivation (required), goals (required), CV/portfolio link.
- Default rubric: Motivation & commitment 30, Fit with eligibility 30, Potential for impact 40.

Build one `<DynamicForm questions={...} />` renderer (zod schema generated from questions) used by both the public forms and the staff preview.

## 6. Seed data

Pillars and interventions (types are the MELA team's current assumption, editable in-app):

| Pillar | Intervention | Type |
|---|---|---|
| HENT | Ventures | selective |
| HENT | Venture Funding | selective |
| HENT | Masterclass | open |
| HENT | Hackathon | selective |
| HENT | Mentorship | selective |
| HENT | Exposure & Networking | open |
| HEMP | Career Workshops | open |
| HEMP | Exposure Events | open |
| HEMP | Internships | selective |
| HEMP | SIE | selective |
| HEMP | Courses | open |
| HECO | At a Glance | open |
| HECO | Public Sector Fellowship | selective |
| HECO | Health Expert in Residence Programme | selective |
| HECO | Research Activities | open |
| HECO | Public Sector Innovation Hackathon | selective |
| HECO | Executive Courses | selective |
| HECO | Impact Stories | open |

Also add a dev-only seed script reproducing the prototype's demo sessions/participants (`seed()` in the prototype).

## 7. Screens & routes

Staff app (authenticated, under `/manage`), layout = left sidebar (Overview, Participant registry, Data, then pillars → interventions with open/selective marker and session count, "+ Add intervention"). The landing page at `/` is public and links here. Routes below are shown without the `/manage` prefix.

| Route | Screen |
|---|---|
| `/manage` | Overview: pillar cards (sessions, unique people, attendances), **Needs attention** list (applications to review, attendance not recorded for past dates, feedback form not opened after a session, intake form still draft for upcoming session), all-sessions table |
| `/manage/interventions/:id` | Intervention: type selector, KPIs, sessions table, "New session" |
| `/manage/sessions/:id/forms` | Form cards (status select, edit questions, preview, share link/QR) + rubric (selective) |
| `/manage/sessions/:id/people` | Registrations / Applications: status filter chips with counts, table, per-row status select, bulk status change, score column sorted desc, "Add manually" |
| `/manage/sessions/:id/attendance` | Date pills with counts, KPIs, present toggles, "Mark all present", "Add walk-in", check-in QR |
| `/manage/sessions/:id/feedback` | KPIs (responses & rate, satisfaction, relevance, NPS), custom rating averages, comments |
| `/manage/sessions/:id/details` | Edit session; delete with confirmation |
| `/manage/registry` | Searchable participant table; click → profile with journey across sessions/pillars |
| `/manage/data` | Table list with row counts and CSV export; indicator descriptions |

Modals: New session (intervention, title, dates multi-select, mode, capacity, venue, facilitator, deadline if selective, "Start forms from"), Form editor (locked core + editable custom questions: add, reorder, delete, type, options, required), Rubric editor, Application detail (profile, answers, 1–5 scoring per criterion, live weighted score, status, notify).

Public (no login), mobile-first:
| Route | Screen |
|---|---|
| `/f/:code` | Renders the right form for the code (intake / check-in / feedback), shows pillar, intervention, session title, dates, venue. Closed/draft → "This form is not accepting responses". Success screen shows participant ID. |

## 8. Roles & security (Supabase RLS)

- `admin` (MELA team): everything, all pillars.
- `pillar_lead` / `pillar_staff`: read/write only sessions where `pillar` ∈ their assigned pillars; can review and score applications.
- `reviewer`: read applications + write own scores for assigned sessions.
- `dashboard_reader`: select on reporting views only.
- Public submissions go through the `/api/forms/[code]/submit` Route Handler, which calls **security-definer RPCs** (`submit_intake`, `submit_checkin`, `submit_feedback`), never direct table inserts. The service-role key stays server-side only. Add rate limiting (e.g. Upstash or Vercel KV) and a honeypot field.
- Protect `/manage` and `/dashboard` routes with the Next.js proxy (`src/proxy.ts`) using the Supabase session; check role/pillar in Server Actions as well as RLS.
- Personal data: consent timestamp stored; participant export restricted to admin; support deleting a participant on request (anonymise in place to keep aggregate counts). Comply with Rwanda's data protection law.

## 9. Notifications

On status change (selected / shortlisted / waitlisted / not selected) and on registration, staff can send templated emails (templates from `notifyText()` in the prototype). Queue + log in an `email_log` table. Phase 2: reminders 24 h before a session; feedback request after the last date.

## 10. Build order (milestones)

1. **Foundation**: in this single Next.js app, add the `/manage` staff routes (§7), the `/f/[code]` route and the `/dashboard` placeholder; Supabase SSR client + proxy auth; schema migrations; seed interventions; sidebar layout. Keep `/dashboard` routes free for the dashboard.
2. **Sessions & forms**: create session (auto-generate forms, codes, rubric, copy-from), form editor, form status, QR/share.
3. **Public forms**: `/f/:code`, DynamicForm, submission RPCs with all §4 rules, success screens.
4. **People & selection**: registrations/applications tab, status changes, bulk actions, scoring, status history.
5. **Attendance & feedback**: per-date attendance, walk-ins, feedback analytics tab.
6. **Registry, Overview, Data**: needs-attention queries, participant journey, CSV export, reporting views + dashboard role.
7. **Notifications, RLS hardening, tests, deploy** (Vercel). Point the dashboard's queries at the reporting views.

## 11. Acceptance criteria (must pass)

- Creating a Masterclass session produces 3 forms with unique codes; a selective session also produces a rubric.
- Registering twice with the same email (different case) for the same session → error; for a different session → same PID reused.
- Open session at capacity → next registration is waitlisted.
- Check-in fails for unregistered (open) / non-selected (selective) emails and for duplicate same-date check-ins.
- Feedback fails without attendance; succeeds once with attendance; second attempt fails.
- Weighted score matches formula in §4.13.
- Pillar staff cannot read another pillar's sessions (RLS test).
- `v_session_summary` numbers match the session page KPIs.
- Public forms usable on a 360 px wide phone.

## 12. Open questions for the MELA team

- Confirm open/selective type for each intervention (especially SIE, Courses, At a Glance, Impact Stories, Research Activities).
- Multiple reviewers per application, or one?
- Is "completed" at 75 % of dates right for every programme?
- Does any intervention need pre/post outcome surveys or 3–6 month follow-ups (phase 2)?
- What database/ORM does the existing Next.js dashboard use? If not Supabase, adapt §2–§3 to it.
