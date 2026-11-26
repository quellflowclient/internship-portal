# 08 – Documents & Certificates

## Catalogue
| Type | Track | Trigger | Approver | Numbering |
|---|---|---|---|---|
| Offer letter | A | Enrolment created (status `offer_sent`) | super_admin (first batches) | `QF/OFR/2627/0001` |
| Internship agreement + NDA/IP | A | With offer | super_admin | `QF/AGR/2627/0001` |
| Enrollment (joining) letter | B | Payment captured | auto (admin can re-issue) | `QF/ENR/2627/0001` |
| GST invoice / receipt | B | Payment captured | auto | `QF/INV/2627/0001` (per CA) |
| Certificate of Completion | A, B | Completion record eligible | super_admin | `QF-C-2627-<ROLE>-0001` |
| Certificate of Excellence | A, B | Grade = Distinction / mentor nomination | super_admin | same series, type differs |
| Project Completion Certificate | B (college) | Capstone accepted | admin | same series |
| Experience letter | **A only** | Completion accepted | super_admin | `QF/EXP/2627/0001` |
| Relieving letter | A (stipend) | End of engagement | admin | `QF/REL/2627/0001` |
| Letter of Recommendation | A, B top performers | Student request → mentor recommend | super_admin | `QF/LOR/2627/0001` |
| Grade / evaluation report | A, B | Completion | admin | attached to certificate code |

`2627` = academic year 2026–27 (Jun–May, decision D-05). Sequences never reuse numbers; voided drafts don't consume a number (number assigned at **issue**).

## Template variables (all templates)
`{name}` (profiles.display_name_on_docs) · `{college}` · `{course}` · `{program_name}` · `{track_label}` · `{role_title}` · `{start_date}` · `{end_date}` · `{duration_label}` · `{mode}` · `{weekly_hours}` · `{mentor_name}` · `{project_title}` · `{grade}` · `{stipend}` / `{fee}` · `{doc_number}` · `{code}` · `{issue_date}` · `{verify_url}` · `{qr}` · `{signatory_name}` · `{signatory_title}` · `{signature_image}`

## Layouts (A4)
**Letterhead (letters):** Q emblem + "Quellflow Technologies LLP", address, LLPIN, website, email · ref no + date · body · signatory block · footer with QR + "Verify at {verify_url}".

**Offer letter:** greeting · role & programme · dates/duration · mode & hours · stipend (or "unpaid internship") · mentor/reporting · responsibilities (from project brief) · conditions: attendance, confidentiality, IP with Quellflow, AI-use disclosure, code of conduct, termination · accept-by date · signatory · acceptance (accepted in portal with timestamp – printed on PDF).

**Enrollment letter (B):** "This is to confirm that {name}, {course}, {college}, is enrolled in the Quellflow Training & Internship Programme – {role_title} ({duration_label}, online), batch {batch}, from {start} to {end}, {weekly_hours} hours/week." (colleges accept this as joining letter).

**Certificate (landscape):**
```
[Q emblem]  QUELLFLOW TECHNOLOGIES                       CERTIFICATE OF COMPLETION
                 This is to certify that
                       {NAME}
   {course}, {college}, has successfully completed the
   {program_name} – {role_title}   ({start} – {end}, {duration_label}, {mode})
   Project: {project_title}                       Performance: {grade}
   [mentor signature]   [designated partner signature]   [seal]
   Certificate ID {code} · Issued {issue_date} · [QR] Verify at {verify_url}
```
Track B certificates say **"Training & Internship Programme"**; Track A say **"Internship"**.

**Experience letter (A):** To whom it may concern · served as {role_title} from {start} to {end} · key work (from final report/acceptance checks) · skills demonstrated · conduct · signatory · QR.

**LOR:** mentor voice · context & duration · 2–3 specific achievements with evidence · skills · recommendation strength · mentor + partner signatures · contact for reference (official email only).

## Generation pipeline
1. Admin selects enrolments + template → server builds `data` snapshot from DB (no free typing of name/dates; edits via profile/enrolment so data stays consistent).
2. Preview (watermarked "DRAFT").
3. Approve (per approval rules in 03).
4. Issue (server, service role): `next_document_number()` → render with **pdfme** (`@pdfme/generator`, template JSON + base PDF) incl. QR image of `verify_url` → optional PAdES signing with DSC (Phase 2, signing service/USB token flow – decision D-09) → compute **sha256** → upload `documents/{year}/{type}/{code}.pdf` → insert row `issued` → notify student (email + in-app).
5. Re-issue (correction) = new row `version+1`, `supersedes_id` = old; old row status `revoked` with reason "superseded".

## Anti-forgery & verification
| Layer | What |
|---|---|
| Unique code | Sequenced code printed on doc + in DB |
| QR | → `{verify_base}/verify/{code}` |
| Verify page | Public: name, type, programme, role, dates, grade, issue date, VALID / REVOKED |
| Hash check | Upload a PDF on verify page → sha256 compared with stored hash → "Original" / "Not the issued file" |
| Digital signature | DSC (PAdES) – Adobe shows signed-by; any edit breaks signature |
| Visual | Fine guilloche/microtext background, code watermark, fixed layout |
| Revocation | super_admin, reason, instant on verify page |
| Audit | Every generate/approve/issue/revoke logged |

Professors: scan QR → compare name + code → done. Employers can also type the code at `/verify`.

## Storage & privacy
Issued PDFs only in private bucket; student gets a short-lived signed URL. Drive is not used for issued documents (exports/backups only). Verify page never shows email/phone/college ID numbers.

## Template source files
Design masters (Canva/Figma/HTML) live in `Quellflow/docs/internship_program/03_Templates/`; the portal stores the converted pdfme JSON + base PDF with versions in `doc_templates`.
