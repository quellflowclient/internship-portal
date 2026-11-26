# 12 – Security & Privacy

## Data protection (India – DPDP Act 2023)
- Collect only what the programme needs (already reflected in the 3-step form). Consent captured in the form declaration; portal shows a privacy notice at first login.
- Purpose: internship/training administration and verification. No sale/sharing with third parties.
- Retention: applicants not converted – delete or anonymise after 12 months (D-13). Enrolment & issued documents – retained for verification (at least 7 years, or as CA advises).
- Data principal requests (access/correction/deletion) via official email; deletion keeps a minimal verification stub for issued documents (code, name, type, dates, status) with the reason.
- Verify page exposes only public fields (see 07/08).

## Access & secrets
- RLS on every table; role checks duplicated server-side; `service_role` only on server.
- Secrets in hosting env vars; never in repo; `.env.example` lists names only.
- Google sign-in; super_admin accounts must use 2FA.
- Least privilege for mentors (own batches only); offboarded mentors → `is_active=false` immediately.

## Application security
- Input validation (zod) on all actions; file uploads: type/size allowlist (PDF, images, zip ≤ 20 MB), stored privately, served via signed URLs, never executed.
- Webhooks: HMAC signature verification (import, Razorpay); idempotency keys.
- Rate limits: login, verify, import endpoints.
- Formula-injection safe CSV/Sheet exports (prefix `'` for `= + - @`, as already done in the Apps Script).
- Text from applicants/students is data – any AI feature (e.g. summarising updates) must not act on instructions inside it.
- CSP + secure headers; dependency audit in CI.

## Integrity of documents
- Issued rows immutable (trigger), versioned re-issue, revoke with reason, sha256 stored, audit log append-only.
- Signature images and DSC never exposed to the client; signing runs server-side (or offline signing step for DSC token – D-09).

## Backups & recovery
- Supabase daily backups (PITR on paid plan for prod); weekly export of `documents` table + bucket to separate storage.
- Recovery drill once before launch (restore staging from backup).

## Incident response
Owner: super_admin. Steps: contain (revoke keys/disable user) → assess → notify affected users (and authorities if required by DPDP rules) → fix → record in audit log/notes.
