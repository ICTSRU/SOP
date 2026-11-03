# SRU SOP Register — نموذج إجراء تشغيلي قياسي

**Form code:** SRU-FRM-SOP-01 · **Version:** 3.2 · **Owner:** ICTD — ITOC (IT Operations Center)
**Built on:** SRU Secure Access Kit v1.4 · **E-signatures:** ported from the ICTD Policy Platform v3.3

The SOP form runs **inside Google Apps Script**. Only Sulaiman Al Rajhi University accounts (@sr.edu.sa) on the access list can open it, read, save or sign SOPs. Every sign-in and every signing action is logged.

```
ictsru.github.io/SOP  →  Google sign-in (@sr.edu.sa)  →  Apps Script Web App (SOP form + e-signing)
 (branded landing)          (Google's own page)          domain + access-list check on every call
```

## Contents

| Path | Purpose | Where it goes |
|---|---|---|
| `apps-script/Code.gs` | Secure Access Kit: CONFIG, `doGet` (form · verification · how-to pages), `requireSruUser_()`, AccessLog, AllowedUsers, sheet menu | Apps Script project bound to the Sheet |
| `apps-script/Sop.gs` | SOP register: `apiList` / `apiGet` / `apiSave`, auto-numbering, SOPs · Steps · Versions tabs, signer list, edit lock, review reminders | same project — script `Sop` |
| `apps-script/Sign.gs` | **E-signatures:** own encrypted signature register, sign / unsign, final signed PDF, verification (`apiSign`) | same project — script `Sign` |
| `apps-script/Index.html` | SOP form page (editor right · live A4 preview left) | HTML `Index` |
| `apps-script/Board.html` | «لوحة حالة الإجراءات» — every SOP with its approval, signing, final-copy and review status (`apiBoard`) | HTML `Board` |
| `apps-script/Verify.html` | Verification page for signed SOPs (code, QR or PDF file) | HTML `Verify` |
| `apps-script/HowTo.html` | «كيفية التوقيع» animated explainer | HTML `HowTo` |
| `apps-script/Logos.html` · `Denied.html` | Embedded logos · "not allowed" page | HTML `Logos` · `Denied` |
| `github-landing/` | ITOC sign-in landing page **and `app.js` (page logic)** | GitHub repo `ictsru/SOP` |

## Sheet

`سجل الإجراءات التشغيلية - SRU SOP Register`
https://docs.google.com/spreadsheets/d/1_JJJYaSTAgGn4e3kUc58E71YJaZMqEqoV6Mp-hNzhig/edit

| Tab | Content |
|---|---|
| `SOPs` | One row per SOP (current version); JSON split over `json` … `json_8`; `rev`, `sign_status` |
| `Versions` | One row per SOP **version** — the signed text of every version stays here for verification |
| `Steps` | One row per step |
| `Signers` | **This platform's own** signature register (technical columns hidden) |
| `SigningLog` | Audit log of every signing action |
| `Signed` | Final signed copies: hashes, Drive file, verification code |
| `AllowedUsers` · `AccessLog` | Access list · sign-in log |

All tabs are created automatically. Private Drive folders (owner's Drive): `ICTD-SOP-Signatures-Encrypted`, `ICTD-SOP-Signature-Images`, `ICTD-SOP-Signed-PDFs`.
Script properties `SIG_PEPPER`, `SIG_FOLDER_ID`, `SIG_IMG_FOLDER_ID`, `SOP_FINAL_FOLDER_ID` — do not share or delete.

> ⚠️ Deleting or changing `SIG_PEPPER` invalidates every PIN; all signatures would have to be registered again.

## Updating from v3.1 on — automatic (GitHub → Apps Script)

The GitHub repo `ICTSRU/SOP` holds both parts: the site (`index.html`, `app.js`, `assets/`) and the server code (`apps-script/`).
A push that changes `apps-script/**` runs **Actions ▸ Deploy Apps Script**: it pushes the files to the Apps Script project and moves the existing deployment to a new version (**same /exec URL**). Setup and troubleshooting: [AUTODEPLOY.md](AUTODEPLOY.md).

- Edit code **only in GitHub** from now on (the Action replaces the project's code files with the repo's copy; `appsscript.json` is kept).
- Manual run: Actions ▸ Deploy Apps Script ▸ Run workflow. Rollback: Deploy ▸ Manage deployments ▸ ✏️ ▸ earlier version.
- The staff list is **not** in the code (public repo): manage people in the `AllowedUsers` tab.

## Upgrade from v2.9 (same project, same URL) — ≈3 min

1. **GitHub `ictsru/SOP`:** upload `github-landing/app.js` and `github-landing/index.html` (replace) → Commit.
2. **Apps Script:** replace `Code.gs`, `Sop.gs`, `Sign.gs`, `Index`, `Board`, `Verify`, `HowTo` → Save.
3. **Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy.**
4. **Test with a regular account:** no «جديد · تحميل المثال · JSON · استيراد» ✓ · «عرض التوقيع» shown as text ✓. **As admin:** change «عرض التوقيع (للمنصة)» → every SOP shows the new mode for everyone ✓.

## Roles (v3.0)

| Feature | admin (`AllowedUsers` role `admin` or `OWNER_EMAILS`) | Regular user |
|---|---|---|
| «جديد» · «تحميل المثال» · «JSON» · «استيراد» · board «＋ إجراء جديد» | ✓ | Hidden (not in the page; the functions refuse if called) |
| Signature display mode (platform-wide) | Chooses it | Sees it as text |
| All registered signatures; register one for someone else | ✓ | Own signatures only |

## Upgrade from v2.8 (same project, same URL) — ≈3 min

1. **GitHub `ictsru/SOP`:** upload `github-landing/app.js` and `github-landing/index.html` (replace) → Commit.
2. **Apps Script:** replace `Code.gs`, `Index`, `Board`, `Verify`, `HowTo`, `Denied` (and `Sop.gs`, `Sign.gs` — header comment only) → Save.
3. **Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy.**

## «Sorry, unable to open the file at this time» (Google Drive page)

This page comes from Google, before the platform runs. Causes and fixes:

| Cause | How to tell | Fix |
|---|---|---|
| **Several Google accounts in the same browser** — Apps Script web apps open only with the browser's first (default) account | The link works in an Incognito window signed in with that account only | Use «تبديل الحساب» (v2.9 signs out first, then you pick one account) · or a separate Chrome profile per account |
| **Google Drive is off for the account** (common for shared/service accounts) in the Admin console | It fails even in Incognito with that account only | Google Admin ▸ Apps ▸ Google Workspace ▸ **Drive and Docs** → ON for the account's organizational unit |
| The account is outside the deployment audience | Same as above | Deployment must stay *Execute as: Me · Who has access: Anyone within Sulaiman Al Rajhi University* |

## Upgrade from v2.7 (same project, same URL) — ≈5 min

1. **GitHub `ictsru/SOP`:** upload `github-landing/app.js` and `github-landing/index.html` (replace) → Commit.
2. **Apps Script:** replace `Code.gs`, `Sop.gs`, `Sign.gs`, `Index`, `Board`, `Verify`, `HowTo`, `Denied` → Save. No new permissions.
3. **Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy.**
4. **Test:** the chip at the top shows your initial, name and e-mail ✓ · «تبديل الحساب» opens Google's account chooser and returns to the platform ✓.

## Account chip and «تبديل الحساب» (v2.8)

| Where | What |
|---|---|
| Form · status board · verification page | Initial, name, e-mail and **«تبديل الحساب»** (v2.9: confirmation → signs the browser out of Google → account chooser → back to the same page) |
| «غير مصرح» page | «تبديل الحساب · Switch account» — for someone who opened the link with a personal or non-listed account |

- **Name:** the `name` column in `AllowedUsers`; if empty, the default list in `Code.gs`; otherwise derived from the e-mail (`s.reviewer` → S. Reviewer).
- **Why it signs out first:** with several Google accounts signed in, Apps Script opens only with the default one; a second account gets Google's «unable to open the file» page. Signing out leaves just the chosen account. It also signs out Gmail/Drive in that browser — sign back in afterwards, or use a separate Chrome profile per account.

## Upgrade from v2.6 (same project, same URL) — ≈5 min

1. **GitHub `ictsru/SOP`:** upload `github-landing/app.js` and `github-landing/index.html` (replace) → Commit.
2. **Apps Script:** replace `Code.gs`, `Sop.gs`, `Sign.gs`, `Index`, `Verify`, `HowTo`; **+ ▸ HTML** → `Board` → paste `Board.html` → Save. No new permissions.
3. **Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy.**
4. **Test:** in the form, **«لوحة الحالة»** opens the board (`…/exec?page=board`) ✓ · a tile filters the table ✓ · «فتح» opens the SOP ✓.

## Status board (v2.7)

`…/exec?page=board` — same @sr.edu.sa sign-in and access list as the form; data is read live from the `SOPs` and `Signed` tabs.

| Part | Content |
|---|---|
| Tiles (click = filter) | Total · مسودة · قيد المراجعة / التوقيع · معتمد · نسخة نهائية موقّعة · مراجعة دورية متأخرة |
| Filters | Search (number, title, owner) · department · status · signing (incl. «بانتظار توقيعي») · sort |
| Table | Number · title / department / owner · version · status · signatures (n/N, «بانتظار توقيعك») · final copy + verification code · next review («متأخرة» / «قريبًا» within 45 days) · last update |
| Actions | «فتح» (form, `?code=`) · «PDF» (archived signed copy) · «＋ إجراء جديد» (`?new=1`) · «تصدير Excel» (CSV, UTF-8) · «طباعة» (A4 landscape) |

## Upgrade from v2.5 (same project, same URL) — ≈5 min

1. **GitHub `ictsru/SOP`:** upload `github-landing/app.js` and `github-landing/index.html` (replace) → Commit.
2. **Apps Script:** replace `Code.gs`, `Sop.gs`, `Sign.gs`, `Index`, `Verify`, `HowTo` → Save. No new permissions; `setupSignatures` is not needed again.
3. **Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy.**
4. **Test (admin):** open a signed SOP → «عرض التوقيع» in the signing bar → switch text / image / blurred ✓ · «توقيعاتي» → set the platform default ✓.

## Upgrade from v2.4 (same project, same URL) — ≈10 min

1. **GitHub `ictsru/SOP`:** Add file ▸ Upload files → `github-landing/app.js` and `github-landing/index.html` (replace) → Commit.
2. Sheet → **Extensions ▸ Apps Script**:
   - replace **`Code.gs`**, **`Sop.gs`**, **`Index`**;
   - **+ ▸ Script** → `Sign` → paste `Sign.gs`;
   - **+ ▸ HTML** → `Verify`, then `HowTo` → paste each file. Save.
3. Run **`setupSignatures`** once (or menu **SRU SOP Register ▸ تهيئة التوقيع الإلكتروني**) and approve the new permissions (**Drive** and **Gmail**).
4. **Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version ▸ Deploy.** The URL stays the same.
5. **Test:** your account opens the form ✓ · «توقيعاتي» → add a signature ✓ · sign your box ✓ · a second account signs → final PDF arrives by e-mail ✓ · «التحقق» with the code ✓.

Existing SOPs keep working: their «إعداد / مراجعة / اعتماد» names become signer rows automatically — add each signer's e-mail and save.

## E-signatures (same mechanism as the policy platform)

**Independent signature register for the SOP platform only** — not linked to the policy or MoU platforms.

| # | Step |
|---|---|
| 1 | In **«ضبط الوثيقة والاعتماد»** add one row per signer (stage, name/title, university e-mail), then **Save to Sheets** |
| 2 | The owner of each e-mail opens the SOP and sees a **«توقيع»** button in their box only |
| 3 | No signature yet? **توقيعاتي ▸ إضافة توقيع** — upload or draw it, with a PIN of 8+ characters mixing letters and digits |
| 4 | **توقيع:** choose the signature, enter the PIN, confirm the declaration → the box shows the picture and a «✔ موقّع إلكترونيًا» stamp |
| 5 | After the first signature the SOP is **locked for editing**. To change it: each signer removes their signature with their PIN, or create a **new version (+0.1)** |
| 6 | When every box is signed: status **«معتمد»**, the browser builds the **final PDF** with a «شهادة التوقيع الإلكتروني» page (QR + verification code), saves it to Drive and e-mails it to the signers and the platform owner |

| Who | Can |
|---|---|
| Owner of the box's e-mail | Sign their box with their own signature; remove it before the final copy |
| Any allowed user | See stamps and status, download the signed PDF, verify |
| admin (`AllowedUsers` role or `OWNER_EMAILS`) | See all registered signatures and delete any; register a signature for someone else; issue the final copy |
| After the final copy | No edits or signature removal for that version — changes need a new version |

- **Security:** the picture is always encrypted (AES-256-GCM, key from the PIN) in the browser; the PIN and the clear picture never reach the server. 5 wrong PINs lock the signature for 15 minutes. Every action is recorded in `SigningLog`.
- **Content fingerprint:** each signature stores the SHA-256 of the SOP text it signed; later signatures keep earlier ones valid, any text change breaks the match.
- **Verification:** scan the QR on the certificate page, enter the code `XXXX-XXXX-XXXX` in **«التحقق»**, or drop the PDF file there (its fingerprint is computed in the browser — the file is not uploaded).
- **Not ported:** the policy platform's three-level roles (admin comes from `AllowedUsers` role `admin` or `OWNER_EMAILS`).

## Signature display (admin only · platform-wide since v3.0)

| Mode | In the box (screen and print) | Final signed PDF | Stored in the record |
|---|---|---|---|
| **نص التوقيع فقط** · Signature text | Signer's name as text + e-signature stamp | Same (no picture) | No picture |
| **صورة التوقيع** · Signature image | Signature picture + stamp | Picture + stamp | — (the picture is served from the private vault) |
| **صورة مموّهة** · Blurred image | Blurred picture + stamp | **Clear** picture + stamp | Blurred copy only; the clear picture is released only to render the final PDF, for signers/admins, and logged as `final-images` |

- **One setting for the whole platform** (script property `SIG_DISPLAY_DEFAULT`; initial value: صورة التوقيع). Only an admin changes it — from **«عرض التوقيع (للمنصة)»** in the signing bar or **«توقيعاتي» ▸ طريقة عرض التوقيع في المنصة** — after a confirmation. It applies at once to every SOP and every user.
- Regular users see the current mode as text; the server refuses `setDisplay` / `setDefaultDisplay` from them, and any `sig_display` sent with a save is ignored.
- Final signed PDFs already archived do not change.
- Changing the mode never changes the signed content (excluded from the content hash), so signatures stay valid.
- The blurred copy is made irreversibly in the signer's browser at signing time (signatures from v2.5 get one when an admin switches to blurred while that SOP is open).

## Links

| Link | Opens |
|---|---|
| `…/exec` | SOP form |
| `…/exec?code=ICTD-SOP-001` | that SOP, loaded in the form |
| `…/exec?page=verify` · `…/exec?verify=XXXX-XXXX-XXXX` | verification page · result for a code |
| `…/exec?page=howto` | «كيفية التوقيع» |
| `…/exec?page=board` | «لوحة حالة الإجراءات» (status board) |
| `…/exec?new=1` | form with a blank new SOP |

## Access list

- `ACCESS_MODE = 'LIST'` (in `Code.gs`): only active rows in `AllowedUsers`, plus `OWNER_EMAILS`.
- Add a row to grant access; untick **active** to suspend; changes apply within 2 minutes. Role `admin` = signature-register admin.

## Updating code later

Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version — the URL stays the same. Raise `APP_VERSION` in `Code.gs` so browsers fetch the new `app.js`.
