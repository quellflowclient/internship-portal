# 02 – Playbook → Portal Mapping

The 7 playbooks in `project-docs/` share one template. The portal stores that template as structured data so a mentor runs a programme from the UI instead of a Word file.

## Playbooks available
| Code | Playbook | 45 days project | 90 days project | 6 months project |
|---|---|---|---|---|
| FS | Fullstack | Internal request tracker | Team service request portal | Quellflow operations portal prototype |
| BE | Backend | Request management API | Service request API with access control | Operations backend with reliable background work |
| AA | AI Automation | Enquiry intake and routing workflow | Approval-based enquiry response workflow | Supervised operations automation suite |
| DO | DevOps | Containerised sample service with CI | Reproducible staging delivery pipeline | Staging platform and reliability operating guide |
| ML | AI / ML | Daily demand forecasting study | Reproducible forecasting pipeline and demo API | Forecasting lifecycle prototype |
| BD | BDA | Target segment research and discovery kit | Segment development and supervised pilot kit | Repeatable business development operating system |
| SE | SEO | Small site audit and improvement kit | Service content cluster and technical improvement | SEO content and technical operating programme |

## Launch tracks (D-03) vs playbooks
| Launch track | Playbook | Status |
|---|---|---|
| AI Automation (AA) | 03_AI_Automation | ✅ ready |
| GenAI (GA) | — | ❌ to write (LLM apps, prompt design, RAG, evaluation, safety) – D-18 |
| Full Stack (FS) | 01_Fullstack (+ 02_Backend) | ✅ ready |
| SEO (SE) | 07_SEO | ✅ ready |
| QA / Software Testing (QA) | — | ❌ to write (test design, manual + automated tests, bug reports, CI) – D-18 |
| DevOps (DO) | 04_DevOps | ✅ ready |
| AI/ML (ML) | 05_AI_ML | ✅ ready |
BDA (06) and Backend (02) playbooks remain available for Track A even though they are not launch tracks.

## Gap vs. intake form roles
Form roles **without** a playbook yet: Frontend (→ use FS), Mobile App, UI/UX, Graphic Design, 3D, Data Analyst/Scientist (→ partly ML), QA/Tester, Technical R&D.
Playbooks **not** in the form: DevOps, SEO. → Decision D-07 (add to form or keep internal).

## Template section → data
| Playbook section | Portal entity (see 06_DATA_MODEL) |
|---|---|
| Title, tagline, tracks (45/90/6m), calendar & hours, mentor preparation, working boundaries | `playbooks` (+ `version`) |
| Day 1 / Day 2 agenda + practical task, assessment setup, sample cases, answer cues (mentor only) | `diagnostic_templates` (student-visible brief vs `mentor_notes`) |
| 5 rubric dimensions + 0–4 scale + routing thresholds | `rubric_dimensions` (global) + `diagnostic_scores` |
| Teaching modules (Mentor teaches / Intern practises / Ready when) | `playbook_modules` |
| Project brief per duration: problem, title, required scope, outside first release, handover package, acceptance checks, scope decision | `project_briefs` + `acceptance_checks` |
| Schedule rows (Days x–y / Week n: mentor actions, intern tasks, deliverable, review criteria) | `schedule_milestones` |
| Quality checks + three review decisions (Accepted / Revise / Rescope) | `quality_checks` + `mentor_reviews.decision` |
| Message templates: assignment, daily update, weekly report, mentor review note, blocker | forms: `tasks`, `daily_updates`, `weekly_reports`, `mentor_reviews`, `blockers` |
| Final demonstration (35-min agenda) + final report (9 sections) | `final_reviews`, `final_reports` |
| Completion record + "Record before issuing this plan" | `enrollments` fields + `completion_records` |
| Working tracker statuses To do / In progress / In review / Revision / Accepted | `tasks.status` enum |
| Learning resources + tool choices | `playbook_resources` |

## Enrolment "plan record" fields (from playbook)
Intern, mentor, backup mentor, duration, start date, end date, working days & weekly hours, diagnostic route, project brief (+ reduced scope note), review slots, approved workspace & tools, budget limit, final handover owner.

## Form templates (copied from playbooks)
- **Daily update:** planned · completed (+link) · checked by · learned · blocker (problem, attempts, help needed) · next working day.
- **Weekly report:** week & dates · agreed goal · demonstrated result (link) · checks passed / failing · feedback & changes · hours learning/delivery · assistance/AI used · risks/scope changes · next goal & help needed.
- **Mentor review note:** date & milestone · demonstration · evidence reviewed · explained well · gap · decision (accepted/revise/rescope) · next assignment & checks · support · next review date.
- **Blocker:** expected vs actual · reproduce steps · attempts & evidence · smallest example link · decision needed · parallel task.
- **Final report:** 1 problem & scope · 2 baseline & goals · 3 work + links · 4 decisions · 5 validation · 6 feedback & revisions · 7 limitations & next steps · 8 setup/operating guide · 9 reflection & assistance used.

## Import approach
Phase 1: seed the 7 playbooks via a one-off script that parses the `.docx` text into JSON (sections are consistently labelled), then an admin reviews/edits them in the portal. Edits create a new `playbooks.version`; running enrolments keep the version they started with.
