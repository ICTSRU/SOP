# CHANGELOG — SRU SOP Template (SRU-FRM-SOP-01)

## 1.2 — 2026-09-29
- Print/PDF: table column widths now proportional to the A4 page, so step descriptions get most of the row width.

## 1.1 — 2026-09-28
- Official logos added to the header band: Sulaiman Alrajhi University (right) and ICTD (left).
- Logos embedded in the page as data URIs, so the form works as a single file and the logos appear in print/PDF; copies kept in `assets/`.
- Compact logo sizing on the printed A4 page.

## 1.0 — 2026-09-28
- First release.
- Bilingual RTL form with 7 sections: identification; purpose/scope/owner; request channel, prerequisites, approvals; numbered steps with roles; target time and escalation; verification, closure evidence, exceptions; document control and revision history.
- Worked example: New Staff User Account Provisioning (ICTD).
- A4 print / PDF view with signature block and version footer.
- Google Sheets backend (Apps Script): upsert by SOP number, per-unit auto-numbering `{UNIT}-SOP-NNN`, `SOPs` + `Steps` tabs, register listing and reload.
- Version helper enforcing single-digit decimal rule (x.9 → (x+1).0).
- Auto review date from approval date + review cycle; weekly review reminders to owners and admin digest.
- Local auto-draft, JSON export/import.
