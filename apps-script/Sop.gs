/**
 * =====================================================================
 *  SRU SOP Register — SOP logic (SRU-FRM-SOP-01) · v2.0
 *  Runs inside the SRU Secure Access Kit (Code.gs = access + log).
 *  Every function the page calls (api*) starts with requireSruUser_().
 *  Do NOT add doGet/doPost/onOpen here — they live in Code.gs.
 * =====================================================================
 */

const SOP_SHEET     = 'SOPs';
const STEP_SHEET    = 'Steps';
const REMINDER_DAYS = 30;                    // review-date warning window (days)
const ADMIN_EMAIL   = 'm.elmahdy@sr.edu.sa'; // weekly digest recipient
const TZ            = 'Asia/Riyadh';

const SOP_HEADERS = [
  'sop_no','unit_code','title_ar','title_en','department','category','status','classification',
  'purpose','scope_in','scope_out','owner_role','owner_name','owner_email',
  'channels','channel_other','prerequisites','approvals',
  'steps_count','target_value','target_unit','priority','sla_start','escalations',
  'verification','closure_evidence','exceptions','references',
  'version','effective_date','review_cycle','review_date','prepared_by','reviewed_by','approved_by','approval_date',
  'revisions','created_at','updated_at','json','created_by','updated_by'
];
const STEP_HEADERS = ['sop_no','version','step_no','description','responsible_role','duration','output'];

/* ------------------- Page API (google.script.run) ------------------- */

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
  try { return saveSop(data || {}, email); }
  finally { lock.releaseLock(); }
}

/* ------------------------------ Tabs -------------------------------- */

/** Creates SOPs/Steps if missing and widens the header row when new columns are added. */
function ensureSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Script is not bound to a Google Sheet (open it from the Sheet: Extensions → Apps Script)');
  if (!ss.getSheetByName(SOP_SHEET)) {
    const first = ss.getSheets()[0];
    const reserved = [SHEET_LOG, SHEET_ACCESS, STEP_SHEET];
    if (first.getLastRow() <= 1 && reserved.indexOf(first.getName()) === -1) first.setName(SOP_SHEET);
  }
  [[SOP_SHEET, SOP_HEADERS], [STEP_SHEET, STEP_HEADERS]].forEach(([name, headers]) => {
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
  try { SpreadsheetApp.getActive().toast('تم تجهيز أوراق SOPs و Steps وتفعيل التذكير الأسبوعي.', APP_NAME_EN, 6); } catch (e) {}
}

/* ------------------ Auto-numbering: {UNIT}-SOP-NNN ------------------ */

function unitCode(u) { return String(u || 'ICTD').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ICTD'; }
function fmtNo(code, n) { return code + '-SOP-' + String(n).padStart(3, '0'); }
function allocate(unit) {
  const code = unitCode(unit), props = PropertiesService.getScriptProperties();
  const n = Number(props.getProperty('SEQ_' + code) || 0) + 1;
  props.setProperty('SEQ_' + code, String(n));
  return fmtNo(code, n);
}

/* --------------------- Save (insert or update) ---------------------- */

function saveSop(d, email) {
  if (!d.title_ar) throw new Error('عنوان الإجراء (عربي) مطلوب');
  const ss = ensureSheets();
  const sh = ss.getSheetByName(SOP_SHEET), st = ss.getSheetByName(STEP_SHEET);
  const now = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');

  let created = false;
  if (!d.sop_no) { d.sop_no = allocate(d.unit_code); created = true; }
  let r = findRow(sh, d.sop_no);
  const prev = k => r ? sh.getRange(r, SOP_HEADERS.indexOf(k) + 1).getDisplayValue() : '';

  const flat = k => (d[k] || []).map(x => Object.values(x).join(' | ')).join('\n');
  const row = SOP_HEADERS.map(h => {
    switch (h) {
      case 'channels':    return (d.channels || []).join('، ');
      case 'approvals':
      case 'escalations':
      case 'revisions':   return flat(h);
      case 'steps_count': return String((d.steps || []).length);
      case 'created_at':  return prev('created_at') || now;
      case 'updated_at':  return now;
      case 'created_by':  return prev('created_by') || email;
      case 'updated_by':  return email;
      case 'json':        return JSON.stringify(d);
      default:            return d[h] == null ? '' : String(d[h]);
    }
  });

  if (!r) { r = Math.max(sh.getLastRow(), 1) + 1; created = true; }
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);  // keep dates/versions as text

  // Steps tab: replace this SOP's rows
  const vals = st.getDataRange().getValues();
  for (let i = vals.length - 1; i >= 1; i--) if (String(vals[i][0]) === d.sop_no) st.deleteRow(i + 1);
  const steps = (d.steps || []).map((s, i) =>
    [d.sop_no, d.version || '', String(i + 1), s.desc || '', s.role || '', s.duration || '', s.output || '']);
  if (steps.length) st.getRange(st.getLastRow() + 1, 1, steps.length, STEP_HEADERS.length)
    .setNumberFormat('@').setValues(steps);

  return { ok: true, sop_no: d.sop_no, created: created, by: email, at: now };
}

function findRow(sh, id) {
  if (sh.getLastRow() < 2) return 0;
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === String(id)) return i + 2;
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
    owner_email: r[ix('owner_email')], updated_at: r[ix('updated_at')], updated_by: r[ix('updated_by')]
  })).reverse();
}

function getSop(id) {
  const sh = ensureSheets().getSheetByName(SOP_SHEET);
  const r = findRow(sh, id);
  if (!r) return { ok: false, error: 'الإجراء غير موجود: ' + id };
  return { ok: true, data: JSON.parse(sh.getRange(r, SOP_HEADERS.indexOf('json') + 1).getValue()) };
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
