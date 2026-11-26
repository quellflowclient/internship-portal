# 05 – Features & MVP Spec

Priority: **P1** = MVP (Phases 1–2) · **P2** = Phase 3 · **P3** = later.

## M1 Auth & profiles – P1
- Google sign-in + email OTP fallback; invite-only for students/mentors (no open sign-up).
- Profile: name (as on documents), phone (E.164), college, course, year, photo (optional), LinkedIn/GitHub.
- **AC:** an un-invited Google account sees "No access – contact admin"; name change after a document is issued requires admin approval.

## M2 Applicants – P1
- Import from Sheet (webhook + manual CSV fallback), dedupe by `candidate_code` and email.
- List with filters (role, track, year, mode, start, CV, status), detail drawer (all answers + CV link), bulk status change, notes.
- **AC:** re-sending the same response does not create a duplicate; status history kept.

## M3 Programmes, playbooks, batches – P1
- Programme = track + role + duration; links a playbook version (A) or course (B).
- Playbook editor (sections from 02_PLAYBOOK_MAPPING), versioning.
- Batch: name, programme, start/end, mentors, capacity, live slot.
- **AC:** editing a playbook creates a new version; active enrolments stay on their version.

## M4 Enrolments (plan record) – P1
- Fields from the playbook "record before issuing this plan"; stipend / fee; status machine.
- **AC:** cannot activate without mentor, dates, duration and accepted offer (A) or paid (B).

## M5 Diagnostic – P1
- Day 1/Day 2 brief to student; mentor-only cues; 5×(0–4) scoring with evidence link + observation; auto route; Day 7 recheck.
- **AC:** route computed 0–7 / 8–14 / 15–20; student never sees mentor cues.

## M6 Tracker (tasks) – P1
- Kanban + list: task, owner, due, acceptance check, status (todo/in_progress/in_review/revision/accepted), evidence link, mentor decision, next action. Milestones from playbook schedule pre-seeded.
- **AC:** only mentor/admin can set `accepted`; moving to `in_review` requires an evidence link.

## M7 Daily updates, weekly reports, blockers – P1
- Playbook templates as forms; one daily update per student per working day (editable same day); weekly report pre-filled; blockers notify mentor.
- **AC:** mentor dashboard shows "no update today" list by 7 pm IST.

## M8 Mentor reviews & rescoring – P1
- Review note template; decision accepted/revise/rescope; scope change log (what removed, why, new checks); midpoint/final rescore.
- **AC:** a rescope requires a written reason and updated acceptance checks.

## M9 Live sessions & attendance – P1
- Schedule (Google Meet via Calendar API, or paste link), agenda, recording link, attendance.
- **AC:** batch students receive invite; attendance % visible per student.

## M10 Announcements & notifications – P1
- Batch/all announcements; email + in-app; n8n hook for WhatsApp later.

## M11 Documents – P1 (core)
- Templates (pdfme JSON, versioned), generate (single/bulk), preview, approve, issue (number, QR, sha256, optional DSC), email, student Documents tab, revoke. See 08.
- **AC:** issued PDF bytes never change; verify page reflects revoke within 1 min.

## M12 Public verify – P1
- `/verify/[code]` + `/verify` search box + optional PDF upload hash check; rate-limited.

## M13 Completion – P1
- Final demo checklist (35-min agenda), final report form (9 sections), completion record → eligibility → documents.

## M14 Courses (Track B) – P2
- Course → modules (weeks) → lessons (video/embed, notes, resources); drip by week; progress; quizzes (MCQ, auto-grade); assignments (file/link, rubric grading); capstone uses M6.
## M15 Payments – P2
- Razorpay orders, webhook, receipts, GST invoice numbering, refunds (manual with record).
## M16 Analytics – P2
- Funnel (applied → shortlisted → enrolled → completed), batch health, mentor load, revenue.
## M17 LOR workflow – P2 · College/TPO view – P3 · White-label – P3
