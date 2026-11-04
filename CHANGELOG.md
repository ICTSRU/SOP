# CHANGELOG — SRU SOP Template (SRU-FRM-SOP-01)

## 3.3 — 2026-11-04
### Changed
- **Regular users can add a new SOP again**: «جديد» in the form and «＋ إجراء جديد» on the status board (and `?new=1`) are available to everyone. «تحميل المثال», «JSON» and «استيراد» stay admin-only.

## 3.2 — 2026-11-03
### Changed
- The status line under the header («مسودة محفوظة محليًا · المعاينة محدّثة») is removed; save results appear as notifications.
- The signing bar appears only once the SOP has signatures (lock, final copy, new version); the «التوقيع الإلكتروني: 0 من N…» line is removed.
- «عرض التوقيع (للمنصة)» moved up into the purple header next to the form version (admins: selector · others: text).

## 3.1 — 2026-11-03
### Added
- **Automatic Apps Script update from GitHub**: `.github/workflows/deploy-apps-script.yml` (clasp 2.4.2) pushes `apps-script/` to the project and moves the existing web-app deployment to a new version on every change — same /exec URL. Guide: `AUTODEPLOY.md`.
- Server files are kept in the repo under `apps-script/`.
### Changed
- `DEFAULT_ALLOWED` in `Code.gs` is empty (the repo is public); the access list lives only in the `AllowedUsers` tab.

## 3.0 — 2026-11-03
### Changed
- **Signature display is one platform-wide setting, chosen by admins only** and applied to every SOP and every user at once (confirmation first). Per-SOP values (`sig_display`, v2.6–2.9) are ignored; archived final PDFs are unchanged.
- The admin selector reads «عرض التوقيع (للمنصة)»; «توقيعاتي» shows «طريقة عرض التوقيع في المنصة».
- **«جديد», «تحميل المثال», «JSON», «استيراد»** (and the board's «＋ إجراء جديد») are rendered for admins only; the functions refuse when called by others; a regular user starts from a blank form instead of the example; `?new=1` is ignored for regular users.

## 2.9 — 2026-11-03
### Fixed
- Switching to another account (e.g. itoc@sr.edu.sa) showed Google's «عذرًا، يتعذّر فتح الملف في الوقت الحالي» page: Apps Script web apps open only with the browser's default Google account. «تبديل الحساب» now asks for confirmation, signs the browser out of Google, opens the account chooser and returns to the same page, so the chosen account is the only (default) one.
### Changed
- The separate «خروج» link is removed (the switch button now does it); the access-denied page has one «تبديل الحساب» button with a short explanation.
- README: troubleshooting table for Google's «unable to open the file» page (multiple accounts · Drive off for the account · deployment audience).

## 2.8 — 2026-11-03
Account switching.
### Added
- Account chip in the header of the form, the status board and the verification page: initial, name, e-mail and **«تبديل الحساب»** (opens Google's account chooser and returns to the same page), plus a small «خروج» link.
- «تبديل الحساب» and «تسجيل الخروج» buttons on the access-denied page (personal or non-listed accounts).
- Server `userName_()` (name from `AllowedUsers`, the default list, or the e-mail) and `accountUrls_()`.
### Changed
- The header e-mail badge is replaced by the account chip.

## 2.7 — 2026-11-03
SOP status board.
### Added
- **«لوحة حالة الإجراءات»** (`?page=board`, new file `Board.html`): every SOP in the register with status, signing progress, final signed copy (verification code), next review date and last update.
- Six clickable KPI tiles (total, draft, under review, approved, final signed, review overdue); search, department, status, signing («بانتظار توقيعي») and sort filters.
- Actions: open in the form, download the archived signed PDF, new SOP, export to Excel (CSV, UTF-8), print (A4 landscape).
- Server `apiBoard()` — one call, access-checked (`requireSruUser_`).
- Form toolbar button «لوحة الحالة»; `?new=1` opens the form with a blank SOP.

## 2.6 — 2026-11-03
Signature display modes, ported from the ICTD Policy Platform v3.3 (an admin setting).
### Added
- Three ways to show a signature in the approval boxes: **نص التوقيع فقط** (signer's name as text + stamp, no picture), **صورة التوقيع** (picture), **صورة مموّهة** (blurred on screen, clear only in the final signed PDF).
- Admin selector «عرض التوقيع» in the signing bar (per SOP version, until the final PDF); other users see the mode as text.
- Platform default in «توقيعاتي» (admin), stored as `SIG_DISPLAY_DEFAULT`, pinned to each SOP at its first signature.
- Blurred copy made in the signer's browser when signing; the clear picture stays in the private vault and is released only to render the final PDF (`finalImages`, logged).
- SigningLog actions `display-mode`, `display-default`, `final-images`.
- «كيفية التوقيع»: the «طرق عرض التوقيع» scene is back (12 scenes).
### Changed
- `sig_display` is excluded from the content hash (signatures stay valid when the mode changes); a normal save keeps the stored mode.

## 2.5 — 2026-11-02
E-signatures, ported from the ICTD Policy Platform v3.3 — with this platform's **own** register.
### Added
- **Flexible signer list** in «ضبط الوثيقة والاعتماد» (stage · name/title · university e-mail), replacing the fixed إعداد / مراجعة / اعتماد fields; older SOPs are converted automatically.
- **«توقيعاتي»**: add a signature by upload or drawing, protected by a PIN (8+ characters, letters and digits); preview, change PIN, delete. Encrypted in the browser (AES-256-GCM, PBKDF2 310,000); the PIN and the clear picture never reach the server. Admins see all signatures and can register one for someone else.
- **Signing in the document:** «توقيع» appears only in the box whose e-mail matches the signed-in account; the box shows the signature picture and a «✔ موقّع إلكترونيًا» stamp (name, title, time, content SHA-256). Owners can remove their own signature with their PIN.
- **Lock:** after the first signature the SOP is read-only (enforced on the server); «إصدار جديد للتعديل» creates the next version (+0.1) without signatures. Status moves مسودة → قيد المراجعة → معتمد.
- **Final signed PDF** when all boxes are signed: A4 pages with the logo header on each page, signature boxes, page numbers, and a «شهادة التوقيع الإلكتروني» page with QR and verification code; archived in Drive (`ICTD-SOP-Signed-PDFs`), e-mailed to signers and owner, downloadable.
- **Verification page** (`?page=verify`, `?verify=CODE`): by code, QR or PDF file fingerprint; flags superseded versions.
- **«كيفية التوقيع»** explainer page (`?page=howto`), adapted from the policy platform.
- New sheets `Versions`, `Signers`, `SigningLog`, `Signed`; SOP JSON split over up to 8 cells; `rev` and `sign_status` columns; signing status in the saved-SOPs dropdown.
- Deep link `?code=ICTD-SOP-NNN` opens that SOP.
- Sheet menu: «تهيئة التوقيع الإلكتروني» (`setupSignatures`).
### Fixed
- Auto-numbering never reuses a number already in the sheet, even if the counter was reset (previously a reset counter could overwrite an existing SOP).

## 2.4 — 2026-11-02
Layout aligned with the ICTD Policy platform.
- Split workspace: **editing panel on the right**, **live A4 preview of the SOP on the left**; each pane scrolls on its own.
- The preview updates as you type and is exactly what **Print / PDF** produces; it scales to fit the pane (zoom shown in the preview bar).
- Repeating rows (approvals, steps, escalation, revisions) shown as compact cards in the editing panel, with move/delete per card.
- Header per SRU brand kit: white brand bar with 40px logos, purple strip with the university/directorate name and the signed-in e-mail, title and buttons on the **SRU Tech Background · Network** band; status line below the band.
- Footer on the dark network band with the ITOC logo at bottom-left and the version badge.
- Small screens (under 1000px): panes stack with «تحرير / معاينة» tabs.
- Server code (`Sop.gs`) unchanged; `Code.gs` only bumps `APP_VERSION` (also refreshes the cached `app.js`).

## 2.3 — 2026-10-14
- Fix: form logic still failed inside the Apps Script page ("Unexpected end of input"). The page logic is now `app.js`, hosted on GitHub Pages (`ictsru/SOP`) and loaded with `<script src>` (`APP_JS_URL` in Code.gs). No large script is pasted into Apps Script any more; `App.html` removed.
- `app.js` holds no data or secrets; every read/save is still checked on the server.
- Version query (`?v=2.3`) refreshes browser caches after each release.
- Status bar says clearly if `app.js` could not be loaded; page errors now name the file and line.

## 2.2 — 2026-10-14
- Fix: form script did not run when served by Apps Script ("applyLogos is not defined"). The page logic now lives in a new file `App.html`, included raw with `include('App')`, so Apps Script's template engine no longer processes it. `Index.html` keeps only markup and the three template values.
- Error reporter keeps the first page error and shows its line number.
- Logos still appear (ITOC-site fallback) even if the page logic fails.

## 2.1 — 2026-10-14
- Fix: logos missing and form not loading (empty form, dropdown stuck on «جارٍ تحميل السجلات») when `Logos.html` was pasted incompletely — its unterminated script swallowed the form script.
- `Logos` is now included after the form script, so a damaged Logos file can no longer stop the form.
- Logo fallback: if the embedded logos are missing, the page uses the images on the ITOC site (ictsru.github.io/ITOC/assets).
- Page errors are shown in the status bar instead of failing silently.

## 2.0 — 2026-10-14
Secure edition, built on **SRU Secure Access Kit v1.4**.
- Form moved into Apps Script (`Index.html`), served only after Google sign-in with an @sr.edu.sa account.
- Access list (`AllowedUsers`, 13 ICTD accounts by default) checked on page load **and** on every save/read (`requireSruUser_`).
- Every sign-in logged to `AccessLog` (date, time, day, e-mail, result, version); denied and non-listed attempts logged too.
- Public JSON API removed (`doPost`, `?action=list/get`); the page uses guarded `google.script.run` calls `apiList`, `apiGet`, `apiSave`.
- SOP logic split into `Sop.gs`; kit `Code.gs` holds access control.
- New audit columns `created_by`, `updated_by`; existing sheets are widened automatically.
- Signed-in e-mail shown in the header; save confirmation shows who saved.
- Logos from the kit's `Logos.html` (no external image requests); ITOC logo embedded in the screen footer and print footer.
- Saved-SOPs list delivered with the page (no extra round trip).
- Branded ITOC sign-in landing page for GitHub Pages (`github-landing/`).
- Removed: URL settings dialog.

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
