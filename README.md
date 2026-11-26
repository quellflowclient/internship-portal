# Quellflow Internship Portal

One portal to run Quellflow's internship and training programmes end to end: applicants → selection → onboarding → daily work / courses → mentor reviews → projects → completion → **verifiable documents** (offer letter, certificate, experience letter, LOR).

> **Status (26-Nov-2026):** Phase 1 code done locally – schema, RLS, auth, admin (applicants, programs, users, settings), Google Form import API. Waiting for Supabase project access to connect and deploy. See [13_ROADMAP.md](docs/13_ROADMAP.md).

## Getting started (developers)
```bash
pnpm install
cp .env.example .env.local      # fill in Supabase URL/keys + IMPORT_SECRET
pnpm test                       # 47 tests: RLS (PGlite) + unit – no Docker needed
pnpm dev                        # http://localhost:3000
```

### Connect a Supabase project (once access is shared)
1. `npx supabase login` → `npx supabase link --project-ref <ref>`
2. `npx supabase db push` (applies `supabase/migrations/*`), then run `supabase/seed.sql` in the SQL editor.
3. Auth → Providers → Google: add OAuth client ID/secret; Auth → URL configuration: site URL + `<site>/auth/callback`.
4. Sign in once with the first partner's Google account, then in SQL editor: `select public.bootstrap_super_admin('<email>');`
5. Admin → Settings: check org details, academic year and numbering formats.
6. Google Apps Script: add `scripts/apps-script/portal_sync.gs`, set `PORTAL_IMPORT_URL` + `PORTAL_IMPORT_SECRET`, run `testPortalConnection`, then `backfillPortal`.

## Docs index

| # | File | What it answers |
|---|---|---|
| 00 | [Product overview](docs/00_PRODUCT_OVERVIEW.md) | Why, who, scope, success metrics |
| 01 | [Program model](docs/01_PROGRAM_MODEL.md) | Track A (merit) / B (paid training) / C (self-paced), durations, rules |
| 02 | [Playbook → portal mapping](docs/02_PLAYBOOK_MAPPING.md) | How the 7 role playbooks in `project-docs/` become portal data |
| 03 | [Roles & permissions](docs/03_ROLES_PERMISSIONS.md) | RBAC matrix: super_admin, admin, mentor, student, public |
| 04 | [User flows](docs/04_USER_FLOWS.md) | Step-by-step journeys with diagrams |
| 05 | [Features & MVP spec](docs/05_FEATURES_MVP.md) | Every module with acceptance criteria |
| 06 | [Data model](docs/06_DATA_MODEL.md) | Tables, columns, enums, relations |
| 07 | [RLS policies](docs/07_RLS_POLICIES.md) | Supabase Row Level Security rules (SQL) |
| 08 | [Documents & certificates](docs/08_DOCUMENTS_CERTIFICATES.md) | Document types, numbering, templates, generation, verification, anti-forgery |
| 09 | [Courses – Track B](docs/09_COURSES_TRACK_B.md) | Paid training course structure, grading |
| 10 | [Architecture](docs/10_ARCHITECTURE.md) | Stack, repo layout, integrations, environments |
| 11 | [UI / UX guide](docs/11_UI_UX_GUIDE.md) | Brand, sitemap per role, responsive rules |
| 12 | [Security & privacy](docs/12_SECURITY_PRIVACY.md) | DPDP, secrets, audit, file access |
| 13 | [Roadmap](docs/13_ROADMAP.md) | Phases, milestones, definition of done |
| 14 | [Testing & QA](docs/14_TESTING_QA.md) | Test strategy and checklists |
| 15 | [Student FAQ bank](docs/15_FAQ_BANK.md) | Questions students will ask + answers to finalise |
| 16 | [Decisions log](docs/16_DECISIONS_LOG.md) | Open and closed decisions |

## Reference material
- `project-docs/` – 7 role playbooks (Fullstack, Backend, AI Automation, DevOps, AI/ML, BDA, SEO). Source of truth for mentor-led programme content. **Kept local only (git-ignored) – company material, not for the public repo.**
- Intake form + automation (already live): `Quellflow/docs/##/hiring/` (Google Form → Sheet → Apps Script).
- Programme plan (business view): `Quellflow/docs/##/hiring/program_plan/00_MASTER_PLAN.md`.

## Stack (proposed – see 10_ARCHITECTURE)
Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, Storage, RLS) · Tailwind + shadcn/ui · pdfme (documents) · Razorpay · Google Meet / Calendar · n8n · email provider (TBD).
