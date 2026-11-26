# 14 – Testing & QA

## Layers
| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | number formatting, phone normalisation, grade calc, route calc (0–7/8–14/15–20), pdf data builder, hash |
| DB / RLS | pgTAP or Vitest + supabase-js with seeded users | Every policy: allowed and denied cases |
| Integration | Vitest against local Supabase | import webhook (HMAC, idempotency), document issue pipeline, Razorpay webhook |
| E2E | Playwright (mobile + desktop viewports) | Main flows F1–F8 |
| Manual | Checklist below | Visual docs, QR on real phones |

## RLS matrix (seed: superA, adminA, mentorX (batch X), mentorY (batch Y), studentA (X), studentB (X), studentC (Y), anon)
- studentA reads own daily_updates ✅, studentB's ❌, studentC's ❌
- mentorX reads batch X enrolments ✅, batch Y ❌; cannot read applicants not shortlisted for them ❌
- studentA sets own task `accepted` ❌; `in_review` with evidence ✅
- studentA updates own `profiles.role` ❌
- studentA reads diagnostic_scores ❌ (summary view only)
- anon selects documents ❌; `verify_document('QF-C-…')` ✅ public fields only
- adminA revokes document ❌ (super_admin only) ✅ for superA
- Issued document update of `pdf_path/sha256/data` by anyone ❌ (trigger)

## Document QA checklist
- [ ] Long names (40+ chars), Indian names with initials, college names wrap correctly
- [ ] Dates IST, `27 Nov 2026` format
- [ ] QR scans on Android + iPhone camera → correct verify page
- [ ] Verify shows REVOKED within 1 min of revoke
- [ ] Hash check: original = "Original", edited PDF = "Not the issued file"
- [ ] Track B certificate says "Training & Internship Programme"; no experience letter option for Track B
- [ ] Print test (A4) – margins, colours

## Pre-launch checklist
- [ ] All P0 decisions closed · [ ] RLS suite green · [ ] E2E green on 360px · [ ] Backup restore drill done · [ ] Privacy notice live · [ ] Test batch (internal 3 users) completed end-to-end including certificate
