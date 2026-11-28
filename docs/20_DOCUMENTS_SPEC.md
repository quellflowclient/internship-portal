# 20 – Documents and certificates (Step E spec)

**Status:** v1.0 draft for owner review (28-Nov-2026). Extends `19_DB_FLOWS_PIPELINES.md` §2.8, §8 P6. Nothing here is built yet.

## 1. Owner decisions captured
| # | Decision |
|---|---|
| E-1 | The certificate design comes from **Canva** (owner sends it). Until then a demo template is used. |
| E-2 | Two signatories: **Ashish** and **Dharmik**. **The admin who issues a document signs it** – their name, title and signature image are printed. |
| E-3 | Documents are issued **one student at a time, any time**. Batch close only offers a shortcut ("issue all eligible"). |
| E-4 | A certificate can be issued **before the batch ends** (for example 2–3 days early) – with a reason, logged. |
| E-5 | Some people need a document **without an internship** (workshop, short training, appreciation, LOR for someone outside a batch). |
| E-6 | Verify address printed on every document: `https://internship.quellflow.online/v/<token>` (the sample design shows `verify.quellflow.com`; replace it). |

## 2. How the design is used (Canva → PDF)
1. Owner designs each document in Canva **without the variable text** (no name, dates, number, QR, signature) and exports **PDF (print)**, A4 landscape for certificates, A4 portrait for letters.
2. The file is stored in the repo (`public/templates/<type>-v<N>.pdf`) – fixed design, no cloud storage.
3. The portal places the variable fields on top with **pdfme** (MIT): name, programme/role, dates, result, issue date, document number, QR code, signatory name + title + signature image. Field positions are kept in `document_templates.layout` (JSON), editable by the owner in Settings → Templates with a live preview.
4. Text-only letters (offer, T&C, consent, LOR) keep their wording in `document_templates.body` and use a letterhead PDF as background.
5. Until the Canva files arrive: a clean built-in demo layout (logo, title, name, text, number, QR, signature line).

## 3. Signatories (E-2)
- `signatories` gains `profile_id` (the admin account). Ashish and Dharmik each have one row: name, title ("Partner, Quellflow Technologies LLP" – owner to confirm), signature image (transparent PNG, kept inline as data, max 200 KB).
- On **Issue**, the signatory is the issuing admin's row. If the issuing admin has no signatory row, the button asks them to pick one of the active signatories (owner setting: "Allow issuing on behalf of another signatory" – default off).
- The signatory is frozen into the document snapshot, so later changes to a signature never alter issued documents.

## 4. Issuing – any time, one by one (E-3, E-4)
| Situation | Rule |
|---|---|
| Normal certificate | Enrolment **completed** + eligible (attendance and tasks over the minimums). Issue from Documents, Student 360 (link) or Batch → Close. |
| **Early** certificate (before the end date) | Allowed for **owners**, or any admin when the enrolment is marked completed early. Reason required ("Leaving early for exams, all work done"). The certificate prints the **actual** end date (the day it was completed), not the batch end date. Logged in `enrollment_changes` and the document. |
| Not eligible (attendance below minimum) | Owner only, reason required. The verify page still shows "Valid". |
| Batch close shortcut | "Issue all eligible" creates and issues one document per eligible student, each still individual and revocable. |

## 5. Documents without an internship (E-5)
New **standalone** document types that need **no enrolment**:
| Type | Use | Data entered by the admin |
|---|---|---|
| `participation` | Workshop / seminar / short training | Event name, dates, hours, mode |
| `appreciation` | Recognition (hackathon, contribution) | Title, reason line, date |
| `custom_certificate` | Anything else with a fixed design | Title, body text (from the template's allowed fields) |
| `lor` (already exists) | Also allowed without an enrolment | Body text |

Rules: the person must exist as a **student record** (created in Students – it can stay without a batch). Owner-only by default, reason saved, same numbering (`QF-PRT-2627-XX-0001`, `QF-APR-…`, `QF-CUS-…`), same QR verification, same revoke/re-issue. The verify page shows the event/title instead of a batch.

## 6. Database changes (one migration, Step E)
- `doc_type` += `participation`, `appreciation`, `custom_certificate`; numbering schemes for them.
- `signatories.profile_id uuid unique references profiles`; `signatories.title_on_docs`.
- `document_templates.layout jsonb` (field positions), `document_templates.background_path text`.
- `documents.issue_note text` (reason for early / override / standalone); `documents.event` jsonb for standalone types.
- `guard_documents`: certificate needs a completed enrolment **or** (owner and `issue_note`); standalone types need no enrolment but need `issue_note`.
- `issue_document(p_document, p_content_hash, p_signatory default null)`: picks the issuer's signatory.
- Plus the small fixes found in Step C: admins may delete `plan_template_items`; `get_shared_plan` returns `schedule_days`.

## 7. Screens (Step E)
- **Documents**: list (type, student, number, status, scans) + Issue panel (type → student → enrolment if needed → fields → preview PDF → Issue).
- **Student 360 → Documents card**: "Issue document" link opens the Documents panel for that student (single source of truth).
- **Batch → Close**: eligibility table + "Issue all eligible".
- **Settings → Templates**: upload Canva PDF (owner), place fields, preview with sample data. **Settings → Signatories**: name, title, signature image, linked admin.
- **Public verify** `/v/<token>` and `/verify` (number + surname).

## 8. Needed from the owner
1. Canva files (certificate, letterhead) exported as PDF without variable text.
2. Ashish's and Dharmik's signature images (transparent PNG) and titles as they should print.
3. Wording of offer letter, T&C, consent, LOR (CA/lawyer review advised).
