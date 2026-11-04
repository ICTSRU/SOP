/**
 * =====================================================================
 *  SRU SOP Register (SRU-FRM-SOP-01) v3.3 — built on SRU Secure Access Kit v1.4
 *  Access: Sulaiman Al Rajhi University Google accounts (@sr.edu.sa) only
 *  ICTD — ITOC
 * ---------------------------------------------------------------------
 *  Files:  Code.gs (access) · Sop.gs (SOP logic) · Sign.gs (e-signatures) · Index.html · Verify.html · HowTo.html · Logos.html · Denied.html
 *          + app.js on GitHub Pages (APP_JS_URL)
 *  Deploy: Deploy ▸ New deployment ▸ Web app
 *          Execute as: Me  ·  Who has access: Anyone within Sulaiman Al Rajhi University
 *  Access log: every sign-in → sheet "AccessLog" (see LOG_* settings)
 *  Access list: only active emails in sheet "AllowedUsers" (ACCESS_MODE = 'LIST')
 * =====================================================================
 */

/* ▼▼▼ CONFIG — change per platform ▼▼▼ */
const APP_NAME       = 'نموذج إجراء تشغيلي قياسي';   // Arabic title shown in the page
const APP_NAME_EN    = 'SRU SOP Register';     // English name
const APP_VERSION    = '3.3';
const ALLOWED_DOMAIN = 'sr.edu.sa';
const FAVICON_URL    = 'https://ictsru.github.io/ITOC/assets/itoc-logo.png';
const APP_JS_URL     = 'https://ictsru.github.io/SOP/app.js';   // page logic, uploaded to the GitHub repo ictsru/SOP

/* Access log */
const LOG_ENABLED        = true;
const LOG_SPREADSHEET_ID = '';            // '' = the spreadsheet this script is bound to; or paste a Sheet ID
const SHEET_LOG          = 'AccessLog';
const LOG_TIMEZONE       = 'Asia/Riyadh';
const LOG_DEDUP_MINUTES  = 30;            // same user within N min = one entry (0 = log every page open)
const LOG_RETENTION_DAYS = 180;           // menu: delete entries older than this
/* Access list (who may open the platform) */
const ACCESS_MODE        = 'LIST';         // 'LIST' = only active emails in the AllowedUsers tab · 'DOMAIN' = any @sr.edu.sa account
const ACCESS_SPREADSHEET_ID = ''           ;  // where the AllowedUsers tab lives
const SHEET_ACCESS       = 'AllowedUsers';
const OWNER_EMAILS       = ['m.elmahdy@sr.edu.sa']; // always allowed, so the owner can never be locked out

/* Default access list — added to AllowedUsers by setupAccessList() (existing rows are kept).
   v3.1: left empty because this file is published in the public GitHub repo. The real list (e-mail, name, role)
   lives only in the AllowedUsers tab of the Sheet — add people there. Format: ['name@sr.edu.sa', 'Name', 'admin'|'user', 'notes'] */
const DEFAULT_ALLOWED = [];
const ACCESS_CACHE_SECONDS = 120;          // list changes take effect within 2 minutes
/* ▲▲▲ CONFIG ▲▲▲ */

const LOG_HEADERS = ['timestamp', 'date', 'time', 'day', 'email', 'result', 'version'];
const DAYS_AR_    = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']; // index = ISO day % 7

/* ----------------------------- Web app ------------------------------ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  const email = currentEmail_();
  const status = accessStatus_(email);
  if (status !== 'ok') {
    logAccess_(email || '(unknown)', status === 'list' ? 'not-listed' : 'denied');
    const d = HtmlService.createTemplateFromFile('Denied');
    d.appName = APP_NAME; d.appNameEn = APP_NAME_EN;
    d.userEmail = email || '';
    const acc = accountUrls_(String(p.page || ''));
    d.switchUrl = acc.switchUrl; d.logoutUrl = acc.logoutUrl;
    d.reason = status;
    return d.evaluate().setTitle(APP_NAME + ' | غير مصرح')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  logAccess_(email, 'granted');

  /* v2.5: verification page (?page=verify or ?verify=CODE) and «كيفية التوقيع» (?page=howto).
     They are served as plain HTML (no template processing); boot data replaces the config.js line. */
  const pg = String(p.page || '').toLowerCase();
  /* v2.7: status board (?page=board) — same plain-HTML route. */
  if (pg === 'howto' || pg === 'verify' || pg === 'board' || p.verify != null) {
    const isHow = pg === 'howto', isBoard = pg === 'board' && p.verify == null;
    const boot = { gas: true, app: APP_NAME, appEn: APP_NAME_EN, version: APP_VERSION, user: email,
                   admin: isAdmin_(email), baseUrl: ScriptApp.getService().getUrl(),
                   params: p.verify != null ? { verify: String(p.verify).slice(0, 20) } : {} };
    boot.userName = userName_(email);
    const acc = accountUrls_(isBoard ? 'board' : pg); boot.switchUrl = acc.switchUrl; boot.logoutUrl = acc.logoutUrl;
    const inject = '<script>window.BOOT=' + safeJson_(boot) + ';</script>' + (isHow ? '' : include('Logos'));
    const html = HtmlService.createHtmlOutputFromFile(isHow ? 'HowTo' : isBoard ? 'Board' : 'Verify').getContent()
      .replace('<script src="config.js"></script>', function () { return inject; });
    const page = HtmlService.createHtmlOutput(html)
      .setTitle((isHow ? 'كيفية التوقيع' : isBoard ? 'لوحة حالة الإجراءات' : 'التحقق من إجراء موقّع') + ' | ' + APP_NAME_EN)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    if (FAVICON_URL) page.setFaviconUrl(FAVICON_URL);
    return page;
  }

  const t = HtmlService.createTemplateFromFile('Index');
  t.appName   = APP_NAME;
  t.appNameEn = APP_NAME_EN;
  t.version   = APP_VERSION;
  t.userEmail = email;
  t.userName  = userName_(email);
  t.isAdmin   = isAdmin_(email);     // «تحميل المثال · JSON · استيراد» are shown to admins only (v3.3: «جديد» for everyone)
  t.userRole  = t.isAdmin ? 'مسؤول المنصة' : 'مستخدم المنصة';
  const acc = accountUrls_('');
  t.switchUrl = acc.switchUrl;
  t.logoutUrl = acc.logoutUrl;
  t.appJsUrl  = APP_JS_URL + '?v=' + APP_VERSION;   // version busts the browser cache after each release
  t.dataJson  = safeJson_(getInitialData_(email, p));   // data rendered into the page (no extra round trip)
  const out = t.evaluate().setTitle(APP_NAME_EN + ' | ' + APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  if (FAVICON_URL) out.setFaviconUrl(FAVICON_URL);
  return out;
}

/** Data rendered into the page on load: SOP list, signed-in user, admin flag, links (v2.5). */
function getInitialData_(email, p) {
  p = p || {};
  const base = { user: email || '', admin: email ? isAdmin_(email) : false, baseUrl: ScriptApp.getService().getUrl(),
                 displayDefault: typeof displayDefault_ === 'function' ? displayDefault_() : 'image',
                 params: { code: String(p.code || '').slice(0, 40), view: p.view != null, fresh: p['new'] != null } };
  try { base.items = listSops(); }
  catch (e) { base.items = []; base.error = String(e.message || e); }
  return base;
}

/* ------------------- Server calls from the page --------------------- */
/*  EVERY function called via google.script.run must start with
 *  requireSruUser_() — the page check alone is not enough.            */

/*  SOP page API lives in Sop.gs: apiList(), apiGet(id), apiSave(data)
 *  — each one starts with requireSruUser_().                           */

/* ------------------------------ Access ------------------------------ */

function currentEmail_() {
  return String(Session.getActiveUser().getEmail() || '').toLowerCase();
}
function isAllowed_(email) {
  return !!email && email.endsWith('@' + ALLOWED_DOMAIN);
}
function requireSruUser_() {
  const email = currentEmail_();
  const status = accessStatus_(email);
  if (status === 'domain') throw new Error('غير مصرح — الدخول لمنسوبي الجامعة فقط');
  if (status === 'list') throw new Error('غير مصرح — حسابك غير مضاف إلى قائمة المصرّح لهم');
  return email;
}

/* ---------------------------- Access list --------------------------- */

const ACCESS_HEADERS = ['email', 'name', 'role', 'active', 'notes'];

/* ---------------------- Account chip + switch (v2.8 · switch flow v2.9) ---------------------- */
/** Display name: AllowedUsers «name» → default list → derived from the e-mail (m.elmahdy → M. Elmahdy). */
function userName_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return '';
  try {
    const sh = accessSheet_(false);
    if (sh && sh.getLastRow() > 1) {
      const hit = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
        .filter(function (r) { return String(r[0]).trim().toLowerCase() === email && String(r[1]).trim(); })[0];
      if (hit) return String(hit[1]).trim();
    }
  } catch (e) {}
  const d = DEFAULT_ALLOWED.filter(function (r) { return r[0] === email && r[1]; })[0];
  if (d) return d[1];
  return email.split('@')[0].split(/[._-]+/).filter(String)
    .map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1) + (w.length === 1 ? '.' : ''); }).join(' ');
}
/** «تبديل الحساب» (v2.9): sign the browser out of Google, then the account chooser, then back to this page.
 *  Apps Script web apps open only with the browser's DEFAULT Google account; opening them with a second
 *  signed-in account fails with Google's «Sorry, unable to open the file at this time». Signing out first
 *  leaves exactly one account (the chosen one), which becomes the default. */
function accountUrls_(page) {
  const app = ScriptApp.getService().getUrl() + (page ? '?page=' + page : '');
  const chooser = 'https://accounts.google.com/AccountChooser?continue=' + encodeURIComponent(app);
  const out = 'https://accounts.google.com/Logout?continue=' + encodeURIComponent(chooser);
  return { switchUrl: out, logoutUrl: out };
}

/** 'ok' | 'domain' (not @sr.edu.sa) | 'list' (not on the active list) */
function accessStatus_(email) {
  if (!isAllowed_(email)) return 'domain';
  if (ACCESS_MODE !== 'LIST') return 'ok';
  if (OWNER_EMAILS.map(e => e.toLowerCase()).indexOf(email) !== -1) return 'ok';
  return allowedEmails_().indexOf(email) !== -1 ? 'ok' : 'list';
}

/** Active emails from the AllowedUsers tab (cached briefly). */
function allowedEmails_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('acl_v1');
  if (hit) return JSON.parse(hit);
  let list = [];
  try {
    const sh = accessSheet_(false);
    if (sh && sh.getLastRow() > 1) {
      list = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
        .filter(r => r[0] && r[3] !== false && String(r[3]).toUpperCase() !== 'FALSE')
        .map(r => String(r[0]).trim().toLowerCase());
    }
  } catch (e) { console.error('allowedEmails_ failed: ' + e); }
  cache.put('acl_v1', JSON.stringify(list), ACCESS_CACHE_SECONDS);
  return list;
}

function accessSheet_(create) {
  const ss = ACCESS_SPREADSHEET_ID ? SpreadsheetApp.openById(ACCESS_SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ACCESS);
  if (!sh && create) {
    sh = ss.insertSheet(SHEET_ACCESS);
    sh.getRange(1, 1, 1, ACCESS_HEADERS.length).setValues([ACCESS_HEADERS])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#501e8c');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    [260, 200, 100, 70, 260].forEach((w, i) => sh.setColumnWidth(i + 1, w));
    sh.getRange(2, 4, 300, 1).insertCheckboxes();
    sh.getRange('A1').setNote('البريد الجامعي كاملًا — name@sr.edu.sa');
    sh.getRange('C1').setNote('admin / user (للتوثيق — يمكن استخدامه لاحقًا لصلاحيات أدق)');
    sh.getRange('D1').setNote('ألغِ العلامة لإيقاف الوصول دون حذف الصف');
  }
  return sh;
}

/** Run once from the editor: creates the AllowedUsers tab and adds the owner(s). */
function setupAccessList() {
  const sh = accessSheet_(true);
  const n = Math.max(sh.getLastRow() - 1, 0);            // includes empty rows that only hold checkboxes
  const data = n ? sh.getRange(2, 1, n, 5).getValues() : [];

  // Keep every existing entry (and its active state), compacted to the top — fixes rows that
  // earlier versions appended below the pre-made checkbox rows.
  const kept = data.filter(r => String(r[0]).trim())
    .map(r => [String(r[0]).trim(), r[1], r[2], r[3] === true || String(r[3]).toUpperCase() === 'TRUE', r[4]]);
  const have = kept.map(r => r[0].toLowerCase());

  const seed = OWNER_EMAILS.map(e => [e, 'Owner', 'admin', 'owner'])
    .concat(typeof DEFAULT_ALLOWED !== 'undefined' ? DEFAULT_ALLOWED : []);
  let added = 0;
  seed.forEach(r => {
    const e = String(r[0]).trim().toLowerCase();
    if (e && have.indexOf(e) === -1) {
      kept.push([e, r[1] || '', r[2] || 'user', true, r[3] || 'added by setupAccessList']);
      have.push(e); added++;
    }
  });

  if (n) sh.getRange(2, 1, n, 5).clearContent();
  const rows = Math.max(n, kept.length, 50);
  sh.getRange(2, 4, rows, 1).insertCheckboxes();          // checkboxes first (this sets them to unchecked)
  if (kept.length) sh.getRange(2, 1, kept.length, 5).setValues(kept);  // then the real values

  CacheService.getScriptCache().remove('acl_v1');
  console.log('AllowedUsers ready: ' + kept.length + ' entries (' + added + ' added).');
  try { SpreadsheetApp.getActive().toast('قائمة المصرّح لهم جاهزة: ' + kept.length + ' بريدًا (أُضيف ' + added + ').', SHEET_ACCESS, 8); } catch (e) {}
}

/* ---------------------------- Access log ---------------------------- */

/** Appends one row to AccessLog. Never blocks the page if logging fails. */
function logAccess_(email, result) {
  if (!LOG_ENABLED) return;
  try {
    if (LOG_DEDUP_MINUTES > 0 && result === 'granted') {
      const cache = CacheService.getScriptCache();
      const key = 'log_' + email;
      if (cache.get(key)) return;
      cache.put(key, '1', LOG_DEDUP_MINUTES * 60);
    }
    const now = new Date();
    const f = p => Utilities.formatDate(now, LOG_TIMEZONE, p);
    getLogSheet_().appendRow([now, f('yyyy-MM-dd'), f('HH:mm:ss'), DAYS_AR_[Number(f('u')) % 7],
      email, result === 'granted' ? 'دخول' : (result === 'not-listed' ? 'غير مدرج' : 'مرفوض'), APP_VERSION]);
  } catch (e) {
    console.error('logAccess_ failed: ' + e);
  }
}

function getLogSheet_() {
  const ss = LOG_SPREADSHEET_ID ? SpreadsheetApp.openById(LOG_SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet: bind the script to a Sheet or set LOG_SPREADSHEET_ID');
  let sh = ss.getSheetByName(SHEET_LOG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_LOG);
    sh.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground('#3a1464');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    [170, 100, 80, 80, 260, 80, 70].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  }
  return sh;
}

/** Menu: quick summary of the last 30 days. */
function showLogSummary() {
  const sh = getLogSheet_();
  const ui = SpreadsheetApp.getUi();
  const last = sh.getLastRow();
  if (last < 2) { ui.alert('سجل الدخول', 'لا توجد سجلات بعد.', ui.ButtonSet.OK); return; }
  const since = new Date(Date.now() - 30 * 864e5);
  const rows = sh.getRange(2, 1, last - 1, LOG_HEADERS.length).getValues()
    .filter(r => r[0] instanceof Date && r[0] >= since && r[5] === 'دخول');
  const users = {};
  rows.forEach(r => { users[r[4]] = (users[r[4]] || 0) + 1; });
  const top = Object.keys(users).sort((a, b) => users[b] - users[a]).slice(0, 10)
    .map((u, i) => (i + 1) + '. ' + u + ' — ' + users[u]).join('\n');
  ui.alert('سجل الدخول — آخر 30 يومًا — ' + APP_NAME,
    'عدد الزيارات: ' + rows.length + '\nعدد المستخدمين: ' + Object.keys(users).length + '\n\nالأكثر دخولًا:\n' + (top || '—'),
    ui.ButtonSet.OK);
}

/** Menu: delete entries older than LOG_RETENTION_DAYS. */
function purgeOldLogs() {
  const sh = getLogSheet_();
  const last = sh.getLastRow();
  let removed = 0;
  if (last > 1) {
    const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 864e5);
    const stamps = sh.getRange(2, 1, last - 1, 1).getValues();
    for (let i = stamps.length - 1; i >= 0; i--) {
      if (stamps[i][0] instanceof Date && stamps[i][0] < cutoff) { sh.deleteRow(i + 2); removed++; }
    }
  }
  SpreadsheetApp.getActive().toast('حُذف ' + removed + ' سجل أقدم من ' + LOG_RETENTION_DAYS + ' يومًا.', APP_NAME_EN, 6);
}

/** Sheet menu (bound scripts). Add platform items here. */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu(APP_NAME_EN)
      .addItem('تهيئة سجل الإجراءات (SOPs / Steps + التذكير الأسبوعي)', 'setup')
      .addSeparator()
      .addItem('تهيئة التوقيع الإلكتروني (Signers / SigningLog / Signed + المجلدات)', 'setupSignatures')
      .addSeparator()
      .addItem('إعداد قائمة المصرّح لهم (AllowedUsers)', 'setupAccessList')
      .addSeparator()
      .addItem('ملخص سجل الدخول (30 يومًا)', 'showLogSummary')
      .addItem('حذف سجلات الدخول القديمة', 'purgeOldLogs')
      .addSeparator()
      .addItem('عرض رابط المنصة', 'showWebAppUrl')
      .addToUi();
  } catch (e) { /* standalone script: no sheet UI */ }
}

function showWebAppUrl() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('رابط ' + APP_NAME, ScriptApp.getService().getUrl() || 'لم يُنشر بعد: Deploy ▸ New deployment ▸ Web app', ui.ButtonSet.OK);
}

/* ----------------------------- Helpers ------------------------------ */

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}
function safeJson_(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
