# dms_demo

MELA Intervention Manager and dashboard, in one Next.js app.

- `/manage`: Intervention Manager (staff). Spec: [SPEC.md](SPEC.md)
- `/dashboard`: analytics dashboard (placeholder)
- `/f/[code]`: public forms

## Setup

Requires Node 20+, Docker (for local Supabase) and npm.

```bash
npm install
npx supabase start            # local Postgres, Auth and Studio (needs Docker)
cp .env.example .env.local    # then fill in the keys from `npx supabase status`
npx supabase db reset         # applies supabase/migrations and seed.sql
npm run dev                   # http://localhost:3000
```

Staff accounts are created in Supabase Studio (http://127.0.0.1:54323). After creating a user, add a row to `staff_roles` with `role = 'admin'`. Without that row the user can sign in but sees "no staff role".

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (`src/**/*.test.ts(x)`) |
| `npm run test:e2e` | Playwright tests (`e2e/`); starts the dev server |
| `npm run db:types` | Regenerates `src/lib/supabase/database.types.ts` from the local database |

## Secrets

`.env.local` and any `SUPABASE_SERVICE_ROLE_KEY` value stay out of git. Only `.env.example` (with empty values) is committed.

## License

See [LICENSE](LICENSE).
