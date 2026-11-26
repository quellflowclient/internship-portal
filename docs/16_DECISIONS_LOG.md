# 16 – Decisions Log

Priority: **P0** = needed before Phase 1/2 · **P1** = before Track B · **P2** = later.

## Open
| ID | Decision | Notes | Priority | Status | Owner |
|---|---|---|---|---|---|
| D-02 | Track B fee per duration, GST, refund, EMI | Fee is set per enrolment/programme in admin panel; CA to confirm GST/refund policy | P1 | OPEN | Partners + CA |
| D-06 | Certificate signatories (names, titles, signature images) | Templates built with **signatory placeholders** managed in Admin → Settings → Signatories; owner provides later | P1 | OPEN – owner will provide | Partners |
| D-08b | Supabase project access | Cloud, **Mumbai (ap-south-1)** confirmed; owner creates project and shares access | P0 | WAITING | Owner |
| D-09 | DSC signing of PDFs | Phase 4 | P2 | OPEN | Partners |
| D-10 | Email provider + sender address | Owner will provide | P0 | WAITING | Owner |
| D-11 | Video hosting (YouTube unlisted vs Bunny Stream) | Start YouTube unlisted | P1 | OPEN | Tech |
| D-12 | Hosting + domain | Owner will provide (suggested `learn.quellflow.com`) – portal reads base URL from settings/env, nothing hard-coded | P0 | WAITING | Owner |
| D-13 | Data retention periods | 12 months for non-converted applicants (proposal) | P1 | OPEN | Partners |
| D-14 | Grade < 50 → participation letter or nothing | | P1 | OPEN | Partners |
| D-16 | Portal product name | | P2 | OPEN | Partners |
| D-17 | Canva usage for template design | Connector not connected; templates built in-house first | P1 | OPEN | Design |
| D-18 | Playbooks missing for launch tracks **GenAI** and **QA** (no source playbook in `project-docs/`) | Write new playbooks in the same template (Claude can draft, owner reviews) | P1 | OPEN | Partners |
| D-20 | Final review of numbering formats & academic year | Default seeded (below); owner checks later in admin panel | P1 | OPEN – owner will check | Owner |

## Closed
| ID | Decision | Date |
|---|---|---|
| D-01 | **Track A (merit, mentor-led) + Track B (paid training + internship)** now; Track C later. Can change later. | 26-Nov-2026 |
| D-03 | **Launch tracks (7):** AI Automation (AA), GenAI (GA), Full Stack (FS), SEO (SE), QA / Software Testing (QA), DevOps (DO), AI/ML (ML) | 26-Nov-2026 |
| D-04 | **Engagement type is decided per candidate by admin** in the portal: `free` / `paid` / `stipend`. Stipend/fee are **not advertised** publicly (form, posters, brochure, FAQ); they appear only in that candidate's offer/enrolment documents. | 26-Nov-2026 |
| D-05 | **Everything configurable from the admin panel:** academic year (default 2026–27, June–May), document number formats, prefixes, padding, signatories, branding, sender email, verify base URL. | 26-Nov-2026 |
| D-07 | DevOps & SEO become launch tracks (playbooks exist). Form role list to be updated to include SEO and DevOps (D-07a, small Apps Script change). Other form roles without playbooks (Mobile, UI/UX, Graphic, 3D, Data Analyst, R&D) stay in the form for data collection; no programme yet. | 26-Nov-2026 |
| D-08 | Supabase cloud, region **Mumbai (ap-south-1)** | 26-Nov-2026 |
| D-15 | Brand spelling **"Quellflow"** everywhere (documents, portal, emails). Playbook text "QuellFlow" normalised on import. | 26-Nov-2026 |
| C-01 | Custom portal (Next.js + Supabase) over Frappe LMS / LearnHouse | 26-Nov-2026 |
| C-02 | Intake stays Google Form (3 steps, CV optional, verified email) | 26-Nov-2026 |
| C-03 | Issued documents verifiable via QR + public verify page | 26-Nov-2026 |
