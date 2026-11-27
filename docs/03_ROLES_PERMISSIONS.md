# 03 – Roles & Permissions (RBAC)

## Roles
| Role | Who | Login |
|---|---|---|
| `super_admin` | Partners (Ashish, Dharmik) | Google or email + password (2-Step Verification on the Google account) |
| `admin` | Programme / HR operations | Google or email + password |
| `mentor` | Quellflow team members guiding interns | Google or email + password |
| `student` | Track A interns, Track B trainees (only after enrolment invite) | Google or email + password (same email as the form) |

**Login methods (all invite-only):** Google · email + password (create password / sign in / forgot password) · one-time email link. Access is decided by the invitation, never by the method. Any signed-in user can add or change a password at `/account/password` (works without SMTP). Sign-up confirmation, reset and link emails need custom SMTP (D-10) – until then Supabase's built-in mailer only reaches project team members (2 emails/hour).
| `public` | College professors, employers | No login – only `/verify/*` |

Applicants from the Google Form are **not** users. An admin invites them when they are shortlisted/enrolled. A person can hold one role; mentors who also admin get `admin` + mentor assignment via `batch_mentors`.

## Permission matrix
Legend: ✅ full · 👁 read · ✏️ own only · 🅱 own batches only · ❌ none

| Resource | super_admin | admin | mentor | student | public |
|---|---|---|---|---|---|
| Settings, signatories, templates | ✅ | 👁 (templates ✏️ draft) | ❌ | ❌ | ❌ |
| Users & roles | ✅ | ✅ (not super_admin) | ❌ | ✏️ profile | ❌ |
| Applicants (imported from Sheet) | ✅ | ✅ | 👁 shortlisted for their role | ❌ | ❌ |
| Programmes, playbooks, courses | ✅ | ✅ | 👁 (+ edit lessons of own course if allowed) | 👁 enrolled content | ❌ |
| Batches | ✅ | ✅ | 🅱 | 👁 own batch | ❌ |
| Enrolments (plan record) | ✅ | ✅ | 🅱 read + update route/scope | 👁 own | ❌ |
| Diagnostic scores, mentor notes / answer cues | ✅ | ✅ | 🅱 | ❌ (sees own final score after review) | ❌ |
| Tasks | ✅ | ✅ | 🅱 create/review | ✏️ update status & evidence | ❌ |
| Daily updates, weekly reports, blockers | ✅ | 👁 | 🅱 👁 + comment | ✏️ create/edit same day | ❌ |
| Mentor reviews | ✅ | 👁 | 🅱 create | 👁 own (after published) | ❌ |
| Assignments / submissions / grades | ✅ | ✅ | 🅱 grade | ✏️ submit, 👁 grade | ❌ |
| Live sessions & attendance | ✅ | ✅ | 🅱 schedule & mark | 👁 own batch, self check-in | ❌ |
| Payments & invoices | ✅ | ✅ | ❌ | 👁 own | ❌ |
| Documents – generate / revoke | ✅ (revoke) | ✅ generate (approval rules) | ❌ (LOR: recommend only) | ❌ | ❌ |
| Documents – view/download | ✅ | ✅ | 🅱 👁 | 👁 own issued | verify summary only |
| Announcements | ✅ | ✅ | 🅱 to own batches | 👁 | ❌ |
| Audit log | 👁 | 👁 (no delete) | ❌ | ❌ | ❌ |

## Approval rules
- Offer letter / enrollment letter: admin generates, **super_admin approves** before issue (first 2 batches; later admin can issue).
- Certificate: requires `completion_records.acceptance_decision = accepted` (Track A) or grade ≥ 50 + attendance ≥ 75% (Track B). Override only by super_admin with reason.
- Experience letter: Track A only.
- LOR: mentor recommends → super_admin approves → issued.
- Revoke: super_admin only, reason mandatory, shown on verify page as REVOKED.

## Implementation
- `profiles.role` (enum) is the single source; JWT custom claim `user_role` added via Supabase auth hook for fast checks.
- Every check exists twice: server action/route (UX + early error) **and** RLS (security). See `07_RLS_POLICIES.md`.
- Mentor scope = `batch_mentors(batch_id, mentor_id)`; helper SQL function `is_batch_mentor(batch_id)`.
