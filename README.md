# SRU SOP Register — نموذج إجراء تشغيلي قياسي

**Form code:** SRU-FRM-SOP-01 · **Version:** 2.0 · **Owner:** ICTD — ITOC (IT Operations Center)
**Built on:** SRU Secure Access Kit v1.4

The SOP form now runs **inside Google Apps Script**. Only Sulaiman Al Rajhi University accounts (@sr.edu.sa) that are on the access list can open it, read SOPs or save them. Every sign-in is logged.

```
ictsru.github.io/SOP  →  Google sign-in (@sr.edu.sa)  →  Apps Script Web App (SOP form)
 (branded landing)          (Google's own page)          domain + access-list check on every call
```

## Contents

| Path | Purpose |
|---|---|
| `apps-script/Code.gs` | Secure Access Kit: CONFIG, `doGet` with domain/list check, `requireSruUser_()`, AccessLog, AllowedUsers, sheet menu |
| `apps-script/Sop.gs` | SOP logic: `apiList` / `apiGet` / `apiSave` (each guarded), auto-numbering, SOPs + Steps tabs, review reminders |
| `apps-script/Index.html` | The SOP form (served by Apps Script, shows the signed-in e-mail) |
| `apps-script/Logos.html` | SRU, ICTD, ITOC logos (embedded) |
| `apps-script/Denied.html` | Page for non-university or non-listed accounts |
| `github-landing/` | Branded ITOC sign-in page for GitHub Pages (CONFIG already filled) |

## Sheet

`سجل الإجراءات التشغيلية - SRU SOP Register`
https://docs.google.com/spreadsheets/d/1_JJJYaSTAgGn4e3kUc58E71YJaZMqEqoV6Mp-hNzhig/edit

| Tab | Content |
|---|---|
| `SOPs` | One row per SOP (42 columns incl. `created_by`, `updated_by`) |
| `Steps` | One row per step |
| `AllowedUsers` | Who may open the platform (email · name · role · active · notes) |
| `AccessLog` | Every sign-in: date, time, day, e-mail, result, version |

Tabs are created automatically. The existing "Untitled" tab becomes `SOPs`.

## Upgrade from v1.x (same project, same URL) — ≈10 min

1. Open the Sheet → **Extensions ▸ Apps Script**.
2. **Code.gs**: replace all content with `apps-script/Code.gs`.
3. **+ ▸ Script** → name it `Sop` → paste `apps-script/Sop.gs`.
4. **+ ▸ HTML** three times → `Index`, `Logos`, `Denied` → paste each file (names without `.html`).
5. Save. Run **`setup`** once (tabs + weekly reminder), then **`setupAccessList`** (adds the 13 ICTD accounts). Approve permissions.
6. **Deploy ▸ Manage deployments ▸ ✏️** → Version: **New version** · Execute as: **Me** · Who has access: **Anyone within Sulaiman Al Rajhi University** → Deploy. The URL stays the same.
7. **GitHub:** create repo `ictsru/SOP`, upload the contents of `github-landing/`, enable Pages (main / root). Link: `https://ictsru.github.io/SOP/`.
8. **Test:** own account ✓ · team member ✓ · personal Gmail → refused ✓ · @sr.edu.sa not on the list → "الوصول مقيّد" ✓.
9. Add the GitHub link to the ITOC Index (`Links` sheet).

The old GitHub-hosted form (v1.x `index.html` calling `/exec` with `fetch`) no longer works after step 6 — remove or redirect it to the landing page.

## Access list

- `ACCESS_MODE = 'LIST'` (in `Code.gs`): only active rows in `AllowedUsers`, plus `OWNER_EMAILS`.
- Add a row to grant access; untick **active** to suspend; changes apply within 2 minutes.
- Use `'DOMAIN'` to open it to every @sr.edu.sa account.

## Features (unchanged from v1.8)

Saved-SOPs dropdown (review/edit), auto-numbering `{UNIT}-SOP-NNN`, +0.1 version helper, approved-version guard, print/PDF with logos on every page and ITOC footer, JSON export/import, local draft, weekly review reminders (Sunday 07:00 Riyadh).

## Updating code later

Deploy ▸ Manage deployments ▸ ✏️ ▸ Version: New version — the URL stays the same.
