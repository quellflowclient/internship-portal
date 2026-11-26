# 13 – Roadmap

| Phase | Scope | Exit criteria | Est. |
|---|---|---|---|
| **0 – Decisions & content** | Close P0 items in 16_DECISIONS_LOG; finalise document designs (letterhead, certificate); fee/stipend/refund with CA | All P0 decisions closed; template designs approved | 1 week |
| **1 – Foundation** | Scaffold repo; Supabase project; schema + enums + helpers + RLS for identity, applicants, programmes, batches, enrolments; Google auth + invites; applicant import (webhook + backfill); admin applicants UI | RLS test suite green; real applicants visible to admin only | 1–1.5 weeks |
| **2 – Run Track A (MVP)** | Playbook import & editor; plan record; diagnostic scoring; tasks board; daily/weekly/blockers; mentor dashboard & reviews; live sessions; announcements; completion record; **documents (offer, certificate, experience letter) + verify page** | First Track A batch runs fully in portal; one certificate issued and verified by QR on a phone | 2–3 weeks |
| **3 – Track B** | Courses/lessons/quizzes/assignments; grading; Razorpay + invoices + enrollment letter; capstone; certificates for Track B | First paid batch enrolled and paid via portal | 2–3 weeks |
| **4 – Scale** | n8n reminders (WhatsApp/email), analytics, LOR workflow, DSC signing, college/TPO read-only view, white-label prep | Defined per batch feedback | ongoing |

## Phase 1 task list (status 26-Nov-2026)
- [ ] Create Supabase projects (staging, prod) in Mumbai region – **waiting for owner access**
- [x] Next.js 15 + TypeScript + Tailwind v4 + ESLint + Vitest (custom UI kit instead of shadcn CLI; Playwright later)
- [x] Migrations: enums, org_settings, roles_catalog, profiles, invitations, numbering_schemes, document_sequences, signatories, applicants(+history), programs, program_pricing, batches, batch_mentors, enrollments, enrollment_terms, audit_log, helpers, RLS, grants
- [x] Auth: Google + email link, invite-only activation (`handle_new_user`), middleware, role-guarded route groups (admin / mentor / student)
- [x] `/api/applicants/import` + HMAC (timestamped) + Apps Script add-on (`scripts/apps-script/portal_sync.gs`) + backfill
- [x] Admin: overview, applicants (filters, search, pagination, detail, status, notes, history), convert → enrolment with engagement type, programs & batches, mentor assignment, users & invitations, settings (org, academic year, numbering with live preview, signatories)
- [x] RLS tests (PGlite, 27 cases) + unit tests (20 cases)
- [ ] Connect real Supabase: `supabase link`, `supabase db push`, Google OAuth client, env vars, bootstrap first super_admin
- [ ] Deploy (hosting + domain from owner)

## Definition of done (every feature)
Spec in docs updated · migration with RLS · server-side validation · mobile layout checked at 360px · tests (unit + RLS where data access changes) · audit log for sensitive actions · no secrets in client bundle.
