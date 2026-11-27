# 18 – Plan v2: CRM + HRMS + PMS + Student 360 (for review)

Status: **DRAFT – review with wireframes, then freeze fields, then build.** Nothing here is implemented yet.
Supersedes the mentor-led parts of docs 01–05 where they conflict.

## 1. What changed (owner decisions, 27-Nov-2026)

| # | Decision |
|---|---|
| V2-1 | Google Form gives **leads**. The team finalises by **call / email**. The portal is the CRM for that. |
| V2-2 | **No mentor role.** Staff = **admin** (admin = super admin = mentor). Other users = **students**. |
| V2-3 | Students come in **3 types: Paid, Free, Stipend**. |
| V2-4 | **Paid and Free take the same course in the same batch.** Free seats are for friends (complimentary). |
| V2-5 | **Stipend** = strong students: the same batch **plus** live project work, stipend **₹0 to a capped amount per month**. |
| V2-6 | HR-style records: who is who, dates, mode, payments and stipends with **proof**, kept **monthly**. |
| V2-7 | Hosting stays on **Vercel**. |

## 2. Roles

| Role | Who | Can |
|---|---|---|
| `admin` | All Quellflow staff | Everything: leads, students, batches, money, projects, documents, settings |
| `student` | Joined students of all 3 types | Their own record only: batch, schedule, tasks, daily updates, their fees **or** stipend, their documents, KYC uploads |
| public | Anyone | Certificate verify page only |

**Recommendation (decision D-21):** keep a hidden **`is_owner`** flag on 1–2 admin accounts for irreversible actions only: delete data, revoke documents, change numbering, export everything. For daily work all admins are equal.

## 3. Student types

| | **Paid** | **Free** | **Stipend** |
|---|---|---|---|
| Course and batch | Same course, same batch | Same as Paid | Same batch **+ live project** |
| Money | Student pays the fee (one-time or instalments) | ₹0. Reason recorded (friend / referral / scholarship) and approved by an admin | Quellflow pays ₹0–cap per month |
| Monthly HR record | Fee due, paid, overdue, receipts | Attendance and progress | Attendance, performance, payout, UTR, proof, slip |
| Documents | Joining letter, receipts, certificate, project certificate | Joining letter, certificate | Offer letter, stipend slips, certificate, **experience letter** |
| Visible to the student | Their own fee status | Nothing about money | Their own stipend status |

Changing type (for example Free → Stipend after strong work) is allowed. It is logged and takes effect from a date.

## 4. Modules

| Module | Category | What it covers |
|---|---|---|
| **Leads & follow-ups** | CRM | Pipeline from the form, call/email log, next follow-up, convert to student |
| **Students** | HRMS + Student 360 | Directory, full profile, KYC, dates, status, timeline |
| **Batches & courses** | Academic | Course catalogue, batch creation, roster, schedule |
| **Fees** | Finance (Paid) | Fee plan, instalments, payments with proof, receipts, overdue |
| **Stipends** | Payroll (Stipend) | Terms, monthly payout run, approve, pay, proof, slip |
| **Attendance & daily updates** | HRMS | Daily presence from updates and live sessions, leave, monthly summary |
| **Projects** | PMS | Live projects, members, kanban tasks, weekly progress |
| **Documents** | Docs | Offer / joining / certificate / experience / LOR / slips / receipts with QR verify |
| **Dashboard & reports** | Analytics | Funnel, active students by type, fees collected vs due, stipend payable |
| **Settings** | Admin | Org, numbering, signatories, stipend cap, payment details, lead sources, admins |
| **Student portal** | Self-service | My batch, today, tasks, daily update, fees/stipend, documents, profile |

## 5. Lifecycles

```
Lead:     New → Contacted → Interested → Follow-up → Offer sent → Joined (converted)
                      ↘ Not interested · No response · Not eligible   (closed, with reason)
Student:  Offer sent → Confirmed → Active → Completed
                                      ↘ On hold → Active  ·  Dropped / Terminated (with reason)
Fee:      Due → Partially paid → Paid        (Overdue when past the due date; Waived; Refunded)
Payment:  Submitted (proof uploaded) → Verified / Rejected
Stipend:  Draft (auto on the 1st) → Approved → Paid (UTR + proof) · On hold · Cancelled
Task:     Backlog → To do → In progress → Review → Done
```

## 6. Data – tables and fields

`*` = required. All tables: `id`, `created_at`, `updated_at`, `created_by`. Money is in INR with paise precision. Dates are stored in UTC and shown in IST.

### 6.1 People
**profiles** (one per login): `role*` (admin|student) · `is_owner` · `full_name*` · `display_name_on_docs` · `email*` · `phone*` · `whatsapp` · `dob` · `gender` (optional) · `address`, `city`, `state`, `pincode` · `college`, `university`, `course`, `branch`, `year_of_study`, `graduation_year`, `college_roll_no` · `linkedin_url`, `github_url`, `portfolio_url` · `photo_path` · `emergency_name`, `emergency_phone`, `emergency_relation` · `is_active*`

**student_files** (KYC, student uploads → admin verifies): `profile_id*` · `kind*` (id_proof, college_id, photo, resume, college_noc, bank_proof, other) · `file_path*` · `status*` (submitted, verified, rejected) · `verified_by`, `verified_at`, `reject_reason`

### 6.2 CRM
**leads** (replaces `applicants`; all form answers kept): `candidate_code*` · `form_response_id` · all form fields (name, email, phone, city, college, course, year, role, skills, portfolio, CV, start, hours, mode, extra) · `source*` (google_form, referral, college_tpo, whatsapp, linkedin, walk_in, other) · `source_detail` · **`stage*`** · `owner_id` (admin handling it) · `priority` (hot, warm, cold) · `expected_type` (paid, free, stipend) · `next_follow_up_at` · `last_contacted_at` · `closed_reason` · `profile_id` (after joining)

**activities** (one log for leads and students = the 360 timeline): `lead_id` or `profile_id*` · `kind*` (call, email, whatsapp, meeting, note) · `direction` (outgoing, incoming) · `outcome` (connected, no_answer, busy, wrong_number, interested, not_interested, callback, other) · `summary*` · `duration_min` · `follow_up_at` · `created_by*`

### 6.3 Academic
**courses**: `code*` (AA, GA, FS, SE, QA, DO, ML…) · `name*` · `default_duration_days*` (e.g. 30 / 45 / 60 / 90) · `default_fee_inr` · `description` · `syllabus_url` · `active`

**batches**: `code*` (auto `AA-2701-1` = course-YYMM-n) · `name*` · `course_id*` · `start_date*` · `duration_days*` (defaults from the course) · `end_date` (computed: start + days − 1) · `schedule_days` (Mon–Fri) · `session_time` (e.g. 6–7 pm IST) · `live_link` · `whatsapp_group_link` · `capacity` · `status*` (planned, open, running, completed, cancelled) · `coordinator_id` (admin) · `notes`

**enrollments** (a student in a batch): `profile_id*` · `lead_id` · `batch_id*` · **`type*`** (paid, free, stipend) · `status*` · `offer_date` · `joining_date` (actual first day) · `start_date*` · `planned_end_date*` · `actual_end_date` · `mode*` (remote, hybrid, on-site) · `weekly_hours` · `college_internship_required` (yes/no) · `college_noc_received` · `free_reason` (when Free) · `approved_by` (when Free) · `drop_reason` · `final_grade` · `certificate_status`
**enrollment_type_changes**: `enrollment_id*` · `from_type*` · `to_type*` · `effective_from*` · `reason*` · `changed_by*`

### 6.4 Fees (Paid)
**fee_plans**: `enrollment_id*` · `gross_fee*` · `discount` · `discount_reason` · `net_fee*` · `gst_mode` (inclusive, exclusive, none – CA) · `instalments*` (1–3)
**fee_instalments**: `fee_plan_id*` · `seq*` · `due_date*` · `amount*` · `status*` (due, partial, paid, overdue, waived)
**payments** (money in): `enrollment_id*` · `instalment_id` · `amount*` · `paid_on*` · `mode*` (upi, bank_transfer, cash, card, razorpay, cheque) · `reference` (UTR / txn id) · `proof_path` · `status*` (submitted, verified, rejected, refunded) · `verified_by`, `verified_at` · `receipt_no` · `note`
→ The student can upload a payment proof themself (status *submitted*). An admin verifies it, and that issues the receipt.

### 6.5 Stipend
**stipend_terms**: `enrollment_id*` · `monthly_amount*` (≤ `org_settings.stipend_cap_inr`) · `effective_from*` · `effective_to` · `min_attendance_pct` (e.g. 75) · `payout_method*` (upi, bank) · `payee_name*` · `upi_id` · `bank_ifsc`, `bank_account_last4` (the full account number is not stored, D-22) · `pan` (optional, TDS – CA)
**stipend_payouts** (one per student per month): `enrollment_id*` · `month*` (2027-01) · `working_days` · `present_days` · `attendance_pct` · `performance` (1–5) · `base_amount*` · `adjustment` · `adjustment_reason` · `net_amount*` · `status*` · `approved_by`, `approved_at` · `paid_on` · `mode` · `reference` (UTR) · `proof_path` · `slip_document_id`

### 6.6 Attendance & updates
**daily_updates**: `enrollment_id*` · `date*` · `done*` · `next` · `blockers` · `hours` · `links` – an update on a working day counts as *present*
**attendance**: `enrollment_id*` · `date*` · `status*` (present, absent, leave, half_day, holiday) · `source*` (daily_update, live_session, manual) · `note`
**leave_requests**: `enrollment_id*` · `from_date*` · `to_date*` · `reason*` · `status*` (pending, approved, rejected) · `decided_by`
**live_sessions**: `batch_id*` · `title*` · `starts_at*` · `ends_at` · `meet_link` · `recording_url` · `host_id`

### 6.7 Projects (PMS)
**projects**: `code*` · `name*` · `kind*` (internal, client, training) · `client_name` · `description` · `start_date` · `due_date` · `status*` (planned, active, on_hold, done) · `lead_admin_id` · `repo_url`, `board_url`
**project_members**: `project_id*` · `enrollment_id*` · `role` (developer, designer, analyst, bd…) · `hours_per_week`
**tasks**: `project_id*` · `title*` · `description` · `status*` · `priority` (low, medium, high, urgent) · `assignee_enrollment_id` · `due_date` · `estimate_hours` · `spent_hours` · `sort`
**task_comments**: `task_id*` · `author_id*` · `body*`

### 6.8 Documents & settings
**documents** (as in doc 08) – adds the types `stipend_slip`, `fee_receipt`, `joining_letter`
**org_settings** adds: `stipend_cap_inr` · `fee_payee_upi_id` / bank details shown to paying students · `gst_rate` · `lead_sources[]` · `working_days` (Mon–Fri) · `holidays[]`

## 7. Batches – rules
- A batch = **one course + one start date**. Paid, Free and Stipend students all sit in it. Stipend students also join ≥1 project.
- **Create batch:** choose a course → start date → duration (pre-filled from the course, e.g. 45 days) → the end date fills in automatically → days/time of the live session → capacity → links. The code is generated (`AA-2701-1`).
- **Add students:** from a lead (Convert → choose batch + type) or from the batch roster ("Add student").
- The roster shows a type badge, status, joined date, attendance %, fee/stipend status, and project for stipend students.
- **"Days of paid internship"** = `duration_days` of the batch (calendar days). Progress = day X of N.

## 8. Monthly cycles (automated, Vercel Cron)
| When (IST) | Job |
|---|---|
| Daily 09:00 | Admin digest: today's follow-ups, overdue fees, students with no update yesterday |
| Daily 19:00 | Reminder to students with no daily update today |
| 1st of month 09:00 | Create **stipend payout drafts** for last month (attendance auto-filled) → admin reviews → approve → pay → upload UTR/proof → slip PDF |
| Daily | Instalments past their due date → **Overdue**; reminder 3 days before a due date |
| Batch end date | Move to "Completed?" review → certificate drafts |

## 9. Screens (wireframes canvas: https://claude.ai/artifact/CVxiNwpDfhSAjdQMLFc1Lb – private, owner shares)
Admin: Dashboard · Leads (pipeline + list) · Lead detail · Students (directory) · Student 360 · Batches · Create batch · Batch detail · Fees · Stipend payroll · Projects board · Settings
Student: Home (mobile) · Fees/Stipend · Tasks · Daily update · Documents · Profile/KYC

## 10. Vercel-friendly architecture
- **Next.js App Router on Vercel + Supabase (Mumbai).** Set the Vercel function region to **`bom1` (Mumbai)** in `vercel.json` so functions sit next to the database. The default US region adds about 250 ms to every query.
- **Vercel plan:** Hobby is for **non-commercial use** only. Company use needs **Pro**. Hobby crons are also limited to once a day.
- **Crons:** `vercel.json` → `/api/cron/*` (protected by `CRON_SECRET`). Cron times are in **UTC** (09:00 IST = 03:30 UTC).
- **Files (proofs, KYC, PDFs):** Supabase Storage private buckets + signed URLs, so files share the same RLS as the data. Not Vercel Blob.
- **PDFs** (receipts, slips, certificates): pdfme in Node route handlers, well within function time limits. Bulk generation goes in batches of ~20 per request.
- **Previews:** Vercel Preview deployments point at a **separate staging Supabase** project, never at prod data.
- **Performance:** server components plus TanStack Table with server-side pagination. No ISR (all data is per-user).
- **Observability:** Vercel logs + Speed Insights; audit log in the DB.

## 11. Open-source reuse (verified 27-Nov-2026)
| Repo | License | Use |
|---|---|---|
| [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm) | MIT | **Closest match** (React + Supabase + shadcn): contacts, notes, tasks, deals kanban, activity history. Reuse its CRM patterns and activity model. |
| [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) | MIT | Next.js + shadcn + TanStack Table/Form + dnd-kit kanban. Reuse the table, form and kanban components (auth is Clerk, so swap it for Supabase). |
| [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) | MIT | Admin layout and screen patterns (Vite – reference only) |
| [TanStack/table](https://github.com/TanStack/table) | MIT | Data tables (leads, students, payments) |
| [clauderic/dnd-kit](https://github.com/clauderic/dnd-kit) | MIT | Kanban (lead pipeline, project tasks) |
| [pdfme/pdfme](https://github.com/pdfme/pdfme) | MIT | Receipts, slips, letters, certificates |
| [schedule-x/schedule-x](https://github.com/schedule-x/schedule-x) | MIT | Calendar for sessions and follow-ups (later) |
| supabase/supabase `examples/auth/nextjs` | Apache-2.0 | Auth patterns (already applied) |
| [makeplane/plane](https://github.com/makeplane/plane) | AGPL-3.0 | **Reference only** – PMS ideas, do not copy code |
| [frappe/hrms](https://github.com/frappe/hrms) | GPL-3.0 | **Reference only** – payroll/attendance field ideas |
| [horilla/horilla-hr](https://github.com/horilla/horilla-hr) | LGPL-2.1 | **Reference only** – HRMS + payroll + project modules |
| [twentyhq/twenty](https://github.com/twentyhq/twenty) | check LICENSE | **Reference only** – CRM data model |

Rule: copy code only from MIT/Apache repos (keep their license notice). GPL/AGPL/LGPL are for ideas only.

## 12. Changes to what is already built (Phase 1)
Kept: auth (Google + password), invite-only, RLS approach, audit log, settings, numbering, import API, tests, deploy.
Changed in one migration (prod has no real data yet, so this is safe):
- Roles → `admin` / `student` (+ `is_owner`). `mentor` removed; `super_admin` becomes `admin` + `is_owner`.
- `applicants` → `leads` (+ stage, source, owner, priority, follow-up) and a new `activities` table.
- `programs` → `courses`. `batch_mentors` removed. `enrollment_terms` is replaced by `fee_plans` / `stipend_terms`.
- The mentor area is removed. The admin nav is rebuilt around the new modules.

## 13. Build order (after this plan is frozen)
| Step | Scope | Rough effort |
|---|---|---|
| A | Schema v2 + RLS + tests, roles change, data migration | 1 working session |
| B | CRM: leads pipeline/list, lead detail, activity log, follow-ups, convert | 1–2 sessions |
| C | Students directory + Student 360 + KYC + batches/courses | 2 sessions |
| D | Fees (plans, instalments, payments with proof, receipts) + Stipend payroll | 2 sessions |
| E | Attendance/daily updates + student portal | 1–2 sessions |
| F | Projects (kanban) | 1 session |
| G | Documents/PDF + crons + email (needs SMTP) | 1–2 sessions |

## 14. Decisions needed
| ID | Question |
|---|---|
| D-21 | Keep an `is_owner` flag for destructive actions? (recommended) |
| D-22 | Store only UPI ID / IFSC + last 4 of the bank account (recommended) or the full account number? |
| D-23 | Stipend cap ₹ per month? Attendance rule (e.g. ≥75% or pro-rata)? |
| D-24 | Fee instalments: max 2 or 3? GST inclusive or exclusive? (CA) |
| D-25 | Can students upload payment proof themselves? (recommended: yes, admin verifies) |
| D-26 | Lead sources list and stage names – OK as in §5? |
| D-27 | Course durations offered (30 / 45 / 60 / 90 days)? |
| D-28 | Vercel Pro plan for commercial use – OK? |
