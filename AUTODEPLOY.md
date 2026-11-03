# SRU SOP Register — automatic Apps Script update (autodeploy v1.0)

After a **one-time setup (~15 min)**, updating the platform means only: **upload the files to GitHub**.
GitHub then pushes them to Apps Script and publishes a new version on the **same /exec URL** — no copy-paste, no "Manage deployments".

```
GitHub repo (apps-script/ + app.js)  ──push──▶  GitHub Action (clasp)  ──▶  Apps Script project + New version (same URL)
```

## One-time setup

| # | Step | Where |
|---|---|---|
| 1 | **Apps Script API → ON** (account that owns the project: m.elmahdy@sr.edu.sa) | script.google.com/home/usersettings |
| 2 | On any computer with Node.js: `npx @google/clasp@2.4.2 login` → sign in with the same account → open the file **`~/.clasprc.json`** (Windows: `C:\Users\<you>\.clasprc.json`) and copy its whole content | Your computer (one time) |
| 3 | **Script ID**: Apps Script ▸ ⚙️ Project Settings ▸ IDs ▸ Script ID | Apps Script editor |
| 4 | **Deployment ID**: Deploy ▸ Manage deployments ▸ the active web app ▸ Deployment ID (`AKfycb…`) | Apps Script editor |
| 5 | GitHub repo ▸ Settings ▸ Secrets and variables ▸ Actions ▸ **New repository secret** ×3: `CLASPRC_JSON` (step 2) · `SCRIPT_ID` (step 3) · `DEPLOYMENT_ID` (step 4) | GitHub |
| 6 | Add to the repo: folder **`apps-script/`** (the 9 files from the release zip) and **`.github/workflows/deploy-apps-script.yml`** (this kit) | GitHub |
| 7 | Actions tab ▸ **Deploy Apps Script** ▸ **Run workflow** → green ✅ = done | GitHub |

## Every update afterwards

Upload the changed files (`apps-script/*` and/or `app.js`, `index.html`) to the repo → **Commit**. The Action runs within ~1 minute; the summary shows "Apps Script updated to vX.Y".

## Notes

- **Privacy:** the `ictsru/SOP` repo is public (GitHub Pages). `Code.gs` lists staff e-mails (`OWNER_EMAILS`, `DEFAULT_ALLOWED`). Either keep the server files in a **private repo** (e.g. `ictsru/SOP-server`, with this workflow) or empty those lists in the code (the AllowedUsers sheet is the real list). No secret is in the code: the signature pepper and folder IDs live in Script Properties.
- The workflow keeps the project's own `appsscript.json` (pulled before each push), and replaces all code files with the repo's copy — edit code only in GitHub from now on.
- If the Workspace admin blocks third-party apps, allow **"clasp"** (Google Apps Script CLI) in Google Admin ▸ Security ▸ API controls.
- `.clasprc.json` gives access to your Apps Script projects: keep it only in the GitHub secret, then delete the local copy if you wish.
- Rollback: Deploy ▸ Manage deployments ▸ ✏️ ▸ choose an earlier version.
