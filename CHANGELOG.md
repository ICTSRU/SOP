# CHANGELOG — SRU SOP Template (SRU-FRM-SOP-01)

## 1.8 — 2026-09-30
- Fix: saving failed with "Run setup() first" when the SOPs/Steps tabs had not been created. Code.gs (backend 1.2) now creates the tabs automatically on the first read or save (`ensureSheets()`); `setup()` is only needed for the weekly reminder trigger.
- Form now shows the exact save error in the status bar and toast instead of a generic "تعذّر الحفظ".

## 1.7 — 2026-09-30
- ITOC (IT Operations Center) logo added at the bottom-left of the page footer and of the printed/PDF document, linked to https://ictsru.github.io/ITOC/ (opens in a new tab).
- Logo loaded from the ITOC site (assets/itoc-logo.png) so it stays in sync; text fallback "ITOC" if offline.

## 1.6 — 2026-09-30
- Print/PDF: both official logos (SRU right, ICTD left) now repeat at the top of every page, with the SOP number, version and title between them.

## 1.5 — 2026-09-30
- New "Saved SOPs" dropdown at the top of the form: lists every record in the Google Sheet (number — title — version — status), loads the chosen SOP for review and editing; saving updates the same row.
- Mode badge shows whether you are editing a saved record (number + version) or writing a new SOP.
- Unsaved-changes warning before switching records, loading the example, or importing.
- Saving an approved SOP on the same version asks for confirmation (suggests +0.1 for a new version).
- List refreshes automatically on open and after each save; manual refresh button.

## 1.4 — 2026-09-30
- Apps Script Web App URL pinned in `SCRIPT_URL`; the form saves to the SRU SOP Register Sheet with no setup per user.
- Settings field is now an optional override (leave empty to use the pinned URL).

## 1.3 — 2026-09-30
- Google Sheet created: "سجل الإجراءات التشغيلية - SRU SOP Register" (id 1_JJJYaSTAgGn4e3kUc58E71YJaZMqEqoV6Mp-hNzhig).
- Code.gs (backend 1.1): setup() renames the first tab to SOPs instead of adding a new one.

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
