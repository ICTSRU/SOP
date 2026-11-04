/**
 * =====================================================================
 *  SRU SOP Register — SOP logic (SRU-FRM-SOP-01) · v3.3
 *  Runs inside the SRU Secure Access Kit (Code.gs = access + log).
 *  E-signatures live in Sign.gs (ported from the ICTD Policy Platform v3.3).
 *  Every function the page calls (api*) starts with requireSruUser_().
 *  Do NOT add doGet/doPost/onOpen here — they live in Code.gs.
 * =====================================================================
 */

const SOP_SHEET     = 'SOPs';
const STEP_SHEET    = 'Steps';
const VER_SHEET     = 'Versions';
const REMINDER_DAYS = 30;                    // review-date warning window (days)
const ADMIN_EMAIL   = 'm.elmahdy@sr.edu.sa'; // weekly digest recipient
const TZ            = 'Asia/Riyadh';
const CHUNK         = 45000;                 // Sheets cell limit is 50,000 characters
const JSON_COLS     = 8;                     // json + json_2 … json_8  (≈360k characters per SOP)

const SOP_HEADERS = [
  'sop_no','unit_code','title_ar','title_en','department','category','status','classification',
  'purpose','scope_in','scope_out','owner_role','owner_name','owner_email',
  'channels','channel_other','prerequisites','approvals',
  'steps_count','target_value','target_unit','priority','sla_start','escalations',
  'verification','closure_evidence','exceptions','references',
  'version','effective_date','review_cycle','review_date','prepared_by','reviewed_by','approved_by','approval_date',
  'revisions','created_at','updated_at','json','created_by','updated_by',
  // v2.5
  'rev','sign_status','json_2','json_3','json_4','json_5','json_6','json_7','json_8'
];
const STEP_HEADERS = ['sop_no','version','step_no','description','responsible_role','duration','output'];
const VER_HEADERS  = ['sop_no','version','title_ar','status','sign_status','saved_at','saved_by',
                      'json','json_2','json_3','json_4','json_5','json_6','json_7','json_8'];
const JSON_KEYS_   = ['json','json_2','json_3','json_4','json_5','json_6','json_7','json_8'];

/* ------------------- Page API (google.script.run) ------------------- */

/** v2.7: status board — every SOP in the register with approval, signing, final-copy and review status (one call). */
function apiBoard() {
  const email = requireSruUser_();
  return boardData_(email);
}
function boardData_(email) {
  const me = norm_(email);
  const sh = ensureSheets().getSheetByName(SOP_SHEET);
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const out = { ok: true, user: me, admin: isAdmin_(email), today: today, at: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), items: [] };
  if (!sh || sh.getLastRow() < 2) return out;
  const n = SOP_HEADERS.length, rows = sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues();
  const disp = sh.getRange(2, 1, sh.getLastRow() - 1, n).getDisplayValues();
  const H = function (k) { return SOP_HEADERS.indexOf(k); };
  const finals = {};
  (typeof signedRows_ === 'function' ? signedRows_() : []).forEach(function (r) { finals[norm_(r.code) + '|' + r.version] = r; });
  rows.forEach(function (v, i) {
    const no = String(disp[i][H('sop_no')] || '').trim();
    if (!no) return;
    let d = {};
    try { const s = JSON_KEYS_.map(function (k) { return String(v[H(k)] || ''); }).join(''); if (s) d = JSON.parse(s); } catch (e) { d = {}; }
    const pick = function (k) { return String(d[k] != null && d[k] !== '' ? d[k] : (disp[i][H(k)] || '')).trim(); };
    const ver = pick('version') || '1.0';
    const signers = signersOf_(d).filter(function (a) { return a && (String(a.name || '').trim() || String(a.email || '').trim() || a.sig); });
    const signed = signers.filter(function (a) { return a.sig; }).length;
    const f = finals[norm_(no) + '|' + ver];
    out.items.push({
      sop_no: no, title: pick('title_ar'), title_en: pick('title_en'), unit: pick('unit_code'), department: pick('department'),
      owner: pick('owner_name'), version: ver, status: pick('status') || 'مسودة', classification: pick('classification'),
      review_date: /^\d{4}-\d{2}-\d{2}$/.test(pick('review_date')) ? pick('review_date') : '',
      updated_at: String(disp[i][H('updated_at')] || ''),
      signed: signed, total: signers.length,
      waitingMe: signers.some(function (a) { return !a.sig && norm_(a.email) === me; }),
      waitingFor: signers.filter(function (a) { return !a.sig; }).map(function (a) { return a.name || a.email || a.role; }).slice(0, 6),
      final: f ? { at: f.finalizedAt, verifyId: f.verifyId || '' } : null
    });
  });
  return out;
}

function apiList() {
  requireSruUser_();
  return { ok: true, items: listSops() };
}

function apiGet(id) {
  requireSruUser_();
  return getSop(String(id || ''));
}

function apiSave(data) {
  const email = requireSruUser_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return saveSop(data || {}, email, {}); }
  finally { lock.releaseLock(); }
}

/* ------------------------------ Tabs -------------------------------- */

/** Creates SOPs/Steps/Versions if missing and widens the header row when new columns are added. */
function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Script is not bound to a Google Sheet (open it from the Sheet: Extensions → Apps Script)');
  if (!ss.getSheetByName(SOP_SHEET)) {
    const first = ss.getSheets()[0];
    const reserved = [SHEET_LOG, SHEET_ACCESS, STEP_SHEET, VER_SHEET];
    if (first.getLastRow() <= 1 && reserved.indexOf(first.getName()) === -1) first.setName(SOP_SHEET);
  }
  [[SOP_SHEET, SOP_HEADERS], [STEP_SHEET, STEP_HEADERS], [VER_SHEET, VER_HEADERS]].forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    const fresh = !sh;
    if (fresh) sh = ss.insertSheet(name);
    if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
    const cur = sh.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    if (fresh || cur.join('|') !== headers.join('|')) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold').setBackground('#501e8c').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.setRightToLeft(true);
    }
  });
  return ss;
}

/** Run once from the editor/menu: tabs + weekly review reminder (Sunday 07:00 Riyadh). */
function setup() {
  ensureSheets();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendReviewReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendReviewReminders').timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(7).inTimezone(TZ).create();
  try { SpreadsheetApp.getActive().toast('تم تجهيز أوراق SOPs و Steps و Versions وتفعيل التذكير الأسبوعي.', APP_NAME_EN, 6); } catch (e) {}
}

/* ------------------ Auto-numbering: {UNIT}-SOP-NNN ------------------ */

function unitCode(u) { return String(u || 'ICTD').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ICTD'; }
function fmtNo(code, n) { return code + '-SOP-' + String(n).padStart(3, '0'); }
/** Next free number for the unit. v2.5: never reuses a number already in the sheet, even if the counter was reset. */
function allocate(unit) {
  const code = unitCode(unit), props = PropertiesService.getScriptProperties();
  let n = Number(props.getProperty('SEQ_' + code) || 0);
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SOP_SHEET);
  const used = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues().forEach(function (r) { used[r[0]] = 1; });
  do { n++; } while (used[fmtNo(code, n)]);
  props.setProperty('SEQ_' + code, String(n));
  return fmtNo(code, n);
}

/* ------------------------- Signers (v2.5) --------------------------- */

/** Older records had prepared_by / reviewed_by / approved_by — turn them into the flexible signer list. */
function signersOf_(d) {
  if (Array.isArray(d.signers) && d.signers.length) return d.signers;
  const out = [];
  [['إعداد', d.prepared_by], ['مراجعة', d.reviewed_by], ['اعتماد', d.approved_by]].forEach(function (x) {
    if (String(x[1] || '').trim()) out.push({ role: x[0], name: String(x[1]), email: '' });
  });
  return out;
}
function signCount_(d) { return (d.signers || []).filter(function (a) { return a && a.sig; }).length; }
function allSigned_(d) { const a = d.signers || []; return a.length > 0 && a.every(function (x) { return x && x.sig; }); }
function signStatus_(d) { const a = d.signers || []; return a.length ? signCount_(d) + '/' + a.length : ''; }

/* ----------------------- JSON in several cells ---------------------- */

function chunks_(s) {
  const out = [];
  for (let i = 0; i < s.length; i += CHUNK) out.push(s.slice(i, i + CHUNK));
  if (out.length > JSON_COLS) throw new Error('الإجراء كبير جدًا للحفظ (تجاوز ' + (CHUNK * JSON_COLS) + ' حرفًا)');
  while (out.length < JSON_COLS) out.push('');
  return out;
}
function readJsonRow_(sh, row, headers) {
  const v = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  const s = JSON_KEYS_.map(function (k) { const i = headers.indexOf(k); return i > -1 ? String(v[i] || '') : ''; }).join('');
  return s ? JSON.parse(s) : null;
}

/* --------------------- Save (insert or update) ---------------------- */

/**
 * opts.sys = internal write from signing (may carry signatures, skips the lock).
 * An ordinary save never carries signatures, and a version that has signatures (or a final signed PDF) is read-only:
 * to change it, the editor creates a new version (+0.1) — the signed version stays in «Versions».
 */
function saveSop(d, email, opts) {
  opts = opts || {};
  if (!d.title_ar) throw new Error('عنوان الإجراء (عربي) مطلوب');
  const ss = ensureSheets();
  const sh = ss.getSheetByName(SOP_SHEET), st = ss.getSheetByName(STEP_SHEET);
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const rev = new Date().toISOString();
  d.version = String(d.version || '1.0').trim();
  d.signers = signersOf_(d).map(function (a) {
    const x = { role: String(a.role || '').slice(0, 120), name: String(a.name || '').slice(0, 160), email: String(a.email || '').trim().toLowerCase().slice(0, 160) };
    if (opts.sys && a.sig) x.sig = a.sig;
    return x;
  });
  delete d.prepared_by; delete d.reviewed_by; delete d.approved_by;

  let created = false;
  if (!d.sop_no) { d.sop_no = allocate(d.unit_code); created = true; }
  let r = findRow(sh, d.sop_no);

  if (!opts.sys && r) {
    const cur = readJsonRow_(sh, r, SOP_HEADERS);
    if (cur && String(cur.version) === d.version) {
      if (typeof isFinal_ === 'function' && isFinal_(d.sop_no, d.version))
        return { ok: false, locked: true, error: 'صدرت النسخة النهائية الموقّعة لهذا الإصدار — أنشئ إصدارًا جديدًا (+0.1) للتعديل' };
      if (signCount_(cur))
        return { ok: false, locked: true, error: 'هذا الإصدار يحتوي على توقيعات ومقفل للتعديل — أنشئ إصدارًا جديدًا (+0.1) أو يزيل الموقّعون توقيعاتهم' };
    }
  }
  delete d.sig_mode;
  delete d.sig_display;      // v3.0: the display mode is platform-wide (admin), never stored per SOP
  const prev = k => r ? sh.getRange(r, SOP_HEADERS.indexOf(k) + 1).getDisplayValue() : '';
  const names = d.signers.map(function (a) { return a.name; }).filter(String);

  const flat = k => (d[k] || []).map(x => Object.keys(x).filter(f => f !== 'sig').map(f => x[f]).join(' | ')).join('\n');
  const parts = chunks_(JSON.stringify(d));
  const row = SOP_HEADERS.map(h => {
    switch (h) {
      case 'channels':    return (d.channels || []).join('، ');
      case 'approvals':
      case 'escalations':
      case 'revisions':   return flat(h);
      case 'steps_count': return String((d.steps || []).length);
      case 'prepared_by': return names[0] || '';
      case 'reviewed_by': return names.slice(1, -1).join('، ');
      case 'approved_by': return names.length > 1 ? names[names.length - 1] : '';
      case 'created_at':  return prev('created_at') || now;
      case 'updated_at':  return now;
      case 'created_by':  return prev('created_by') || email;
      case 'updated_by':  return email;
      case 'rev':         return rev;
      case 'sign_status': return signStatus_(d);
      default: {
        const j = JSON_KEYS_.indexOf(h);
        if (j > -1) return parts[j];
        return d[h] == null ? '' : String(d[h]);
      }
    }
  });

  if (!r) { r = Math.max(sh.getLastRow(), 1) + 1; created = true; }
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);  // keep dates/versions as text

  // Versions: one row per (SOP, version) — the signed text of every version stays available for verification
  const vs = ss.getSheetByName(VER_SHEET);
  const vrow = findVerRow_(vs, d.sop_no, d.version) || Math.max(vs.getLastRow(), 1) + 1;
  vs.getRange(vrow, 1, 1, VER_HEADERS.length).setNumberFormat('@')
    .setValues([[d.sop_no, d.version, d.title_ar || '', d.status || '', signStatus_(d), now, email].concat(parts)]);

  // Steps tab: replace this SOP's rows
  const vals = st.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) if (String(vals[i][0]) === d.sop_no) st.deleteRow(i + 1);
  const steps = (d.steps || []).map((s, i) =>
    [d.sop_no, d.version || '', String(i + 1), s.desc || '', s.role || '', s.duration || '', s.output || '']);
  if (steps.length) st.getRange(st.getLastRow() + 1, 1, steps.length, STEP_HEADERS.length)
    .setNumberFormat('@').setValues(steps);

  return { ok: true, sop_no: d.sop_no, created: created, by: email, at: now, rev: rev };
}

function findRow(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === String(id)) return i + 2;
  return 0;
}
function findVerRow_(sh, id, ver) {
  if (sh.getLastRow() < 2) return 0;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues();
  for (let i = 0; i < v.length; i++) if (v[i][0] === String(id) && v[i][1] === String(ver)) return i + 2;
  return 0;
}

/* ------------------------------ Read -------------------------------- */

function listSops() {
  const sh = ensureSheets().getSheetByName(SOP_SHEET);
  if (sh.getLastRow() < 2) return [];
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, SOP_HEADERS.length).getDisplayValues();
  const ix = k => SOP_HEADERS.indexOf(k);
  return v.filter(r => r[0]).map(r => ({
    sop_no: r[ix('sop_no')], title_ar: r[ix('title_ar')], title_en: r[ix('title_en')],
    version: r[ix('version')], status: r[ix('status')], review_date: r[ix('review_date')],
    owner_email: r[ix('owner_email')], updated_at: r[ix('updated_at')], updated_by: r[ix('updated_by')],
    sign_status: r[ix('sign_status')]
  })).reverse();
}

/** Live record (+ signature pictures from the private vault, + final-PDF info). */
function getSop(id) {
  const sh = ensureSheets().getSheetByName(SOP_SHEET);
  const r = findRow(sh, id);
  if (!r) return { ok: false, error: 'الإجراء غير موجود: ' + id };
  const d = readJsonRow_(sh, r, SOP_HEADERS);
  d.signers = signersOf_(d);
  const rev = sh.getRange(r, SOP_HEADERS.indexOf('rev') + 1).getDisplayValue();
  if (typeof project_ === 'function') project_(d);
  const final = typeof finalInfo_ === 'function' ? finalInfo_(d.sop_no, d.version) : null;
  return { ok: true, data: d, rev: rev, final: final };
}

/** Text of one stored version (used by verification). */
function getVersion_(id, ver) {
  const vs = ensureSheets().getSheetByName(VER_SHEET);
  const r = findVerRow_(vs, id, ver);
  return r ? readJsonRow_(vs, r, VER_HEADERS) : null;
}

/* -------------- Automation: review-date reminders (weekly) ---------- */

function sendReviewReminders() {
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const limit = Utilities.formatDate(new Date(Date.now() + REMINDER_DAYS * 864e5), TZ, 'yyyy-MM-dd');
  const due = listSops().filter(s => s.status !== 'ملغى' && s.review_date && s.review_date <= limit);
  if (!due.length) return;

  due.forEach(s => {
    if (!s.owner_email) return;
    const overdue = s.review_date < today;
    MailApp.sendEmail({
      to: s.owner_email,
      subject: (overdue ? '[متأخر] ' : '') + 'مراجعة إجراء تشغيلي: ' + s.sop_no + ' — ' + s.title_ar,
      htmlBody: '<div dir="rtl" style="font-family:Tahoma">' +
        '<p>يحين موعد مراجعة الإجراء التالي:</p><ul>' +
        '<li><b>' + s.sop_no + '</b> — ' + s.title_ar + '</li>' +
        '<li>الإصدار الحالي: ' + s.version + '</li>' +
        '<li>تاريخ المراجعة: ' + s.review_date + (overdue ? ' (متأخر)' : '') + '</li></ul>' +
        '<p>يرجى مراجعة الإجراء وإصدار نسخة محدّثة أو تأكيد استمراره دون تعديل.</p></div>'
    });
  });

  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject: 'ملخص مراجعات الإجراءات التشغيلية (' + due.length + ')',
    htmlBody: '<div dir="rtl" style="font-family:Tahoma"><table border="1" cellpadding="4" style="border-collapse:collapse">' +
      '<tr style="background:#501e8c;color:#fff"><th>الرقم</th><th>العنوان</th><th>الإصدار</th><th>المالك</th><th>تاريخ المراجعة</th></tr>' +
      due.map(s => '<tr><td>' + s.sop_no + '</td><td>' + s.title_ar + '</td><td>' + s.version + '</td><td>' + s.owner_email +
        '</td><td' + (s.review_date < today ? ' style="color:#b3261e;font-weight:bold"' : '') + '>' + s.review_date + '</td></tr>').join('') +
      '</table></div>'
  });
}
