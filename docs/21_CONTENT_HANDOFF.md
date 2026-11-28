# Content hand-off: batch plans and document templates

**For:** the developer (and their Claude Code) writing course plans and document wording for the Quellflow Internship Portal.
**Goal:** deliver files in the exact shape below, so they can be imported into the portal without retyping.
**Do not:** write to the portal database, change portal code, or put fees, stipend amounts, student names or personal data in any file.

---

## 1. What to deliver

A folder named `content/` with this layout:

```
content/
  plans/
    AA-30.json        one file per course + duration
    AA-60.json
    FS-30.json
    ...
  documents/
    offer.md          one file per document type
    tnc.md
    certificate.md
    ...
  backgrounds/        optional: Canva PDFs (see §4)
    certificate-v1.pdf
    letterhead-v1.pdf
  README.md           what is ready, what is still a draft, open questions
```

Zip the folder or share it as a Git branch. File names are lowercase except course codes.

---

## 2. Batch plans: `content/plans/<COURSE>-<DAYS>.json`

### Course codes (fixed, use exactly)

| Code | Course | Durations |
|---|---|---|
| AA | AI Automation | 30, 60, 90 |
| FS | Full Stack Development | 30, 60, 90 |
| QA | Software Testing | 30, 60, 90 |
| ML | Machine Learning | 30, 60, 90 |
| DO | DevOps (inactive for now) | 30, 60, 90 |
| DA | Data Analytics (inactive for now) | 30, 60, 90 |

Only 30, 60 and 90 are valid durations. A new course needs a new two-letter code: ask first.

### Shape

```json
{
  "course_code": "AA",
  "duration_days": 30,
  "version_note": "First full plan",
  "items": [
    {
      "seq": 1,
      "week": 1,
      "day": 1,
      "kind": "session",
      "title": "Kick-off: what AI automation is",
      "description": "Course map, tools to install, how the batch works.",
      "duration_min": 90,
      "resources": [
        { "label": "Setup guide", "url": "https://example.com/setup" }
      ]
    },
    {
      "seq": 2,
      "week": 1,
      "day": 1,
      "kind": "task",
      "title": "Install the tools and share a screenshot",
      "description": null,
      "duration_min": null,
      "resources": []
    }
  ]
}
```

### Field rules

| Field | Rule |
|---|---|
| `seq` | 1, 2, 3 … with no gaps or repeats. Order in which items appear. |
| `day` | **Class-day number**, not a calendar date. 1 = first class day of the batch. The portal turns it into a date from the batch start, its class days (e.g. Mon–Fri) and holidays. Never decreases as `seq` grows. |
| `week` | Class week the day falls in (1, 2, 3 …). With 5 class days a week: days 1–5 = week 1, 6–10 = week 2, and so on. Must agree with `day`. |
| `kind` | One of `session` (a class), `task` (homework), `test` (assessment, attendance is taken), `milestone` (checkpoint, e.g. "Project demo"), `buffer` (catch-up day). Nothing else. |
| `title` | Required. Plain English, at most 120 characters, no emojis, no trailing full stop. Students and parents see it. |
| `description` | Optional (`null` if none). Plain text, at most 500 characters. No Markdown, no HTML. |
| `duration_min` | Minutes for a `session` or `test` (e.g. 60, 90, 120). `null` for tasks, milestones and buffers. |
| `resources` | List of `{ "label", "url" }`. `url` must be a full `https://` link that opens without signing in to a private account. `[]` if none. |

### Content rules

- Every class day has exactly one `session` or one `test`, or a `buffer`. Tasks and milestones sit on the same day as the session they belong to.
- Class days per duration (5 class days a week): **30 days ≈ 22 class days, 60 ≈ 44, 90 ≈ 66.** Do not exceed these; leave 1–2 `buffer` days near the end.
- The last item is a `milestone` such as "Final project demo".
- No dates, weekdays, times, fees, stipend amounts, trainer phone numbers or student names anywhere.
- Keep wording consistent across courses: "Session", "Task", "Test", not "Lecture", "Assignment", "Quiz".

### Self-check before handing over (ask Claude Code to run this)

For every plan file, check and report:
1. Valid JSON; `course_code` and `duration_days` match the file name.
2. `seq` is 1…N with no gaps.
3. `day` never decreases; `week` matches `day` (5 class days a week).
4. Highest `day` is within the limit above.
5. Every `kind` is one of the five allowed values.
6. Every `session`/`test` has `duration_min`; others have `null`.
7. Every `url` starts with `https://`.
8. No title is longer than 120 characters or empty.

---

## 3. Document templates: `content/documents/<type>.md`

### Types (fixed, use exactly)

| Type | Document | Student signs it in the portal? |
|---|---|---|
| `offer` | Offer letter | Yes |
| `tnc` | Terms and conditions | Yes |
| `consent` | Consent (data, photos, NDA where needed) | Yes |
| `joining` | Joining letter | No |
| `certificate` | Internship completion certificate | No |
| `experience` | Experience letter (stipend interns) | No |
| `lor` | Letter of recommendation | No |
| `project_certificate` | College project certificate | No |
| `participation` | Certificate of participation (event, no internship) | No |
| `appreciation` | Certificate of appreciation | No |
| `custom_certificate` | One-off certificate, body typed when issuing | No |

### Shape

```markdown
---
type: certificate
title: Certificate of internship
requires_acceptance: false
---
This is to certify that {name} has successfully completed the {programme} internship
at {org_name} from {start_date} to {end_date} in batch {batch}.

Result: {result}
```

- The part between the `---` lines is the header. `requires_acceptance` is `true` only for `offer`, `tnc` and `consent`.
- The body is **plain text**. A blank line starts a new paragraph. No Markdown (`**`, `#`, lists), no HTML, no tables.
- The number, QR code, issue date, signature and signatory name are printed by the portal. Do not type them in the body.
- Keep certificates short (under 80 words). Letters may be longer; `tnc` may be several pages.

### Placeholders (only these work; anything else prints as typed)

| Placeholder | Prints |
|---|---|
| `{name}` | Student's name as it should appear on documents |
| `{programme}` | Course name and length, e.g. "AI Automation, 30 days" |
| `{batch}` | Batch code, e.g. AA30-2612-1 |
| `{start_date}` / `{end_date}` | e.g. 01 Dec 2026 (end date is the actual completion date if early) |
| `{role}` | Intern role, if set |
| `{result}` | Result note, e.g. "Completed with distinction" |
| `{project}` | Project name (project certificate, experience letter) |
| `{event_title}` / `{event_dates}` | Event name and dates (participation, appreciation) |
| `{body}` | Text typed by the admin when issuing (custom certificate) |
| `{issue_date}` | Date of issue |
| `{org_name}` | Quellflow Technologies LLP |
| `{student_type}` | paid / free / stipend |
| `{min_attendance}` | Minimum attendance %, e.g. 75 |

**Never** put amounts in documents. Fees and stipend are not printed on any document; the offer letter may say "as per the agreed terms".

### Self-check

1. Header has `type`, `title`, `requires_acceptance`; `type` is in the table above and matches the file name.
2. Every `{…}` in the body is in the placeholder list.
3. No digits that look like money (₹, Rs, INR, "/-").
4. No Markdown or HTML in the body.

---

## 4. Optional: Canva backgrounds `content/backgrounds/`

- Export from Canva as **PDF (standard)**, one page.
- Certificate: **A4 landscape** (297 × 210 mm). Letterhead: **A4 portrait** (210 × 297 mm).
- Design only the fixed artwork: border, logo, heading, decorative lines. **Leave empty space** for the name, body text, number, QR code (about 30 × 30 mm, bottom right), date and signature (bottom left/centre).
- File names: lowercase letters, digits, `.`, `-`, `_` only, ending in `.pdf` (e.g. `certificate-v1.pdf`).
- In `README.md`, list for each background the empty areas as `x, y, width, height` in mm from the top-left corner. The portal uses these to place the text.

---

## 5. Hand-off checklist

- [ ] Every plan file passes the §2 self-check (paste the result into `README.md`).
- [ ] Every document file passes the §3 self-check.
- [ ] Wording reviewed by Ashish or Dharmik (mark each file "approved" or "draft" in `README.md`).
- [ ] No personal data, fees or stipend amounts anywhere.
