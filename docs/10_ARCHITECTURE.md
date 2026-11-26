# 10 – Architecture

## Stack
| Layer | Choice | Notes |
|---|---|---|
| Web app | **Next.js (App Router) + TypeScript** | Server components, server actions, route handlers |
| UI | Tailwind CSS + shadcn/ui + lucide icons | Brand tokens in 11_UI_UX_GUIDE |
| DB / Auth / Storage | **Supabase** (Postgres + RLS, Auth with Google, Storage) | Cloud, region **ap-south-1 (Mumbai)** – D-08 |
| Documents | **pdfme** (MIT) – `@pdfme/generator`, designer for templates | QR via pdfme barcode plugin (verify support) or `qrcode` image |
| Payments | Razorpay (orders + webhook) | Phase 3 |
| Live sessions | Google Calendar API → Meet links (service account / workspace) | Fallback: paste Zoom/Meet link |
| Email | Resend / Brevo / Google Workspace SMTP – D-10 | Transactional only |
| Automation | **n8n** (already used by Quellflow) | Reminders, WhatsApp, Sheet sync |
| Video | YouTube unlisted / Bunny Stream – D-11 | Embedded in lessons |
| Hosting | Vercel (simplest) or existing EC2 – D-12 | `learn.quellflow.com` |
| Monitoring | Sentry (errors), Supabase logs, uptime check | |

### Alternatives evaluated (Nov 2026)
- **Frappe LMS** (AGPL-3.0, Frappe/Vue): courses, batches, Zoom live classes, assignments, quizzes, certificates. Gaps: Meet, public verify, Razorpay not documented, Frappe stack. → not chosen; could host Track C later.
- **LearnHouse** (AGPL core, Next.js + FastAPI): modern LMS; payments & live sessions are Enterprise-only. → not chosen.
- Custom build chosen for: RLS-based access, playbook data model, document issuance/verification as core, integration with the existing Form/Sheet/n8n, future white-label.

## Repo layout (to scaffold)
```
Internship portal/
├─ README.md · CLAUDE.md · docs/ · project-docs/ (playbooks, reference)
├─ src/
│  ├─ app/
│  │  ├─ (public)/verify/[code]/page.tsx      # public verify
│  │  ├─ (auth)/login/ · auth/callback/
│  │  ├─ (student)/today · tasks · updates · course · sessions · documents · profile
│  │  ├─ (mentor)/mentor/interns · reviews · diagnostics · sessions
│  │  ├─ (admin)/admin/applicants · programs · playbooks · batches · enrollments · documents · payments · announcements · settings
│  │  └─ api/ applicants/import · razorpay/webhook · documents/[id]/download · cron/*
│  ├─ components/ (ui/, forms/, tables/, layout/)
│  ├─ lib/ (supabase/{server,client,admin}.ts, auth/roles.ts, documents/{render,number,hash}.ts, validators/, dates.ts, phone.ts)
│  └─ server/actions/ (enrollments.ts, tasks.ts, documents.ts, …)
├─ supabase/
│  ├─ migrations/  (schema, enums, functions, RLS, storage policies)
│  ├─ seed.sql     (roles_catalog, rubric_dimensions, demo data)
│  └─ functions/   (edge functions if needed)
├─ templates/      (pdfme JSON + base PDFs, versioned)
├─ scripts/        (import-playbooks.ts – docx → JSON; backfill-applicants.ts)
└─ tests/          (unit, rls/, e2e/)
```

## Integrations
### Google Form → portal
The live Apps Script (`create_internship_form.gs`, `onApplicationSubmit`) gets one extra step: POST the processed row to `POST /api/applicants/import` with header `x-signature: HMAC-SHA256(body, IMPORT_SECRET)`. Endpoint validates, upserts by `candidate_code`/`form_response_id`. Backfill script imports existing Sheet rows.

### Razorpay
Create order server-side → Checkout on client → webhook `payment.captured` (verify signature) → payments row → invoice + enrollment letter → enrolment active. Idempotent by `razorpay_payment_id`.

### Google Meet
Server creates Calendar event with `conferenceData.createRequest` → stores `meet_url`, `calendar_event_id`; batch emails as attendees.

### n8n
Portal emits events (Supabase Database Webhooks or `notifications` table) → n8n: WhatsApp/email reminders (live session −1h, missing daily update 7 pm, assignment due), weekly digest to mentors.

## Environments
`local` (Supabase CLI + Docker) → `staging` (separate Supabase project, test Razorpay keys) → `prod`. Migrations applied via CI; never edit prod schema by hand.

## Env vars
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `IMPORT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `EMAIL_API_KEY`, `VERIFY_BASE_URL`, `SENTRY_DSN`.
