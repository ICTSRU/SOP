# SRU SOP Template — نموذج إجراء تشغيلي قياسي

**Form code:** SRU-FRM-SOP-01 · **Version:** 1.8 · **Owner:** ICTD — IT Operations

A bilingual (Arabic RTL / English) web form for writing Standard Operating Procedures, printing them as A4 / PDF, and keeping a central register in Google Sheets.

## Contents

| Path | Purpose |
|---|---|
| `index.html` | The form (fill → print/PDF → save to Sheets) |
| `apps-script/Code.gs` | Google Sheets backend (save, auto-numbering, register, reminders) |
| `assets/` | Official `sru-logo.png` and `ictd-logo.png` (already embedded in `index.html`) |
| `CHANGELOG.md` | Change record |

## SOP sections covered

1. Identification — unit code, auto SOP number, status, classification, titles, category
2. Purpose, scope (in / out), owner (role, name, email)
3. Request channel, prerequisites, required approvals (table)
4. Numbered steps with responsible role, duration, output (reorderable)
5. Target completion time, priority, SLA start, escalation levels (table)
6. Verification, closure evidence, exceptions, references
7. Document control — version, effective date, review cycle → next review date, prepared / reviewed / approved, revision history

A worked example (**New Staff User Account Provisioning**) loads by default and via **تحميل المثال**.

## Setup (≈10 minutes)

1. Open the Sheet `سجل الإجراءات التشغيلية - SRU SOP Register`: https://docs.google.com/spreadsheets/d/1_JJJYaSTAgGn4e3kUc58E71YJaZMqEqoV6Mp-hNzhig/edit
2. **Extensions → Apps Script**, paste `apps-script/Code.gs`, save.
3. Run **`setup()`** once and approve — creates the `SOPs` and `Steps` tabs and the weekly reminder trigger.
4. **Deploy → New deployment → Web app** — Execute as *Me*, access *Anyone within sr.edu.sa*.
5. Web App URL (already pinned in `index.html`): https://script.google.com/macros/s/AKfycbxOekzfS17J1t3bHf2YIALRZ_i6eI5RDKWdfiIGvQbPfUnukKUUAstwGg5RLSRmpaof/exec
6. Host `index.html` + `assets/` on GitHub Pages (or open locally).

## How it works

| Action | Result |
|---|---|
| حفظ في Google Sheets | Validates required fields → first save allocates `{UNIT}-SOP-NNN` (e.g. `ICTD-SOP-001`); later saves update the same row |
| Saved SOPs dropdown | Pick any saved SOP to review/edit it; save updates the same record |
| السجل | Lists saved SOPs with status and review date (overdue in red); click to reload into the form |
| طباعة / PDF | Builds a clean A4 document with signature block; filename suggested as `SOPNo_vX.Y_Title` |
| +0.1 | Next version (1.9 → 2.0), adds a revision-history row, resets status to Draft |
| JSON / استيراد | Offline backup and transfer of a single SOP |
| Auto draft | Every edit is saved in the browser, so nothing is lost on refresh |

**Automation:** every Sunday 07:00 (Riyadh), owners of SOPs due for review within 30 days (or overdue) get an email, and a digest goes to `m.elmahdy@sr.edu.sa`. Adjust `REMINDER_DAYS` / `ADMIN_EMAIL` in `Code.gs`.
