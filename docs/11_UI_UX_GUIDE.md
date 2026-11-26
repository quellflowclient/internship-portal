# 11 – UI / UX Guide

## Brand tokens (from intake form, banner and WhatsApp kit)
| Token | Hex | Use |
|---|---|---|
| `--navy` | `#16205A` | Headings, sidebar, primary text on light |
| `--blue` | `#3448E8` | Primary buttons, links, focus ring (Google Form theme colour) |
| `--violet` | `#8B3CF0` | Secondary accent, charts |
| `--cyan` | `#12C8E0` | Highlights, success-ish accents (not for text on white) |
| `--slate` | `#52657D` / `#3E4F66` | Body / secondary text |
| `--soft` | `#F4F6FB` | Page background |
| `--border` | `#E3E8F2` | Card borders, dividers |
| `--tint` | `#ECEFFE` | Selected rows, pills |
Status colours: New `#DBEAFE` · Under review `#FEF3C7` · Accepted/Shortlisted `#DCFCE7` · Revision `#FFE4D6` · Rejected/Revoked `#FEE2E2`.

Logo: gradient Q emblem (`Quellflow/docs/##/hiring/assets/quellflow_q_emblem_clean.png`) + text wordmark "QUELLFLOW / TECHNOLOGIES". Dark mode: navy surfaces `#0E1438`, keep emblem as is.

## Typography
Headings **Montserrat** (600–800) · Body/UI **Inter** (400–600) · Numbers tabular. Base 16px mobile, 15px dense tables desktop. Line-height 1.5.

## Layout
- Mobile-first: 360px → 768px → 1280px. Bottom tab bar for students on mobile (Today · Tasks · Course · Docs · Me); sidebar on desktop.
- Admin/mentor tables become cards under 768px; bulk actions in a sticky footer.
- Touch targets ≥ 44px; forms one column on mobile; autosave drafts (daily update, final report).

## Sitemap
**Student:** Today (milestone, due tasks, post update, next live) · Tasks (board/list) · Updates (daily, weekly, blockers) · Course (Track B) · Sessions (upcoming, recordings, attendance) · Documents (offer/enrolment, certificates, LOR, invoices) · Profile.
**Mentor:** Dashboard (interns, missing updates, in-review, blockers) · Intern detail (plan record, scores, tasks, updates, reviews, timeline) · Diagnostics · Reviews · Sessions · Content (if course owner).
**Admin:** Overview (funnel, batches, revenue) · Applicants · Programmes & playbooks · Courses · Batches · Enrolments · Documents (queue: draft → approval → issued) · Payments · Announcements · Users · Settings (signatories, templates, numbering) · Audit log.
**Public:** `/verify` and `/verify/[code]` – clean single card, brand header, large VALID/REVOKED badge, mobile-optimised for QR scans.

## UX rules
- Empty states teach the next action ("No update today – takes 2 minutes").
- Destructive / irreversible actions (issue, revoke, refund) use confirm dialogs with typed reason.
- Every status pill uses the same colour mapping across the app.
- Dates shown as `27 Nov 2026`, times IST with "IST" label.
- Accessibility: WCAG AA contrast (cyan never used for body text), keyboard navigable, labels on all inputs.
