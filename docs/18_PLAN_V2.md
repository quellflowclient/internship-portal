# 18 – Plan v2: CRM + HRMS + PMS + Student 360 (for review)

Status: **v2.1 – owner decisions applied (27-Nov-2026, §14). Freeze after the final screen review, then build.** Nothing here is implemented yet.

> **Big simplification (v2.1):** the portal stores **no files**. Screenshots, KYC, proofs and generated letters live on the office PC in one fixed folder tree (§6.9). The portal records the details, a payment note and the exact local file path, which keeps the free Vercel/Supabase plans enough.
Supersedes the mentor-led parts of docs 01–05 where they conflict.

## 1. What changed (owner decisions, 27-Nov-2026)

| # | Decision |
|---|---|
| V2-1 | Google Form gives **leads**. The team finalises by **call / email**. The portal is the CRM for that. |
| V2-2 | **No mentor role.** Staff = **admin** (admin = super admin = mentor). Other users = **students**. |
| V2-3 | Students come in **3 types: Paid, Free, Stipend**. |
| V2-4 | **Paid and Free take the same course in the same batch.** Free seats are for friends (complimentary). |
| V2-5 | **Stipend** = strong students: the same batch **plus** live project work, stipend **₹0 to a capped amount per month**. |
| V2-6 | HR-style records: who is who, dates, mode, payments and stipends (note + locally saved screenshot), kept **monthly**. |
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
| Money | One-time fee, treated as a **deposit**, usually < ₹5,000. **Tracking only**: amount, status, date, payment note | ₹0. Reason recorded (friend / referral) and approved by an admin | Amount agreed by email. The admin enters it per month (no cap, no formula) |
| Monthly HR record | Fee received or pending | Attendance and progress | Monthly row: amount, paid on, payment note, screenshot saved ✓ |
| Documents | Joining letter, certificate, project certificate | Joining letter, certificate | Offer letter, certificate, **experience letter** |
| Visible to the student | Their own fee amount and status (view only) | Nothing about money | Their own monthly stipend status (view only) |

**Payment flow (no uploads):** the student pays by GPay and sends the screenshot on WhatsApp. The admin saves it on the PC under the file name the portal shows, then marks the fee received (or the stipend paid) with a note such as *"GPay to Quellflow HDFC ••21 · checked by Dharmik · UTR 6123…"*.

Changing type (for example Free → Stipend after strong work) is allowed. It is logged and takes effect from a date.

## 4. Modules

| Module | Category | What it covers |
|---|---|---|
| **Leads & follow-ups** | CRM | Pipeline from the form, call/email log, next follow-up, convert to student |
| **Students** | HRMS + Student 360 | Directory, full profile, KYC, dates, status, timeline |
| **Batches & courses** | Academic | Course catalogue, batch creation, roster, schedule |
| **Fees** | Finance (Paid) | One-time deposit per paid student: amount, status, date, payment note, local screenshot path (tracking only) |
| **Stipends** | Payroll (Stipend) | Agreed amount, a monthly row per student, mark paid with a note, local screenshot path |
| **Attendance & daily updates** | HRMS | Daily presence from updates and live sessions, leave, monthly summary |
| **Projects** | PMS | Live projects, members, kanban tasks, weekly progress |
| **Documents** | Docs | Offer / joining / certificate / experience / LOR generated on demand, saved locally, QR verify from the DB |
| **Dashboard & reports** | Analytics | Funnel, active students by type, fees collected vs due, stipend payable |
| **Settings** | Admin | Org, numbering, signatories, course plans (30/60/90 + price + benefits), local files root, payment instructions, lead sources, admins |
| **Student portal** | Self-service | My batch, today, tasks, daily update, fees/stipend, documents, profile |

## 5. Lifecycles

```
Lead:     New → Contacted → Interested → Follow-up → Offer sent → Joined (converted)
                      ↘ Not interested · No response · Not eligible   (closed, with reason)
Student:  Offer sent → Confirmed → Active → Completed
                                      ↘ On hold → Active  ·  Dropped / Terminated (with reason)
Fee:      Pending → Received                 (Waived for Free seats; Refunded with a note)
Stipend:  Pending (row auto-created on the 1st) → Paid (note + screenshot saved locally) · On hold · Skipped
Task:     Backlog → To do → In progress → Review → Done
```

## 6. Data – tables and fields

`*` = required. All tables: `id`, `created_at`, `updated_at`, `created_by`. Money is in INR with paise precision. Dates are stored in UTC and shown in IST.

### 6.1 People
**profiles** (one per login): `role*` (admin|student) · `is_owner` · `full_name*` · `display_name_on_docs` · `email*` · `phone*` · `whatsapp` · `dob` · `gender` (optional) · `address`, `city`, `state`, `pincode` · `college`, `university`, `course`, `branch`, `year_of_study`, `graduation_year`, `college_roll_no` · `linkedin_url`, `github_url`, `portfolio_url` · `photo_path` · `emergency_name`, `emergency_phone`, `emergency_relation` · `is_active*`

**local_files** (a register of files kept on the PC – nothing uploaded): `profile_id` · `entity` (kyc, fee, stipend, document, project, other) + `entity_id` · `kind*` (photo, college_id, id_proof, college_noc, fee_screenshot, stipend_screenshot, offer_letter, certificate…) · `local_path*` (generated, §6.9) · `saved*` (yes/no – admin ticks it) · `received_via` (whatsapp, email, in_person) · `note`

### 6.2 CRM
**leads** (replaces `applicants`; all form answers kept): `candidate_code*` · `form_response_id` · all form fields (name, email, phone, city, college, course, year, role, skills, portfolio, CV, start, hours, mode, extra) · `source*` (google_form, referral, college_tpo, whatsapp, linkedin, walk_in, other) · `source_detail` · **`stage*`** · `owner_id` (admin handling it) · `priority` (hot, warm, cold) · `expected_type` (paid, free, stipend) · `next_follow_up_at` · `last_contacted_at` · `closed_reason` · `profile_id` (after joining)

**activities** (one log for leads and students = the 360 timeline): `lead_id` or `profile_id*` · `kind*` (call, email, whatsapp, meeting, note) · `direction` (outgoing, incoming) · `outcome` (connected, no_answer, busy, wrong_number, interested, not_interested, callback, other) · `summary*` · `duration_min` · `follow_up_at` · `created_by*`

### 6.3 Academic
**courses**: `code*` (AA, GA, FS, SE, QA, DO, ML…) · `name*` · `description` · `syllabus_url` · `active`
**course_plans** (each course is sold as 30 / 60 / 90-day plans – D-27): `course_id*` · `duration_days*` (30, 60, 90) · `price_inr*` · `benefits*` (list, e.g. "Certificate", "+ mini project", "+ live project + LOR on merit") · `active`

**batches**: `code*` (auto `AA30-2612-1` = course + days - YYMM - n) · `name*` · `course_plan_id*` · `start_date*` · `duration_days*` (from the plan) · `end_date` (computed: start + days − 1) · `schedule_days` (Mon–Fri) · `session_time` (e.g. 6–7 pm IST) · `live_link` · `whatsapp_group_link` · `capacity` · `status*` (planned, open, running, completed, cancelled) · `coordinator_id` (admin) · `notes`

**enrollments** (a student in a batch): `profile_id*` · `lead_id` · `batch_id*` · **`type*`** (paid, free, stipend) · `status*` · `offer_date` · `joining_date` (actual first day) · `start_date*` · `planned_end_date*` · `actual_end_date` · `mode*` (remote, hybrid, on-site) · `weekly_hours` · `college_internship_required` (yes/no) · `college_noc_received` · `free_reason` (when Free) · `approved_by` (when Free) · `drop_reason` · `final_grade` · `certificate_status`
**enrollment_type_changes**: `enrollment_id*` · `from_type*` · `to_type*` · `effective_from*` · `reason*` · `changed_by*`

### 6.4 Fees (Paid) – tracking only (D-24, D-25)
**fee_records** (one per paid enrolment): `enrollment_id*` · `amount*` (pre-filled from the course plan price, editable) · `status*` (pending, received, waived, refunded) · `received_on` · `payment_note` (free text: "GPay to HDFC ••21 · checked by Dharmik · UTR …") · `screenshot_saved` (yes/no) · `local_path` (generated) · `refund_note`
No instalments, receipts, GST or verification workflow.

### 6.5 Stipend (D-22, D-23)
**stipend_terms**: `enrollment_id*` · `monthly_amount*` (agreed by email, entered by the admin – no cap) · `effective_from*` · `effective_to` · `terms_note` (where it was agreed, e.g. "email 12 Nov") — **no bank details stored**
**stipend_payouts** (one row per stipend student per month, created on the 1st): `enrollment_id*` · `month*` (2026-11) · `amount*` (pre-filled from the terms, editable – pro-rata or hold decided by the admin) · `status*` (pending, paid, on_hold, skipped) · `paid_on` · `payment_note` · `screenshot_saved` · `local_path` · `attendance_pct` (shown for information only)

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
**documents** (as in doc 08, adds `joining_letter`). The portal **generates the PDF on demand** (download), keeps only the number, data snapshot, SHA-256 and the `local_path` where the admin saved it. The QR verify page works from the database, so no PDF storage is needed.
**org_settings** adds: `local_files_root` (e.g. `D:\Quellflow-Records`) · `file_name_patterns` (editable, §6.9) · `payment_instructions` (text shown to paid students, e.g. "Pay by GPay to … and WhatsApp the screenshot to …") · `lead_sources[]` · `working_days` (Mon–Fri) · `holidays[]`

### 6.9 Local files convention (fixed, shown by the portal with a copy button)
```
<local_files_root>\<academic year>\
  students\<STUDENT-CODE>_<First-Last>\        e.g. QF-2627-0012_Riya-Shah
    01_kyc\        PHOTO_<code>.jpg · COLLEGEID_<code>.jpg · IDPROOF_<code>.jpg · NOC_<code>.pdf
    02_fees\       FEE_<code>_<YYYY-MM-DD>_<amount>.jpg
    03_stipend\    STP_<code>_<YYYY-MM>_<amount>.jpg
    04_documents\  <DOCTYPE>_<doc-number with - instead of />.pdf   e.g. OFR_QF-OFR-2627-0007.pdf
    05_projects\   (any project files)
    06_other\
  batches\<BATCH-CODE>\                         attendance exports, session notes
  payroll\<YYYY-MM>\                            monthly stipend export (CSV from the portal)
```
Rules: the student code is the Google Form **Candidate ID** (QF-2627-0012) and never changes. Names use `-` instead of spaces, with no special characters. The portal builds every path from the root in Settings, so moving the root only means changing one setting. **Back up this folder** (e.g. OneDrive / Google Drive sync) – it is the only copy of proofs.

## 7. Batches – rules
- A batch = **one course + one start date**. Paid, Free and Stipend students all sit in it. Stipend students also join ≥1 project.
- **Create batch:** choose a course plan (e.g. AI Automation · 30 days) → start date → the end date fills in automatically → days/time of the live session → capacity → links. The code is generated (`AA30-2612-1`).
- **Add students:** from a lead (Convert → choose batch + type) or from the batch roster ("Add student").
- The roster shows a type badge, status, joined date, attendance %, fee/stipend status, and project for stipend students.
- **"Days of paid internship"** = `duration_days` of the batch (calendar days). Progress = day X of N.

## 8. Monthly cycles (automated, Vercel Cron)
| When (IST) | Job |
|---|---|
| Daily 09:00 | Admin digest: today's follow-ups, overdue fees, students with no update yesterday |
| Daily 19:00 | Reminder to students with no daily update today |
| 1st of month 09:00 | Create **stipend rows** for last month (amount from the terms, attendance for information) → the admin edits the amount if needed → marks paid with a note → saves the screenshot locally |
| Daily | List paid rows where the screenshot is not marked saved (in the admin digest) |
| Batch end date | Move to "Completed?" review → certificate drafts |

## 9. Screens (wireframes canvas: https://claude.ai/artifact/CVxiNwpDfhSAjdQMLFc1Lb – private, owner shares)
Admin: Dashboard · Leads (pipeline + list) · Lead detail · Students (directory) · Student 360 · Batches · Create batch · Batch detail · Fees · Stipend payroll · Projects board · Settings
Student: Home (mobile) · Fees/Stipend · Tasks · Daily update · Documents · Profile/KYC

## 10. Vercel-friendly architecture
- **Next.js App Router on Vercel + Supabase (Mumbai).** Set the Vercel function region to **`bom1` (Mumbai)** in `vercel.json` so functions sit next to the database. The default US region adds about 250 ms to every query.
- **Vercel plan (D-28):** **Hobby while testing**, Pro once it goes into real use. Hobby is for non-commercial use, and its crons run at most once a day, so every job in §8 is designed as a once-a-day job.
- **Crons:** `vercel.json` → `/api/cron/*` (protected by `CRON_SECRET`). Cron times are in **UTC** (09:00 IST = 03:30 UTC).
- **Files: none in the cloud.** No Supabase Storage, no Vercel Blob. Everything is local (§6.9), so database size stays tiny and the free tiers last.
- **PDFs** (letters, certificates): pdfme in Node route handlers, generated on demand for download (not stored), well within function time limits. Bulk generation goes in batches of ~20 per request.
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
| [pdfme/pdfme](https://github.com/pdfme/pdfme) | MIT | Letters and certificates |
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
- `programs` → `courses`. `batch_mentors` removed. `enrollment_terms` is replaced by `fee_records` / `stipend_terms`; new `course_plans`, `local_files`.
- The mentor area is removed. The admin nav is rebuilt around the new modules.

## 13. Build order (after this plan is frozen)
| Step | Scope | Rough effort |
|---|---|---|
| A | Schema v2 + RLS + tests, roles change, data migration | 1 working session |
| B | CRM: leads pipeline/list, lead detail, activity log, follow-ups, convert | 1–2 sessions |
| C | Students directory + Student 360 + KYC + batches/courses | 2 sessions |
| D | Fees tracking + Stipend monthly rows + local file paths | 1 session |
| E | Attendance/daily updates + student portal | 1–2 sessions |
| F | Projects (kanban) | 1 session |
| G | Documents/PDF + crons + email (needs SMTP) | 1–2 sessions |

## 14. Decisions (answered 27-Nov-2026)
| ID | Decision |
|---|---|
| D-21 | ✅ Yes: `is_owner` flag on 1–2 admin accounts for destructive actions (delete, revoke, numbering, full export). |
| D-22 | ✅ **No bank details** and no proof uploads. Only a free-text payment note ("Pay via GPay to XX account, checked by Name") + the local file path of the screenshot. |
| D-23 | ✅ Stipend amount, rules and T&C are agreed by email. The admin enters and updates the amount in the portal. No cap and no formula. |
| D-24 | ✅ The fee is fixed and small (mostly < ₹5,000), paid at once, treated as a **deposit**. Portal = **tracking only** (amount, status, date, note). |
| D-25 | ✅ Students send the screenshot on **WhatsApp**. The admin saves it locally. The portal keeps the path + a rough note. No student uploads. |
| D-26 | ✅ Lead stages and sources as in §5. |
| D-27 | ✅ Every course has separate **30 / 60 / 90-day** plans, each with its own price, benefits and batches. |
| D-28 | ✅ Hobby (free) while testing. Pro after go-live. |

Still open: actual plan prices and benefits per course (entered later in Settings → Courses), and the local files root folder on the office PC.
