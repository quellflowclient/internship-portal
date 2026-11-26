# Quellflow Internship Portal

One portal to run Quellflow's internship and training programmes end to end: applicants → selection → onboarding → daily work / courses → mentor reviews → projects → completion → **verifiable documents** (offer letter, certificate, experience letter, LOR).

> **Status:** Planning complete (v0.1, 26-Nov-2026). No application code yet. Read the docs below, close the items in [16_DECISIONS_LOG.md](docs/16_DECISIONS_LOG.md), then start Phase 1 in [13_ROADMAP.md](docs/13_ROADMAP.md).

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
