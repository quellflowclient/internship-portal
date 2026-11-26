# 00 – Product Overview

## Problem
Quellflow receives internship applications through a Google Form (live since Nov 2026). Running the programme after that – selection, onboarding, daily updates, mentor reviews, courses, projects, letters and certificates – on WhatsApp, Drive and Sheets breaks down beyond ~20 students, and documents become easy to forge.

## Vision
A single, mobile-first portal where:
- **Admins** convert applicants into enrolled interns/trainees and generate every document in one click.
- **Mentors** run the playbook (diagnostic → teaching → project → review) for their batch.
- **Students** learn, post daily updates, submit work, join live sessions and download their documents.
- **Anyone** (college professor, employer) verifies a certificate by scanning its QR code.

Long-term: white-label the portal for colleges / other companies (Quellflow product).

## Users
| Persona | Needs |
|---|---|
| Partner (super_admin) – Ashish / Dharmik | Overview, approvals, signatory, revoke, settings |
| Programme admin / HR | Import applicants, shortlist, batches, enrolments, payments, documents |
| Mentor | Assigned interns, diagnostic scoring, tasks, reviews, live sessions, LOR recommendation |
| Merit intern (Track A) | Tasks, daily/weekly updates, project, documents |
| Paid trainee (Track B) | Course lessons, assignments, weekly live, capstone, documents |
| Verifier (public) | Scan QR → see if document is genuine |

## Scope
**MVP (Phases 1–2):** auth & roles, applicant import, programmes/batches/enrolments, playbook-driven tracker (tasks, daily updates, weekly reports, mentor reviews), document generator + public verify page, announcements, live session scheduling.
**Phase 3:** courses (Track B) – lessons, video, quizzes, assignments, grading, Razorpay payments, invoices.
**Phase 4:** analytics, n8n automations (WhatsApp reminders), LOR workflow, college/TPO view, white-label.

**Out of scope (for now):** native mobile app, in-house video hosting, chat replacement (WhatsApp community stays for broadcast), public course marketplace.

## Success metrics (first 2 batches)
- 100% of issued documents verifiable via QR; 0 manual Word/Canva certificates.
- Admin time to onboard a batch of 20: < 30 min.
- ≥ 80% of active students post a daily update on working days.
- Mentor review turnaround ≤ 2 working days.
- Certificate generation for a completed batch: < 10 min.
