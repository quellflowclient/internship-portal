# 18 – Plan v2.4: Internship Portal (CRM · Students · Batches · Payments · Documents)

**Status:** v2.4 for final review (27-Nov-2026). v2.3 added the batch workspace, batch plan vs live track (§18) and project classification (§19). **v2.4: the database, flows, pipelines and action map are specified in [`19_DB_FLOWS_PIPELINES.md`](19_DB_FLOWS_PIPELINES.md); where it conflicts with §5, §7, §8, §10, §12 or §17 below, doc 19 wins.** The build starts after the owner freezes it. Nothing below is implemented yet.
**Final screens (clickable preview):** https://claude.ai/artifact/7XZ36hmJZDDeV6tSZhbZ7Q · older wireframes: https://claude.ai/artifact/CVxiNwpDfhSAjdQMLFc1Lb (both private – share from the Share menu).
This document replaces the mentor-led parts of docs 01–09 wherever they conflict.

---

## 1. Decisions in force

| # | Decision |
|---|---|
| V2-1 | Google Form = **leads**. The team finalises by call / email. The portal is the CRM for that. |
| V2-2 | Roles: **admin** (all staff) and **student**. No mentor role. 1–2 admins carry an **owner** flag (D-21). |
| V2-3 | Students are **Paid**, **Free** or **Stipend**. Paid and Free do the same course in the same batch. Free seats are for friends. Stipend = strong students, same batch + live project. |
| V2-4 | Courses are sold as **30 / 60 / 90-day plans**, each with its own price, benefits and batches (D-27). |
| V2-5 | **Money is tracking only.** The fee is a one-time small deposit. The stipend amount is agreed by email and entered by an admin. No bank details, no formulas (D-22, D-23, D-24). |
| V2-6 | **No files in the cloud.** Screenshots, KYC and signed copies live in one fixed folder tree on the office PC. The portal keeps paths + notes (D-25). |
| V2-7 | **Batches are track-only.** Teaching, tasks and material go through free external tools (§11). The portal records what was given and who completed it. |
| V2-8 | **All official documents come from the portal** in fixed formats: offer letter, T&C / consent acceptance, joining letter, internship certificate, experience letter, LOR. Each is unique and verifiable by QR, and every step is tracked (§9). |
| V2-9 | **Fees and stipends are one Payments section** with clear classification (§10). |
| V2-10 | **Students are created in one place and *assigned* to batches** (never "added" inside a batch) (§8). |
| V2-11 | **Single source of truth:** every fact is edited in exactly one screen. Everywhere else shows it read-only, with a link to that screen (§4). |
| V2-12 | Vercel **Hobby** (free) while testing, **Pro** after go-live (D-28). Supabase free tier. |

## 2. Design principles
1. **One owner per fact.** Each field has one "owner screen" where it is created and edited. Other screens show it and link to the owner screen (§4).
2. **Nothing important is hard-deleted.** Records are *archived*, *withdrawn* or *revoked* with a reason. Only an owner can permanently delete, and only data with no money or document attached.
3. **History is automatic.** Status changes, assignments, type changes, document actions and money entries write to the timeline (`activities`) and the `audit_log`.
4. **The portal tracks; tools deliver.** Classes, tasks and files run on free tools. The portal stores links, dates and completion.
5. **Documents are generated, never typed.** Data comes from the student/enrolment record. Fix the record, then re-issue the document.
6. **Mobile-first for students; dense tables for admins.**

## 3. Roles

| Role | Can |
|---|---|
| **admin** | Everything except owner-only actions |
| **admin + owner** | Plus: permanently delete, revoke issued documents, change numbering/templates/signatories, export all data |
| **student** | Their own record only: profile, batch info and links, their work status, their payments (view), **accept offer / T&C / consent**, download their issued documents |
| **public** | Verify page only (QR or code + name) |

## 4. Single source of truth – who owns what

| Fact | Owner screen (create / edit) | Shown read-only in (links back) |
|---|---|---|
| Person details (name, phone, college, emergency contact) | **Student 360 → Profile** | Leads (after conversion), batch roster, payments, documents |
| Application answers | **Lead detail** (from the form; never edited) | Student 360 → Application tab |
| Lead stage, owner, follow-up | **Leads** | Dashboard |
| Calls / emails / notes | **Logged from Lead detail or Student 360**, stored once in `activities` | Timelines everywhere |
| Course + 30/60/90 plans, price, benefits | **Settings → Courses** | Batches, convert form, offer letter |
| Batch (dates, schedule, links, capacity) | **Batches → Batch detail → Edit** | Student 360, student app, documents |
| **Assignment** (student ↔ batch, type, dates, mode, status) | **Student 360 → Enrolment** only (the batch Students tab links to the Students list filtered to "Not assigned") | Roster, payments, documents, dashboard |
| Stipend agreement (amount, from, note) | **Enrolment panel → Stipend agreement** | Payments, Student 360 |
| Money entries (fee, stipend month, refund) | **Payments** | Student 360 → Payments tab, batch roster, dashboard |
| Work given to a batch + completion | **Batch detail → Work log** | Student 360 → Work tab, student app |
| Projects & tasks (stipend) | **Projects** | Student 360 → Projects tab, student app |
| Issued documents | **Documents** | Student 360 → Documents tab, student app, public verify |
| Local file paths | **Recorded where the file belongs** (payment, KYC, document) and listed in `local_files` | Student 360 → Files tab |

Rule for the build: a component that shows a fact it does not own renders a **"Edit in …" link**, never an inline editor.

## 5. Lifecycles

```
Lead        New → Contacted → Interested → Follow-up → Offer sent → Converted
                        ↘ Not interested · No response · Not eligible   (closed, reason required)
Student     Created (from a lead or manually) → Active student → Alumni        · Archived
Enrolment   Assigned → Offer sent → Offer accepted → Active → Completed
                 ↘ Withdrawn (before start) · Dropped (after start) · Transferred (to another batch) – reason required
Money       Expected → Done   · On hold · Waived · Cancelled        (refund = its own entry)
Document    Draft → Issued → (Accepted, for offer/T&C/consent) → Revoked / Superseded
Work item   Given → per student: Done · Late · Missing · Excused
```

## 6. Screens (sitemap)

**Admin:** Dashboard · Leads (board + list) · Lead detail · **Students** (directory + "Add student") · **Student 360** (Overview · Profile · Application · Enrolments · Payments · Work · Projects · Documents · Files · Timeline) · **Batches** (list · create · batch detail with roster, "Assign students", work log, sessions) · **Payments** (ledger + month view) · **Projects** · **Documents** (to issue · issued · acceptances · verification log) · **Settings** (org · courses & plans · numbering · templates · signatories · local files root · payment instructions · admins).
**Student app (mobile):** Home · My plan · **Documents** (accept offer / T&C / consent, download issued PDFs) · Profile. (No payments screen for students – v2.4.)
**Public:** `/v/<token>` verify page · `/verify` (certificate number + surname).

## 7. Data model (fields)

`*` = required. Every table has `id`, `created_at`, `updated_at`, `created_by`, plus `archived_at` where archiving applies. Dates are stored in UTC and shown in IST.

**profiles** – `role*` (admin | student) · `is_owner` · `student_code` (= Google Form Candidate ID, e.g. QF-2627-0012; generated for manual adds) · `full_name*` · `name_on_documents` · `email*` · `phone*` · `whatsapp` · `dob` · `gender` · `address`, `city`, `state`, `pincode` · `college`, `university`, `course`, `branch`, `year_of_study`, `graduation_year`, `college_roll_no` · `linkedin_url`, `github_url`, `portfolio_url` · `emergency_name`, `emergency_phone`, `emergency_relation` · `is_active*` · `archived_at`

**leads** – all form answers (read-only) · `candidate_code*` · `form_response_id*` · `source*` · `source_detail` · `stage*` · `owner_id` · `priority` · `expected_type` · `next_follow_up_at` · `last_contacted_at` · `closed_reason` · `profile_id` (set on conversion)

**activities** (one timeline for everything) – `lead_id` and/or `profile_id` · `enrollment_id` · `kind*` (call, email, whatsapp, meeting, note, **system**) · `direction` · `outcome` · `summary*` · `follow_up_at` · `created_by`

**courses** – `code*` · `name*` · `description` · `active`
**course_plans** – `course_id*` · `duration_days*` (30/60/90) · `price_inr*` · `benefits*` (list) · `certificate_wording` · `active`

**batches** – `code*` (auto, e.g. `AA30-2612-1`) · `name*` · `course_plan_id*` · `start_date*` · `end_date` (auto) · `schedule_days` · `session_time` · `capacity` · `status*` (planned, open, running, completed, cancelled) · `coordinator_id` · **links:** `whatsapp_url`, `classroom_url`, `meet_url`, `playlist_url`, `drive_url`, `repo_url` (§11)

**enrollments** (= assignment of one student to one batch) – `profile_id*` · `batch_id*` · `lead_id` · `type*` (paid, free, stipend) · `status*` · `assigned_on*` · `offer_sent_on` · `offer_accepted_on` · `start_date*` (defaults to batch) · `end_date*` (defaults to batch) · `actual_end_date` · `mode*` (remote, hybrid, on-site) · `weekly_hours` · `free_reason` + `approved_by` (Free) · `college_internship_required` · `exit_reason` (withdrawn/dropped/transferred) · `transferred_to_id` · `completion_result` (completed, completed_with_distinction, not_completed) · `final_remarks`
  - One **active** enrolment per student per batch (database constraint). The same student can do another plan later, which creates a new enrolment.
**enrollment_type_changes** – `enrollment_id*` · `from_type*` · `to_type*` · `effective_from*` · `reason*`
**stipend_agreements** – `enrollment_id*` · `monthly_amount*` · `effective_from*` · `effective_to` · `agreed_via_note` ("email 12 Nov")

**money_entries** (single ledger – §10) – `enrollment_id*` · `direction*` (in, out) · `category*` (course_fee, fee_refund, stipend, bonus, reimbursement, other) · `period_month` (stipend) · `amount*` · `status*` (expected, done, on_hold, waived, cancelled) · `expected_on` · `done_on` · `payment_note` · `screenshot_saved` · `local_path` · `related_entry_id` (refund → fee)

**work_items** (per batch) – `batch_id*` · `kind*` (session, task, assignment, test, resource, announcement) · `title*` · `given_on*` · `due_on` · `channel*` (whatsapp, classroom, meet, youtube, drive, github) · `link` · `max_marks`
**work_status** – `work_item_id*` · `enrollment_id*` · `status*` (done, late, missing, excused) · `marks` · `note` – one row per student per item (bulk-marked from a grid)
**attendance** – `enrollment_id*` · `date*` · `status*` (present, absent, leave, half_day) · `source` (live_session, manual) – sessions are `work_items` of kind *session*

**projects / project_members / tasks** – as before, tracking only (status, assignee, due, link).

**document_templates** – `type*` · `version*` · `title*` · `body_template*` (fixed text with `{placeholders}`) · `requires_acceptance` · `requires_signatory` · `active` – only owners edit; every change is a new version
**documents** – `type*` · `template_id*` + `template_version*` · `profile_id*` · `enrollment_id` · `number*` (human, e.g. `QF-CERT-2627-AA-0007`) · `verify_token*` (random, unguessable, in the QR) · `data*` (frozen snapshot of every field printed) · `content_hash*` (SHA-256 of the snapshot) · `pdf_hash` (SHA-256 of the generated PDF) · `status*` (draft, issued, accepted, revoked, superseded) · `issued_by`, `issued_at` · `signatory_id` · `revoked_reason` · `supersedes_id` · `local_path` · `shared_via` + `shared_at` (whatsapp, email, in person)
**document_acceptances** (e-acceptance of offer / T&C / consent) – `document_id*` · `profile_id*` · `typed_full_name*` · `checkbox_text*` · `accepted_at*` · `ip_address` · `user_agent` · `content_hash_at_acceptance*`
**verification_scans** – `document_id` · `scanned_at*` · `method` (qr, number_search) · `result` (valid, revoked, not_found) · `ip_hash` · `country`

**local_files** – `profile_id` · `entity` + `entity_id` · `kind*` · `local_path*` · `saved*` · `received_via` · `note`
**org_settings** – organisation details · `local_files_root` · `file_name_patterns` · `payment_instructions` · `verify_base_url` · `working_days` · `holidays` · `lead_sources`

## 8. Add / assign / update / remove – rules

| Entity | Add | Update | Remove |
|---|---|---|---|
| Lead | Automatic from the form, or "Add lead" | Stage, owner, priority, follow-up (answers are read-only) | Close with a reason. Never deleted (owner can delete spam) |
| **Student** | **Only from Students** → "Add student", or **Convert** on a lead (fills the same form) | Student 360 → Profile | **Archive** (keeps history). Delete only by an owner, only with no enrolments, money or documents |
| **Assignment (enrolment)** | **Assign** an existing student: from Student 360 → "Assign to batch", or Batch detail → "Assign students" (pick from list, set type per student). A batch never creates students | Enrolment panel: type (logged as a type change), dates, mode, status | **Unassign** = Withdrawn (before start) or Dropped (after start), reason required. **Transfer** = closes this enrolment as Transferred + creates the new one, money entries and documents stay linked. Never deleted |
| Batch | Batches → Create | Batch detail → Edit (dates locked once running, unless owner) | Cancel (only with no active enrolments) → archived |
| Course / plan | Settings → Courses | Price/benefits changes apply to future assignments only (existing enrolments keep their snapshot) | Deactivate |
| Money entry | Automatic (fee expected on assignment for Paid; stipend rows on the 1st) or "Add entry" | Amount, status, note, screenshot ✓ | Cancel with a reason (no delete) |
| Work item | Batch detail → Work log → "Add" | Edit title/date/link | Delete only while no status is marked; otherwise archive |
| Document | Automatic drafts (§9) or "Create document" | **Draft only.** Issued documents are frozen; to change them, **re-issue** (creates a new version and marks the old one Superseded) | Revoke (owner, reason, shown on the verify page) |

Guards built into the database: a student can't be assigned twice to the same batch · capacity warning · a Paid assignment needs a fee amount · a Stipend assignment needs an agreement · a certificate needs `completion_result` · type changes need a reason.

## 9. Documents – issue, sign, verify, track

### 9.1 Document set and triggers
| Document | Who | Created as a draft when | Acceptance by the student |
|---|---|---|---|
| **Offer letter** (+ terms of the programme) | All types | Enrolment is assigned | ✅ Accept in the portal |
| **Terms & Conditions / Code of conduct** | All | With the offer letter | ✅ Accept |
| **Consent** (data use, photo/testimonial use, NDA/IP for stipend projects) | All (NDA/IP: Stipend) | With the offer letter | ✅ Accept (each consent separately) |
| **Joining letter** (for the college) | All | Offer accepted | – |
| **Internship certificate** (completion / with distinction) | All | Enrolment marked Completed | – |
| **Experience letter** | Stipend (real project work) | Completed + project done | – |
| **LOR** | On request, merit | Admin creates it | – |
| Under-18 student | – | Guardian consent added to the offer set | Guardian name + relation typed at acceptance |

### 9.2 How a document is produced
1. **Template** (Settings → Templates): fixed wording with placeholders (`{name}`, `{course}`, `{plan_days}`, `{start}`, `{end}`, `{mode}`, `{stipend_amount}`, `{signatory}`…). Versioned, and only owners edit it.
2. **Draft**: the portal fills it from the records (no typing). The admin can edit *only* the free-text fields the template allows (e.g. a LOR body or remarks). Wrong name or date? Fix the record and regenerate.
3. **Issue**: freezes the data snapshot, assigns the number + random verify token, stores the hashes and records who issued it.
4. **PDF**: a **digital (text) PDF** generated on demand with the QR, number, signatory name and signature image (from Settings). It is not stored in the cloud: the admin downloads it, saves it under the shown local path and shares it (WhatsApp/email), then marks "shared".
5. **Changes after issue** → **Re-issue**: new number version, old one shown as *Superseded* on the verify page. Editing the PDF outside the portal is not "valid": the verify page shows the true data, so any edited copy is exposed.

> "Editable" means editable **before issue, inside the portal**. Issued documents must be frozen, otherwise verification means nothing.

### 9.3 Student acceptance (e-sign)
Student app → Documents → opens the offer, T&C and consent → reads them → ticks "I have read and agree" → **types full name** → Accept.
The portal records: typed name, timestamp, IP, device, and the hash of the exact text accepted. The accepted version then shows "Accepted by Riya Shah on 1 Dec 2026, 18:42 IST" (printed on the PDF and visible to admins).
This is click-wrap e-acceptance, which is common for internship T&C. Aadhaar eSign (paid) can be added later for stronger signatures. Have the T&C and consent wording reviewed once by the CA/lawyer.

### 9.4 Anti-fake and professor verification
- **QR → `https://<portal>/v/<random token>`** (unguessable, so nobody can browse other students' certificates).
- The verify page shows: name, document type, course & plan, batch dates, result, issue date, number, signatory and **Valid / Revoked / Superseded**. It never shows phone or email.
- No QR? `/verify` with **certificate number + surname**.
- Optional: "Upload the PDF to check" compares the file hash (works for files exported by the portal).
- Visual: fixed layout, faint watermark of the number, microtext line with the number + name.
- **Tracking:** every scan is logged (`verification_scans`). The admin sees "verified 3 times, last on 5 Jan 2027", which is useful when a company does a background check.

### 9.5 End-of-internship automation
Batch end date → the admin opens **Batch → Close batch**: marks each student Completed / Not completed (+ remarks) → the portal **creates certificate drafts** (and experience-letter drafts for completed stipend students) → **Issue all** → **Download all (ZIP of digital PDFs)** → save to the local folders → share → mark shared.

## 10. Payments (fees + stipend, one ledger)

| Classification | Direction | Created | Typical status flow |
|---|---|---|---|
| **Course fee** (deposit) | In (from student) | Automatically on a Paid assignment (amount from the plan, editable) | Expected → Done (or Waived) |
| **Fee refund** | Out | Manually, linked to the fee entry | Expected → Done |
| **Stipend** (one per month) | Out (to student) | Automatically on the 1st for active Stipend enrolments (amount from the agreement, editable) | Expected → Done · On hold |
| **Bonus / reimbursement** | Out | Manually | Expected → Done |

**Payments screen:** month selector · totals **In / Out / Net** · tabs *All · Fees in · Stipends out · Refunds & others · Expected · Screenshot missing* · each row: student, batch, category, amount, status, date, note, screenshot ✓, file path (copy).
**Mark done:** date · payment note ("GPay to HDFC ••21 · checked by Dharmik · UTR …") · tick "screenshot saved" (shows the exact file name to use).
Student 360 → Payments and the batch roster only **show** these entries and link back here.

## 11. Teaching & task delivery – free stack (portal = tracking only)

| Need | Free tool | How |
|---|---|---|
| Announcements, quick doubts | **WhatsApp Community** (one community, one group per batch) | Link stored on the batch |
| Tasks, material, submissions, marks | **Google Classroom** (free with a Google account) – one class per batch | Post tasks with due dates; students submit there; you grade there |
| Live classes | **Google Meet** (free: 60 min for group calls) or **Jitsi Meet** (free, no time limit) | One fixed link per batch |
| Recordings / video lessons | **YouTube (unlisted playlist per course plan)**, recorded with **OBS Studio** (free) | Re-use the same playlist for every batch of that plan |
| PDFs, slides | **Google Drive** folder per course (view-only link) | Link on the batch |
| Code tasks (FS, QA, DevOps, AI) | **GitHub** (free) – template repo per task, or GitHub Classroom | Link on the work item |
| Quizzes / tests | **Google Forms quiz** | Link on the work item; marks copied to the portal |

**How the portal tracks it:** each thing you give (session, task, test, resource) becomes a **work item** on the batch (title, date, due, channel, link). After the due date, open the **completion grid** (students × items) and mark Done / Late / Missing, plus marks. Attendance is marked per session in the same grid. This feeds the certificate decision and the "result" on the verify page.
Later (free): read submissions from the Google Classroom API to pre-fill the grid.

## 12. Automations (once a day – fits Vercel Hobby)
| When (IST) | Job |
|---|---|
| 09:00 daily | Admin digest: follow-ups due, expected fees, stipend rows to pay, screenshots not saved, offers not accepted for 3+ days, batches ending in 7 days |
| 1st of month | Create stipend entries for last month |
| On assignment (instant) | Fee entry (Paid) + offer/T&C/consent drafts |
| Batch end date | Prompt "Close batch" → certificate drafts |

Email/WhatsApp sending comes once SMTP is configured (D-10). Until then the digest shows on the dashboard.

## 13. Local files (office PC)
```
<local_files_root>\<academic year>\
  students\<STUDENT-CODE>_<First-Last>\
    01_kyc\        PHOTO_<code>.jpg · COLLEGEID_<code>.jpg · IDPROOF_<code>.jpg · NOC_<code>.pdf
    02_payments\   FEE_<code>_<YYYY-MM-DD>_<amount>.jpg · STP_<code>_<YYYY-MM>_<amount>.jpg · RFD_<code>_<date>_<amount>.jpg
    03_documents\  <DOC-NUMBER>.pdf   (e.g. QF-CERT-2627-AA-0007.pdf)
    04_work\  05_other\
  batches\<BATCH-CODE>\     (exports, close-batch ZIP)
```
The portal shows the exact folder and file name with a copy button. **Sync this folder to OneDrive/Google Drive**: it is the only copy of proofs.

## 14. Architecture (Vercel + Supabase, free while testing)
Next.js on Vercel (function region **bom1**, near Supabase Mumbai) · Supabase Postgres + Auth + RLS · **no cloud file storage** · PDFs generated on demand (pdfme, Node route) · daily cron `/api/cron/daily` (CRON_SECRET) · Vercel Preview → staging Supabase project · audit log in DB.

## 15. Open-source reuse
MIT (copy allowed, keep notice): **atomic-crm** (CRM patterns, activity log), **next-shadcn-dashboard-starter** (tables, forms, kanban), **TanStack Table**, **dnd-kit**, **pdfme**. Reference only (copyleft): Plane, Frappe HRMS, Horilla, Twenty.

## 16. Changes vs what is built (Phase 1)
Kept: auth (Google + password), invite-only access, RLS pattern, audit log, settings, numbering, form import, tests, deployment.
One migration (no real data yet): roles → admin/student + is_owner · applicants → leads (+ CRM fields) · new activities · programs → courses + course_plans · batch_mentors removed · enrollment_terms → stipend_agreements + money_entries · new work_items/work_status/attendance · documents redesigned (templates, tokens, acceptances, scans) · mentor area removed.

## 17. Build order
| Step | Scope |
|---|---|
| A | Schema v2.2 + RLS + tests + data migration |
| B | Students (add, 360, archive) + Leads/CRM + convert |
| C | Courses & plans, Batches, **Assign / unassign / transfer**, roster |
| D | Payments ledger |
| E | Documents: templates, drafts, issue, PDF, acceptance, verify page, scan log, close-batch ZIP |
| F | Work log + completion grid + attendance; student app |
| G | Projects tracking; daily cron + digest; email once SMTP exists |

## 18. Batch workspace (v2.3)

A batch is one page with tabs. The **plan** is the reference; the **live track** is what really happened. Tracking never edits the plan.

| Tab | What it holds | Owner of the data |
|---|---|---|
| **Overview** | Course plan, dates, schedule, capacity, coordinator, status · tool links (WhatsApp, Classroom, Meet, YouTube playlist, Drive, GitHub) · KPIs: day X of N, students by type, avg attendance, **plan progress** (delivered / planned, days behind) · money summary (read-only from Payments) | Batch |
| **Plan** | Week-by-week plan copied from the course-plan template, editable for this batch · **Publish** → share link + PDF | Batch plan |
| **Live track** | Sessions / tasks / tests actually given (date, link, channel), each optionally linked to a plan item · completion grid (students × items) · attendance per session | Work log |
| **Students** | Roster: assign / unassign / transfer, type, status, fee/stipend status (read-only), document status (read-only) | Enrolments |
| **Projects** | Projects linked to this batch (college projects of its interns, client projects of its stipend students) | Projects |
| **Close batch** | Results per student → certificate drafts → issue all → ZIP | Documents |

### 18.1 Batch plan – how it works
1. **Template per course plan** (Settings → Courses → AI Automation · 30 days → Plan template): items with *week*, *day offset*, *kind* (session, task, test, project milestone, holiday/buffer), *title*, *description*, *resources* (YouTube / Drive / GitHub links), *duration*. Edited rarely, versioned.
2. **Create batch** → the template is **copied** into the batch. Planned dates are calculated from the start date and the batch's schedule days (holidays skipped).
3. **Edit for this batch** (drag to reorder, edit text, add/remove items, shift dates). Changes stay in **Draft** until **Publish**.
4. **Publish** → version +1, "last updated" stamp, optional change note ("Week 3 test moved to Friday").
   - **Share link:** `https://<portal>/plan/<random token>` – a read-only, mobile-friendly **HTML** page (always the latest published version; no student data on it). Post it in the WhatsApp group or Classroom.
   - **PDF:** generated on demand from the same page (for college or a WhatsApp attachment), stamped with version and date.
   - Students also see it in the app (Home → My batch → Plan).
5. **Why HTML (not a stored PDF/Doc) is the source:** one place to edit, always current, free (no file storage), and a PDF can still be exported whenever needed. Google Docs is not used because edits there would not be linked to the live track.

### 18.2 Live track (actual)
- Admin logs what was really given: **"Log from plan"** (pick a plan item → title, links and kind pre-filled, date = today) or **"Log unplanned"**.
- Each plan item's status is **computed**: *Pending* · *Delivered on <date>* (on time / +N days) · *Skipped* (admin marks it, with a reason). The plan text itself is never changed by tracking.
- Batch Overview shows **Delivered 14 / 20 planned · 2 days behind · 1 skipped**, and the plan page can show a ✓ next to delivered items (toggle).

### 18.3 Data (additions)
**plan_templates** – `course_plan_id*` · `version*` · `active` · **plan_template_items** – `template_id*` · `seq*` · `week*` · `day_offset*` · `kind*` · `title*` · `description` · `resources` (list of {label, url}) · `duration_min`
**batch_plans** – `batch_id*` (one per batch) · `status*` (draft, published) · `version*` · `published_at` · `change_note` · `share_token*` · `share_enabled*`
**batch_plan_items** – `batch_plan_id*` · `seq*` · `week*` · `planned_date` · `kind*` · `title*` · `description` · `resources` · `duration_min` · `skipped` + `skip_reason` (tracking flag, not content)
**work_items** gains `plan_item_id` (nullable = unplanned).

## 19. Projects – classification

| Kind | For | Members | Rules |
|---|---|---|---|
| **Client project** | Real work for a Quellflow client | Stipend students (and staff) | Members must have accepted the **NDA/IP consent** · repo **private** in the Quellflow GitHub org · client name and contact are admin-only · never shown on public pages · may count toward the **experience letter** |
| **College project** | A project the intern submits to their college | Any student (Paid / Free / Stipend), solo or team | Repo can be the student's own or the Quellflow org (public allowed) · fields for college, guide, submission date · issues a **Project completion certificate** (new document type) |
| **Internal project** | Quellflow's own products / tools (e.g. this portal) | Stipend students, staff | Repo private · portfolio mention allowed after approval |

**projects** – `code*` (PRJ-CL-07 / PRJ-CO-12 / PRJ-IN-03) · `name*` · `kind*` (client, college, internal) · `batch_id` (optional) · `description` · `status*` (planned, active, on_hold, completed, cancelled) · `start_date` · `due_date` · `lead_admin_id` · **`github_url`** · `github_visibility` (private, public) · `demo_url` · `docs_url` ·
  – client: `client_name` · `client_contact` (admin-only) · `nda_required` (always true)
  – college: `college_name` · `guide_name` · `submission_due` · `report_status` (not started, draft, submitted, approved)
**project_members** – `project_id*` · `enrollment_id*` · `role` (developer, designer, tester, analyst, bd) · `hours_per_week` · `contribution_note` (used in the certificate / experience letter)
**tasks** (tracking only) – `project_id*` · `title*` · `status*` · `assignee` · `due_date` · `link` (PR / commit / doc)
Document types gain **project_certificate** (college projects).

## 20. Still needed from the owner
Course plan prices and benefits · wording of the offer letter, T&C, consents and certificate (we draft, you approve, CA/lawyer reviews) · signatory names + signature image · local files root folder. Domain decided: **internship.quellflow.online** (set it in Settings → Organisation → Verify page domain before the first certificate).
