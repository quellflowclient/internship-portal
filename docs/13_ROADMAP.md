# 13 – Roadmap

| Phase | Scope | Exit criteria | Est. |
|---|---|---|---|
| **0 – Decisions & content** | Close P0 items in 16_DECISIONS_LOG; finalise document designs (letterhead, certificate); fee/stipend/refund with CA | All P0 decisions closed; template designs approved | 1 week |
| **1 – Foundation** | Scaffold repo; Supabase project; schema + enums + helpers + RLS for identity, applicants, programmes, batches, enrolments; Google auth + invites; applicant import (webhook + backfill); admin applicants UI | RLS test suite green; real applicants visible to admin only | 1–1.5 weeks |
| **2 – Run Track A (MVP)** | Playbook import & editor; plan record; diagnostic scoring; tasks board; daily/weekly/blockers; mentor dashboard & reviews; live sessions; announcements; completion record; **documents (offer, certificate, experience letter) + verify page** | First Track A batch runs fully in portal; one certificate issued and verified by QR on a phone | 2–3 weeks |
| **3 – Track B** | Courses/lessons/quizzes/assignments; grading; Razorpay + invoices + enrollment letter; capstone; certificates for Track B | First paid batch enrolled and paid via portal | 2–3 weeks |
| **4 – Scale** | n8n reminders (WhatsApp/email), analytics, LOR workflow, DSC signing, college/TPO read-only view, white-label prep | Defined per batch feedback | ongoing |

## Phase 1 task list
- [ ] Create Supabase projects (staging, prod) in Mumbai region
- [ ] `pnpm create next-app` + Tailwind + shadcn/ui + ESLint/Prettier + Vitest + Playwright
- [ ] Migrations: enums, profiles, roles_catalog, applicants(+history), programs, batches, batch_mentors, enrollments, audit_log, helpers, RLS, grants
- [ ] Auth: Google provider, invite flow, role claim hook, protected route groups
- [ ] `/api/applicants/import` + HMAC + Apps Script change + backfill from Sheet
- [ ] Admin: applicants table, filters, detail, status change, convert → enrolment
- [ ] RLS tests (see 14)

## Definition of done (every feature)
Spec in docs updated · migration with RLS · server-side validation · mobile layout checked at 360px · tests (unit + RLS where data access changes) · audit log for sensitive actions · no secrets in client bundle.
