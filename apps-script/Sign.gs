/**
 * =====================================================================
 *  SRU SOP Register — E-signatures · v3.1
 *  Ported from the ICTD Policy Platform v3.3 (same mechanism), with its OWN register:
 *  sheets Signers / SigningLog / Signed in this SOP spreadsheet, its own Drive folders
 *  and its own secret pepper. Nothing is shared with the policy or MoU platforms.
 *
 *  Encryption and decryption happen ONLY in the browser (Web Crypto, AES-256-GCM, PBKDF2 key
 *  from the PIN). This script never receives a PIN or a clear stored signature; it verifies
 *  SHA-256(PIN-derived tag + pepper) and locks a signature after SIG_MAX_FAILS wrong PINs.
 *  A signer row stores only a signature record: who, which signature, when, and the SHA-256
 *  of the SOP content that was signed. The picture printed in the box sits in a private vault.
 *
 *  Signature display (v2.6, chosen by admins, as in the policy platform):
 *    'stamp' → text only (the e-signature stamp: name, title, time, content hash) — no picture
 *    'image' → the signer's signature picture is printed in the box
 *    'blur'  → a blurred copy on screen; the clear picture is released only to render the final signed PDF
 *  v3.0: ONE platform-wide mode (script property SIG_DISPLAY_DEFAULT), set by admins only, applied to every SOP and every user.
 *
 *  Page entry point: apiSign(req) — every call starts with requireSruUser_().
 * =====================================================================
 */

const SIG_MAX_FAILS   = 5;      // wrong PINs before a temporary lock
const SIG_LOCK_MIN    = 15;
const MAX_PDF_B64     = 24000000;
const SH_SIGNERS      = 'Signers';
const SIGNERS_HEADERS = ['id','name','position','org','fileId','encSalt','encIv','iter','authSalt','authHash','fails','lockUntil','status','createdBy','createdAt','updatedAt','ownerEmail'];
const SH_SIGNLOG      = 'SigningLog';
const SH_SIGNED       = 'Signed';
const SIGNLOG_HEADERS = ['timestamp','date','time','email','action','code','version','row','role','signerId','signerName','docHash','result'];
const SIGNED_HEADERS  = ['code','version','title','docHash','pdfId','pdfHash','finalizedAt','finalizedBy','sentTo','verifyId'];
const SIG_FOLDER_NAME   = 'ICTD-SOP-Signatures-Encrypted';
const FINAL_FOLDER_NAME = 'ICTD-SOP-Signed-PDFs';
const IMG_FOLDER_NAME   = 'ICTD-SOP-Signature-Images';

/* ------------------------------ entry ------------------------------ */

function apiSign(req) {
  const email = requireSruUser_();      // every call, not just page load
  req = req || {};
  try {
    switch (req.action) {
      case 'sigs': {
        const admin = isAdmin_(email);
        return { ok: true, items: mySigs_(email), admin: admin, ready: true, all: admin ? allSigs_() : [], displayDefault: displayDefault_() };
      }
      case 'sigAdd':     return sigAdd_(email, req);
      case 'sigUnlock':  return sigUnlock_(email, req);
      case 'sigPin':     return sigPin_(email, req);
      case 'sigDelete':  return sigDelete_(email, req);
      case 'sign':       return signRow_(email, req);
      case 'unsign':     return unsignRow_(email, req);
      case 'sigShow':    return sigShow_(email, req);
      case 'setDisplay':        return setDisplay_(email, req);
      case 'setDefaultDisplay': return setDefaultDisplay_(email, req);
      case 'finalImages':       return finalImages_(email, req);
      case 'vtoken':     return vtoken_(email, req);
      case 'finalize':   return finalize_(email, req);
      case 'finalPdf':   return finalPdf_(email, req);
      case 'verify':     return verifyById_(email, req.id);
      case 'verifyHash': return verifyByHash_(email, req.hash);
      default:           return { ok: false, error: 'unknown action' };
    }
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}
/** The verification page (Verify.html) calls this name. */
function sopApi(req) { return apiSign(req); }

/** Optional: run once from the editor or the sheet menu (everything is also created on first use). */
function setupSignatures() {
  ensureSignSheets_(); sigFolder_(); finalFolder_(); imgFolder_(); pepper_();
  const n = sigRows_().filter(function (r) { return r.status === 'active'; }).length;
  const msg = ['✔ Signers · SigningLog · Signed sheets', '✔ private Drive folders (encrypted signatures · signature images · signed PDFs)', '✔ secret pepper', '✔ ' + n + ' active signatures'].join('\n');
  console.log(msg);
  try { SpreadsheetApp.getUi().alert('التوقيع الإلكتروني — v' + APP_VERSION, msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return msg;
}

/* ------------------------------ helpers ----------------------------- */

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function norm_(s) { return String(s || '').trim().toLowerCase(); }
function clean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }
function isB64_(s, max) { return typeof s === 'string' && s.length > 0 && s.length <= max && /^[A-Za-z0-9+/=]+$/.test(s); }
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ((b + 256) % 256).toString(16); }).map(function (h) { return h.length < 2 ? '0' + h : h; }).join('');
}
function pepper_() {
  let p = prop_('SIG_PEPPER');
  if (!p) { p = Utilities.getUuid() + Utilities.getUuid(); PropertiesService.getScriptProperties().setProperty('SIG_PEPPER', p); }
  return p;
}
function hashTag_(tag) { return sha_(tag + '|' + pepper_()); }
function folderProp_(key, name) {
  let id = prop_(key);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder(name);
  PropertiesService.getScriptProperties().setProperty(key, f.getId());
  return f;
}
function sigFolder_()   { return folderProp_('SIG_FOLDER_ID', SIG_FOLDER_NAME).getId(); }
function finalFolder_() { return folderProp_('SOP_FINAL_FOLDER_ID', FINAL_FOLDER_NAME).getId(); }
function imgFolder_()   { return folderProp_('SIG_IMG_FOLDER_ID', IMG_FOLDER_NAME); }

/** admin = owner, or role «admin» in AllowedUsers. */
function isAdmin_(email) {
  email = norm_(email);
  if (OWNER_EMAILS.map(norm_).indexOf(email) > -1) return true;
  try {
    const sh = accessSheet_(false);
    if (!sh || sh.getLastRow() < 2) return false;
    return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().some(function (r) {
      return norm_(r[0]) === email && norm_(r[2]) === 'admin' && r[3] !== false && String(r[3]).toUpperCase() !== 'FALSE';
    });
  } catch (e) { return false; }
}

/* ------------------ this platform's signature register ------------------ */

function ensureSignSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [[SH_SIGNERS, SIGNERS_HEADERS], [SH_SIGNLOG, SIGNLOG_HEADERS], [SH_SIGNED, SIGNED_HEADERS]].forEach(function (x) {
    let sh = ss.getSheetByName(x[0]);
    if (!sh) {
      sh = ss.insertSheet(x[0]);
      sh.getRange(1, 1, 1, x[1].length).setValues([x[1]]).setFontWeight('bold').setBackground('#501e8c').setFontColor('#ffffff');
      sh.setFrozenRows(1); sh.setRightToLeft(true);
      sh.getRange(1, x[0] === SH_SIGNLOG ? 2 : 1, sh.getMaxRows(), x[1].length).setNumberFormat('@');   // keep "2.0" and hashes as text
      if (x[0] === SH_SIGNERS) sh.hideColumns(5, 6);   // fileId … authHash: technical columns
    } else if (sh.getLastColumn() < x[1].length) {
      sh.getRange(1, 1, 1, x[1].length).setValues([x[1]]).setFontWeight('bold').setBackground('#501e8c').setFontColor('#ffffff');
    }
  });
}
function sigSheet_() { ensureSignSheets_(); return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SIGNERS); }
function sigRows_() {
  const sh = sigSheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, SIGNERS_HEADERS.length).getValues().map(function (r, i) {
    const o = { _row: i + 2 }; SIGNERS_HEADERS.forEach(function (k, j) { o[k] = r[j]; }); return o;
  });
}
function sigAppend_(o) {
  const sh = sigSheet_();
  sh.getRange(Math.max(sh.getLastRow(), 1) + 1, 1, 1, SIGNERS_HEADERS.length).setNumberFormat('@')
    .setValues([SIGNERS_HEADERS.map(function (k) { return o[k] === undefined ? '' : String(o[k]); })]);
}
function sigUpdate_(row, o) {
  const rg = sigSheet_().getRange(row, 1, 1, SIGNERS_HEADERS.length), cur = rg.getValues()[0];
  SIGNERS_HEADERS.forEach(function (k, j) { if (k in o) cur[j] = String(o[k]); });
  rg.setValues([cur]);
}
function sigRow_(id) {
  const r = sigRows_().filter(function (x) { return x.id === id && x.status === 'active'; })[0];
  if (!r) throw new Error('التوقيع غير موجود');
  return r;
}
function mySigRow_(email, id) {
  const r = sigRow_(id);
  if (norm_(r.ownerEmail) !== norm_(email)) throw new Error('هذا التوقيع ليس مسجّلًا باسم حسابك');
  return r;
}
function mySigs_(email) {
  const now = Date.now();
  let rows = [];
  try { rows = sigRows_(); } catch (e) { return []; }
  return rows.filter(function (r) { return r.status === 'active' && norm_(r.ownerEmail) === norm_(email); })
    .map(function (r) {
      return { id: r.id, name: r.name, position: r.position, org: r.org, authSalt: r.authSalt, iter: Number(r.iter),
               createdAt: String(r.createdAt), locked: Number(r.lockUntil) > now };
    });
}
/** Lock after SIG_MAX_FAILS wrong PINs for SIG_LOCK_MIN minutes. */
function verifySig_(r, tag) {
  const now = Date.now(), until = Number(r.lockUntil) || 0;
  if (until > now) return { ok: false, locked: true, msg: 'التوقيع مقفل مؤقتًا — حاول بعد ' + Math.ceil((until - now) / 60000) + ' دقيقة' };
  if (!isB64_(tag, 100)) return { ok: false, msg: 'بيانات تحقق غير صالحة' };
  if (hashTag_(tag) === r.authHash) {
    if (Number(r.fails)) sigUpdate_(r._row, { fails: '0', lockUntil: '0' });
    return { ok: true };
  }
  const fails = (Number(r.fails) || 0) + 1;
  if (fails >= SIG_MAX_FAILS) {
    sigUpdate_(r._row, { fails: '0', lockUntil: String(now + SIG_LOCK_MIN * 60000) });
    return { ok: false, locked: true, msg: 'تجاوزت عدد المحاولات — تم قفل التوقيع ' + SIG_LOCK_MIN + ' دقيقة' };
  }
  sigUpdate_(r._row, { fails: String(fails) });
  return { ok: false, msg: 'رقم سري غير صحيح — المحاولات المتبقية: ' + (SIG_MAX_FAILS - fails) };
}
function validEnvelope_(enc, auth) {
  if (!enc || !auth) throw new Error('بيانات التشفير ناقصة');
  if (!isB64_(enc.salt, 64) || !isB64_(enc.iv, 64) || !isB64_(enc.ct, 1500000) || !isB64_(auth.salt, 64) || !isB64_(auth.tag, 100))
    throw new Error('بيانات التشفير غير صالحة');
  const it = Number(enc.iter);
  if (!(it >= 100000 && it <= 2000000)) throw new Error('إعدادات التشفير غير صالحة');
}

function sigAdd_(email, p) {
  const folder = sigFolder_();
  const name = clean_(p.name, 120);
  if (!name) throw new Error('الاسم مطلوب');
  const owner = isAdmin_(email) && p.ownerEmail ? norm_(p.ownerEmail) : norm_(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner)) throw new Error('بريد صاحب التوقيع غير صالح');
  validEnvelope_(p.enc, p.auth);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const id = Utilities.getUuid();
    const file = DriveApp.getFolderById(folder).createFile(id + '.enc', p.enc.ct, MimeType.PLAIN_TEXT);
    const now = new Date().toISOString();
    sigAppend_({
      id: id, name: name, position: clean_(p.position, 120), org: clean_(p.org, 160), fileId: file.getId(),
      encSalt: p.enc.salt, encIv: p.enc.iv, iter: String(p.enc.iter), authSalt: p.auth.salt, authHash: hashTag_(p.auth.tag),
      fails: '0', lockUntil: '0', status: 'active', createdBy: email, createdAt: now, updatedAt: now, ownerEmail: owner
    });
    logSigning_(email, { action: 'add-signature', signerId: id, signerName: name, result: 'success' });
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}
/** Admin view of the whole register (no images, no hashes). */
function allSigs_() {
  const now = Date.now();
  return sigRows_().filter(function (r) { return r.status === 'active'; }).map(function (r) {
    return { id: r.id, name: r.name, position: r.position, ownerEmail: String(r.ownerEmail || ''), createdAt: String(r.createdAt),
             createdBy: String(r.createdBy || ''), locked: Number(r.lockUntil) > now };
  });
}
function sigUnlock_(email, p) {
  const r = mySigRow_(email, p.id);
  const v = verifySig_(r, p.tag);
  logSigning_(email, { action: p.purpose === 'pin-change' ? 'pin-change' : (p.purpose === 'sign' ? 'unlock-for-sign' : 'preview'), signerId: r.id, signerName: r.name, result: v.ok ? 'success' : (v.locked ? 'locked' : 'failed') });
  if (!v.ok) return v;
  return { ok: true, enc: { salt: r.encSalt, iv: r.encIv, ct: DriveApp.getFileById(r.fileId).getBlob().getDataAsString(), iter: Number(r.iter) } };
}
function sigPin_(email, p) {
  const r = mySigRow_(email, p.id);
  const v = verifySig_(r, p.tag);
  if (!v.ok) return v;
  validEnvelope_(p.enc, p.auth);
  DriveApp.getFileById(r.fileId).setContent(p.enc.ct);
  sigUpdate_(r._row, { encSalt: p.enc.salt, encIv: p.enc.iv, iter: String(p.enc.iter), authSalt: p.auth.salt,
                       authHash: hashTag_(p.auth.tag), updatedAt: new Date().toISOString() });
  logSigning_(email, { action: 'pin-changed', signerId: r.id, signerName: r.name, result: 'success' });
  return { ok: true };
}
function sigDelete_(email, p) {
  const r = isAdmin_(email) ? sigRow_(p.id) : mySigRow_(email, p.id);
  try { DriveApp.getFileById(r.fileId).setTrashed(true); } catch (e) {}
  sigUpdate_(r._row, { status: 'deleted', updatedAt: new Date().toISOString() });
  logSigning_(email, { action: 'delete-signature', signerId: r.id, signerName: r.name, result: 'success' });
  return { ok: true };
}

/* --------------------------- audit log --------------------------- */

function logSigning_(email, o) {
  try {
    ensureSignSheets_();
    const d = new Date(), f = function (p) { return Utilities.formatDate(d, LOG_TIMEZONE, p); };
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SIGNLOG).appendRow(SIGNLOG_HEADERS.map(function (k) {
      if (k === 'timestamp') return d;
      if (k === 'date') return f('yyyy-MM-dd');
      if (k === 'time') return f('HH:mm:ss');
      if (k === 'email') return email;
      const v = o[k] == null ? '' : String(o[k]);
      return /^[=+\-@]/.test(v) ? "'" + v : v;
    }));
  } catch (e) { console.error('logSigning_ failed: ' + e); }
}

/* ------------------------- final copies ------------------------- */

function signedRows_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SIGNED);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, SIGNED_HEADERS.length).getDisplayValues().map(function (r, i) {
    const o = { _row: i + 2 }; SIGNED_HEADERS.forEach(function (k, j) { o[k] = r[j]; }); return o;
  });
}
function finalInfo_(code, version) {
  const r = signedRows_().filter(function (x) { return norm_(x.code) === norm_(code) && x.version === String(version); }).pop();
  return r ? { at: r.finalizedAt, by: r.finalizedBy, pdfHash: r.pdfHash, docHash: r.docHash, verifyId: r.verifyId || '' } : null;
}
function isFinal_(code, version) { return !!finalInfo_(code, version); }

/** SHA-256 of the SOP content (keys sorted). Signatures and fields that change as a result of signing are excluded,
 *  so a later signature keeps earlier ones valid. */
function sopHash_(d) {
  const c = JSON.parse(JSON.stringify(d));
  ['status', 'approval_date', 'review_date', 'template_version', 'sop_no_hint', 'sig_display'].forEach(function (k) { delete c[k]; });
  (c.signers || []).forEach(function (a) { if (a) delete a.sig; });
  const canon = function (v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  };
  return sha_(canon(c));
}

/* ------------------- signature pictures (private vault) ------------------- */

function vaultName_(code, ver, idx) { return String(code).toUpperCase() + '_v' + ver + '_r' + (Number(idx) + 1) + '.json'; }
function vaultPut_(code, ver, idx, signerId, img, blur) {
  const folder = imgFolder_(), name = vaultName_(code, ver, idx);
  const it = folder.getFilesByName(name); while (it.hasNext()) it.next().setTrashed(true);
  folder.createFile(name, JSON.stringify({ signerId: signerId, img: img, blur: blur || '', at: new Date().toISOString() }), MimeType.PLAIN_TEXT);
}
function vaultGet_(code, ver, idx) {
  const it = imgFolder_().getFilesByName(vaultName_(code, ver, idx));
  if (!it.hasNext()) return null;
  try { return JSON.parse(it.next().getBlob().getDataAsString()); } catch (e) { return null; }
}
function vaultDel_(code, ver, idx) { const it = imgFolder_().getFilesByName(vaultName_(code, ver, idx)); while (it.hasNext()) it.next().setTrashed(true); }
/* ------------------- signature display (v2.6) ------------------- */
const MODES_ = ['stamp', 'image', 'blur'];
const MODE_TXT_ = { stamp: 'نص التوقيع فقط', image: 'صورة التوقيع', blur: 'صورة مموّهة (واضحة في النسخة النهائية)' };
function displayDefault_() {
  const m = PropertiesService.getScriptProperties().getProperty('SIG_DISPLAY_DEFAULT');
  return MODES_.indexOf(m) > -1 ? m : 'image';
}
function modeOf_(d) { return displayDefault_(); }      // v3.0: platform-wide — per-SOP values are ignored

/** Fills each signed box's picture fields from the private vault according to the SOP's display mode:
 *  image → clear picture · blur → blurred copy only · stamp → no picture. */
function project_(d) {
  const mode = modeOf_(d);
  (d.signers || []).forEach(function (a, i) {
    if (!a || !a.sig) return;
    delete a.sig.img; delete a.sig.imgBlur;
    let v = null; try { v = vaultGet_(d.sop_no, String(d.version), i); } catch (e) {}
    a.sig.hasImg = !!(v && v.img);
    if (!v) return;
    if (mode === 'image' && v.img) a.sig.img = v.img;
    else if (mode === 'blur' && v.blur) a.sig.imgBlur = v.blur;
  });
  d.sig_mode = mode;     // effective mode, for the page (not stored)
}

/** Admin: platform default for SOPs that have no own setting. */
function setDefaultDisplay_(email, p) {
  if (!isAdmin_(email)) return { ok: false, error: 'هذا الإعداد لمسؤول المنصة فقط' };
  const m = String(p.mode || '');
  if (MODES_.indexOf(m) === -1) throw new Error('طريقة عرض غير معروفة');
  PropertiesService.getScriptProperties().setProperty('SIG_DISPLAY_DEFAULT', m);
  logSigning_(email, { action: 'display-default', result: m });
  return { ok: true, mode: m };
}

/** Admin (v3.0): sets the platform-wide display mode — applies to every SOP and every user at once.
 *  Optional p.code + p.blurs = { row: blurredDataUrl }: blurred copies made in the admin's browser for pictures of that
 *  SOP that have none yet (signatures from v2.5). The mode never changes the signed content (excluded from sopHash_). */
function setDisplay_(email, p) {
  if (!isAdmin_(email)) return { ok: false, error: 'هذا الإعداد لمسؤول المنصة فقط' };
  const m = String(p.mode || '');
  if (MODES_.indexOf(m) === -1) throw new Error('طريقة عرض غير معروفة');
  const code = String(p.code || '').trim();
  if (code && p.blurs && Object.keys(p.blurs).length) {
    const sh = ensureSheets().getSheetByName(SOP_SHEET), row = findRow(sh, code);
    if (row) {
      const d = readJsonRow_(sh, row, SOP_HEADERS), ver = String(d.version);
      d.signers = signersOf_(d);
      Object.keys(p.blurs).forEach(function (k) {
        const b = sigImg_(p.blurs[k]), i = Number(k), a = (d.signers || [])[i];
        if (!b || !a || !a.sig) return;
        const v = vaultGet_(code, ver, i);
        if (v && v.img && !v.blur) vaultPut_(code, ver, i, v.signerId || a.sig.signerId, v.img, b);
      });
    }
  }
  PropertiesService.getScriptProperties().setProperty('SIG_DISPLAY_DEFAULT', m);
  logSigning_(email, { action: 'display-mode', code: code, result: 'platform:' + m });
  const out = { ok: true, mode: m };
  if (code) { const g = getSop(code); if (g.ok) { out.data = g.data; out.rev = g.rev; out.final = g.final; } }
  return out;
}

/** Clear pictures for rendering the final PDF in 'blur' mode — only when every box is signed,
 *  only to its signers or admins, never stored in the record. */
function finalImages_(email, p) {
  const code = String(p.code || '').trim();
  const sh = ensureSheets().getSheetByName(SOP_SHEET);
  const row = findRow(sh, code);
  if (!row) throw new Error('الإجراء غير موجود في السجل');
  const d = readJsonRow_(sh, row, SOP_HEADERS), ver = String(d.version);
  d.signers = signersOf_(d);
  if (!allSigned_(d)) throw new Error('لم تكتمل التوقيعات بعد');
  const signers = (d.signers || []).map(function (a) { return norm_(a.sig.by); });
  if (signers.indexOf(norm_(email)) === -1 && !isAdmin_(email)) return { ok: false, error: 'متاح للموقّعين ومسؤولي المنصة فقط' };
  const out = {};
  (d.signers || []).forEach(function (a, i) { const v = vaultGet_(code, ver, i); if (v && v.img) out[i] = v.img; });
  logSigning_(email, { action: 'final-images', code: code, version: ver, result: Object.keys(out).length + ' images' });
  return { ok: true, images: out };
}
function stripImgs_(d) { (d.signers || []).forEach(function (a) { if (a && a.sig) { delete a.sig.img; delete a.sig.imgBlur; delete a.sig.hasImg; } }); delete d.sig_mode; return d; }

/** v2.6 (policy): validates a signature image sent by its owner (PNG/JPEG/WebP data URL, size-capped). */
function sigImg_(v) {
  if (!v) return '';
  v = String(v);
  if (v.length > 120000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(v)) throw new Error('صورة التوقيع غير صالحة أو كبيرة جدًا');
  return v;
}

/* ------------------------------ signing ------------------------------ */

/** Loads the live record under the script lock; checks it is the copy the signer was looking at. */
function liveForSign_(code, baseRev) {
  const sh = ensureSheets().getSheetByName(SOP_SHEET);
  const row = findRow(sh, code);
  if (!row) throw new Error('احفظ الإجراء في السجل قبل التوقيع');
  const rev = String(sh.getRange(row, SOP_HEADERS.indexOf('rev') + 1).getDisplayValue() || '');
  if (baseRev !== undefined && baseRev !== null && baseRev !== rev)
    return { conflict: true, error: 'عُدّل الإجراء بعد أن فتحته — أعد فتحه من السجل ثم وقّع' };
  const d = readJsonRow_(sh, row, SOP_HEADERS);
  d.signers = signersOf_(d);
  if (isFinal_(code, d.version)) throw new Error('صدرت النسخة النهائية لهذا الإصدار — لا يمكن تعديل توقيعاته');
  return { d: d };
}
function persist_(d, email, note) {
  const res = saveSop(stripImgs_(d), email, { sys: true, note: note });
  project_(d);
  return res;
}

function signRow_(email, p) {
  const code = String(p.code || '').trim(), idx = Number(p.row);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const live = liveForSign_(code, p.baseRev);
    if (live.conflict) return { ok: false, conflict: true, error: live.error };
    const d = live.d, a = (d.signers || [])[idx];
    if (!a) throw new Error('خانة الاعتماد غير موجودة');
    if (norm_(a.email) !== norm_(email)) throw new Error('هذه الخانة مخصّصة لتوقيع ' + (a.email || 'موقّع لم يُحدَّد بعد'));
    if (a.sig) throw new Error('هذه الخانة موقّعة مسبقًا');
    const s = mySigRow_(email, p.signerId);
    const img = sigImg_(p.img), blur = sigImg_(p.blur);      // blurred copy made in the signer's browser
    const v = verifySig_(s, p.tag);
    const docHash = sopHash_(d);
    logSigning_(email, { action: 'sign', code: code, version: d.version, row: idx + 1, role: a.role, signerId: s.id, signerName: s.name,
                         docHash: docHash, result: v.ok ? 'success' : (v.locked ? 'locked' : 'failed') });
    if (!v.ok) return v;
    a.sig = { signerId: s.id, signerName: String(s.name || ''), position: String(s.position || ''), by: norm_(email),
              at: new Date().toISOString(), docHash: docHash };
    if (img) vaultPut_(code, d.version, idx, s.id, img, blur);
    const all = allSigned_(d);
    if (all) {
      d.status = 'معتمد';
      if (!d.approval_date) d.approval_date = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    } else if (d.status === 'مسودة') d.status = 'قيد المراجعة';
    const res = persist_(d, email, 'sign');
    return { ok: true, data: d, rev: res.rev, allSigned: all, docHash: docHash };
  } finally { lock.releaseLock(); }
}

/** The signer adds the picture of an existing signature (PIN-verified) so the SOP prints with it. */
function sigShow_(email, p) {
  const code = String(p.code || '').trim(), idx = Number(p.row);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const live = liveForSign_(code, p.baseRev);
    if (live.conflict) return { ok: false, conflict: true, error: live.error };
    const d = live.d, a = (d.signers || [])[idx];
    if (!a || !a.sig) throw new Error('هذه الخانة غير موقّعة');
    if (norm_(a.sig.by) !== norm_(email)) throw new Error('يمكن إظهار صورة التوقيع بواسطة صاحبه فقط');
    const s = mySigRow_(email, a.sig.signerId);
    const img = sigImg_(p.img), blur = sigImg_(p.blur);
    if (!img) throw new Error('صورة التوقيع مفقودة');
    const v = verifySig_(s, p.tag);
    logSigning_(email, { action: 'show-image', code: code, version: d.version, row: idx + 1, role: a.role, signerId: s.id, signerName: s.name,
                         docHash: a.sig.docHash, result: v.ok ? 'success' : (v.locked ? 'locked' : 'failed') });
    if (!v.ok) return v;
    vaultPut_(code, d.version, idx, s.id, img, blur);
    const res = persist_(d, email, 'sign-image');
    return { ok: true, data: d, rev: res.rev };
  } finally { lock.releaseLock(); }
}

function unsignRow_(email, p) {
  const code = String(p.code || '').trim(), idx = Number(p.row);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const live = liveForSign_(code, p.baseRev);
    if (live.conflict) return { ok: false, conflict: true, error: live.error };
    const d = live.d, a = (d.signers || [])[idx];
    if (!a || !a.sig) throw new Error('هذه الخانة غير موقّعة');
    if (norm_(a.sig.by) !== norm_(email)) throw new Error('يمكن إزالة التوقيع بواسطة صاحبه فقط');
    const s = mySigRow_(email, a.sig.signerId);
    const v = verifySig_(s, p.tag);
    logSigning_(email, { action: 'unsign', code: code, version: d.version, row: idx + 1, role: a.role, signerId: s.id, signerName: s.name,
                         docHash: a.sig.docHash, result: v.ok ? 'success' : (v.locked ? 'locked' : 'failed') });
    if (!v.ok) return v;
    delete a.sig;
    try { vaultDel_(code, d.version, idx); } catch (e) {}
    if (d.status === 'معتمد') d.status = 'قيد المراجعة';
    const res = persist_(d, email, 'unsign');
    return { ok: true, data: d, rev: res.rev };
  } finally { lock.releaseLock(); }
}

/* ------------------------ final signed PDF ------------------------ */

/** The browser of the last signer renders the A4 PDF; the server archives it, hashes it and e-mails it. */
function finalize_(email, p) {
  const code = String(p.code || '').trim();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = ensureSheets().getSheetByName(SOP_SHEET);
    const row = findRow(sh, code);
    if (!row) throw new Error('الإجراء غير موجود في السجل');
    const d = readJsonRow_(sh, row, SOP_HEADERS), ver = String(d.version);
    d.signers = signersOf_(d);
    const prev = finalInfo_(code, ver);
    if (prev) return { ok: true, already: true, at: prev.at, verifyId: prev.verifyId };
    if (!allSigned_(d)) throw new Error('لا يمكن إصدار النسخة النهائية قبل اكتمال جميع التوقيعات');
    const signers = (d.signers || []).map(function (a) { return norm_(a.sig.by); });
    if (signers.indexOf(norm_(email)) === -1 && !isAdmin_(email)) throw new Error('الإصدار متاح للموقّعين ومسؤولي المنصة فقط');
    if (!isB64_(p.pdf, MAX_PDF_B64)) throw new Error('ملف PDF غير صالح أو كبير جدًا');
    const bytes = Utilities.base64Decode(p.pdf);
    if (String.fromCharCode.apply(null, bytes.slice(0, 5).map(function (b) { return (b + 256) % 256; })) !== '%PDF-') throw new Error('الملف ليس PDF');

    const name = code + '_v' + ver + '_signed.pdf';
    const pdfHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
      .map(function (b) { const h = ((b + 256) % 256).toString(16); return h.length < 2 ? '0' + h : h; }).join('');
    const blob = Utilities.newBlob(bytes, 'application/pdf', name);
    const file = DriveApp.getFolderById(finalFolder_()).createFile(blob);
    const docHash = sopHash_(d), now = new Date().toISOString();
    const vid = verifyId_(code, ver, docHash), vurl = verifyUrl_(vid);

    const to = signers.concat(OWNER_EMAILS.map(norm_)).filter(function (e, i, a) { return e && a.indexOf(e) === i; });
    const esc = function (s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    const rows = (d.signers || []).map(function (a) {
      return '<tr><td style="padding:6px;border:1px solid #ddd">' + esc(a.role) + '<br><small>' + esc(a.name) + '</small></td>' +
        '<td style="padding:6px;border:1px solid #ddd"><b>' + esc(a.sig.signerName) + '</b><br><small dir="ltr">' + esc(a.sig.by) + '</small></td>' +
        '<td style="padding:6px;border:1px solid #ddd">' + esc(Utilities.formatDate(new Date(a.sig.at), LOG_TIMEZONE, 'yyyy-MM-dd HH:mm')) + '</td></tr>';
    }).join('');
    const html = '<div dir="rtl" style="font-family:Tahoma,Arial;color:#241436;max-width:640px">' +
      '<h3 style="color:#3a1464;margin-bottom:4px">اعتماد إجراء تشغيلي قياسي — اكتملت التوقيعات</h3>' +
      '<p style="margin-top:0;color:#6b5a80">' + esc(d.title_ar) + ' — <b dir="ltr">' + esc(code) + '</b> · الإصدار ' + esc(ver) + '</p>' +
      '<table style="border-collapse:collapse;font-size:13px;width:100%"><tr style="background:#501e8c;color:#fff">' +
      '<th style="padding:6px">المرحلة</th><th style="padding:6px">الموقّع</th><th style="padding:6px">التاريخ (توقيت الرياض)</th></tr>' + rows + '</table>' +
      '<p style="font-size:12px;color:#6b5a80">بصمة محتوى الإجراء (SHA-256): <span dir="ltr" style="font-family:monospace">' + docHash + '</span><br>' +
      'بصمة الملف المرفق (SHA-256): <span dir="ltr" style="font-family:monospace">' + pdfHash + '</span></p>' +
      '<p>مرفق النسخة النهائية الموقّعة بصيغة PDF، وتُحفظ نسخة أرشيفية في منصة الإجراءات التشغيلية.</p>' +
      '<p>رمز التحقق: <b dir="ltr" style="font-family:monospace">' + vid + '</b> — <a href="' + vurl + '">صفحة التحقق</a> (أو امسح رمز QR في صفحة الشهادة).</p><hr>' +
      '<p style="font-size:12px;color:#6b5a80" dir="ltr">SOP <b>' + esc(code) + ' v' + esc(ver) + '</b> is fully signed. The final signed PDF is attached.</p>' +
      '<p style="font-size:12px;color:#6b5a80">الإدارة التنفيذية للاتصالات وتقنية المعلومات — جامعة سليمان الراجحي</p></div>';
    let sent = 0;
    try {
      if (to.length) { MailApp.sendEmail({ to: to.join(','), subject: 'اعتماد ' + code + ' v' + ver + ' — النسخة النهائية الموقّعة | SOP signed', htmlBody: html, attachments: [blob], name: APP_NAME + ' — ICTD' }); sent = to.length; }
    } catch (e) { console.error('finalize mail failed: ' + e); }

    ensureSignSheets_();
    const ss = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH_SIGNED);
    ss.getRange(Math.max(ss.getLastRow(), 1) + 1, 1, 1, SIGNED_HEADERS.length).setNumberFormat('@')
      .setValues([[code, ver, d.title_ar || '', docHash, file.getId(), pdfHash, now, email, to.join(','), vid]]);
    logSigning_(email, { action: 'finalized', code: code, version: ver, docHash: docHash, result: 'pdf ' + pdfHash.slice(0, 16) + ' · sent:' + sent });
    return { ok: true, at: now, pdfHash: pdfHash, docHash: docHash, verifyId: vid, sentTo: sent ? to : [] };
  } finally { lock.releaseLock(); }
}
function finalPdf_(email, p) {
  const code = String(p.code || '').trim(), ver = String(p.version || '');
  const r = signedRows_().filter(function (x) { return norm_(x.code) === norm_(code) && x.version === ver; }).pop();
  if (!r) throw new Error('لا توجد نسخة نهائية لهذا الإصدار');
  const f = DriveApp.getFileById(r.pdfId);
  logSigning_(email, { action: 'final-downloaded', code: code, version: ver, result: 'success' });
  return { ok: true, name: f.getName(), b64: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/* --------------------------- verification --------------------------- */

function verifyId_(code, ver, docHash) {
  const h = sha_('verify|' + String(code).toUpperCase() + '|' + ver + '|' + docHash + '|' + pepper_()).slice(0, 12).toUpperCase();
  return h.slice(0, 4) + '-' + h.slice(4, 8) + '-' + h.slice(8, 12);
}
function verifyUrl_(vid) { return ScriptApp.getService().getUrl() + '?verify=' + encodeURIComponent(vid); }

/** Before rendering the final PDF, the browser asks for the code to print on the certificate page. */
function vtoken_(email, p) {
  const code = String(p.code || '').trim();
  const sh = ensureSheets().getSheetByName(SOP_SHEET);
  const row = findRow(sh, code);
  if (!row) throw new Error('الإجراء غير موجود في السجل');
  const d = readJsonRow_(sh, row, SOP_HEADERS);
  d.signers = signersOf_(d);
  if (!allSigned_(d)) throw new Error('لم تكتمل التوقيعات بعد');
  const vid = verifyId_(code, String(d.version), sopHash_(d));
  return { ok: true, id: vid, url: verifyUrl_(vid) };
}

/** Verification report for one Signed row (no signature images). */
function verifyReport_(r, how) {
  let d = null;
  try { d = getVersion_(r.code, r.version); if (d) d.signers = signersOf_(d); } catch (e) {}
  const contentOk = !!d && sopHash_(d) === r.docHash;
  const signers = d ? (d.signers || []).map(function (a) {
    const s = a.sig || {};
    return { role: a.role || '', name: a.name || '', signer: s.signerName || '', position: s.position || '', by: s.by || '', at: s.at || '',
             docHash: s.docHash || '', match: !!s.docHash && s.docHash === r.docHash };
  }) : [];
  const ps = ensureSheets().getSheetByName(SOP_SHEET), pr = findRow(ps, r.code);
  const liveVer = pr ? String(ps.getRange(pr, SOP_HEADERS.indexOf('version') + 1).getDisplayValue()) : '';
  const liveStatus = pr ? String(ps.getRange(pr, SOP_HEADERS.indexOf('status') + 1).getDisplayValue()) : '';
  const allOk = contentOk && signers.length > 0 && signers.every(function (x) { return x.match; });
  return {
    ok: true, found: true, how: how, valid: allOk,
    code: r.code, version: r.version, title: r.title, status: d ? (d.status || '') : '',
    classification: d ? (d.classification || '') : '', issueDate: d ? (d.effective_date || '') : '',
    finalizedAt: r.finalizedAt, finalizedBy: r.finalizedBy, docHash: r.docHash, pdfHash: r.pdfHash,
    verifyId: r.verifyId || verifyId_(r.code, r.version, r.docHash), contentOk: contentOk, signers: signers,
    liveVersion: liveVer, liveStatus: liveStatus, superseded: !!liveVer && liveVer !== r.version, removed: !pr
  };
}
function verifyById_(email, id) {
  id = String(id || '').trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  if (id.length !== 12) return { ok: true, found: false, error: 'رمز التحقق غير صالح — 12 خانة بالشكل XXXX-XXXX-XXXX' };
  const fmt = id.slice(0, 4) + '-' + id.slice(4, 8) + '-' + id.slice(8, 12);
  const r = signedRows_().filter(function (x) { return (x.verifyId || verifyId_(x.code, x.version, x.docHash)) === fmt; }).pop();
  logSigning_(email, { action: 'verify-code', code: r ? r.code : '', version: r ? r.version : '', result: r ? 'found ' + fmt : 'not found ' + fmt });
  return r ? verifyReport_(r, 'code') : { ok: true, found: false, error: 'لا يوجد إجراء موقّع بهذا الرمز' };
}
function verifyByHash_(email, hash) {
  hash = String(hash || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: true, found: false, error: 'بصمة الملف غير صالحة' };
  const r = signedRows_().filter(function (x) { return String(x.pdfHash).toLowerCase() === hash; }).pop();
  logSigning_(email, { action: 'verify-pdf', code: r ? r.code : '', version: r ? r.version : '', result: r ? 'match ' + hash.slice(0, 16) : 'no match ' + hash.slice(0, 16) });
  return r ? verifyReport_(r, 'pdf') : { ok: true, found: false, error: 'الملف لا يطابق أي نسخة نهائية موقّعة في المنصة' };
}
