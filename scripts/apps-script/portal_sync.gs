/**
 * Quellflow – Google Form → Internship Portal sync (add-on for create_internship_form.gs)
 * ------------------------------------------------------------------------------
 * SETUP (once the portal is deployed):
 *  1. Apps Script editor → + (Add file) → Script → name it "portal_sync" → paste this file.
 *  2. Project Settings (gear) → Script properties → add:
 *       PORTAL_IMPORT_URL     = https://<portal-domain>/api/leads/import
 *       (the old /api/applicants/import URL still works and does the same thing)
 *       PORTAL_IMPORT_SECRET  = <same value as IMPORT_SECRET in the portal env, 32+ chars>
 *  3. In create_internship_form.gs → processResponse_(), right after
 *       `if (sendMail) sh.getRange(rowNum, COL.ack).setValue(sendAck_(rec));`
 *     add one line:
 *       pushToPortal_(rec);
 *  4. Run `testPortalConnection` once (Execution log should say "OK – portal reachable"; 401 = wrong secret).
 *  5. Run `backfillPortal` once to send all existing rows.
 * The sync never blocks the form flow: failures are logged, not thrown.
 * The portal answers { ok: true, codes: [{ form_response_id, code }] }: the portal lead code
 * (QF-<AY>-<SEQ4>) is written to the Execution log. Re-sending a response updates the same lead.
 */

const PORTAL_BATCH_SIZE = 100;

function portalConfig_() {
  const p = PropertiesService.getScriptProperties();
  return { url: p.getProperty('PORTAL_IMPORT_URL'), secret: p.getProperty('PORTAL_IMPORT_SECRET') };
}

/** Same scheme as the portal: hex(HMAC-SHA256(secret, `${ts}.${body}`)) */
function signPortal_(secret, ts, body) {
  const bytes = Utilities.computeHmacSha256Signature(ts + '.' + body, secret, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function recToPayload_(rec) {
  const ts = rec.ts instanceof Date ? rec.ts : new Date(rec.ts);
  return {
    candidate_code: String(rec.id),
    form_response_id: String(rec.responseId),
    submitted_at: isNaN(ts.getTime()) ? null : ts.toISOString(),
    email: String(rec.email || ''),
    full_name: String(rec.name || ''),
    phone: String(rec.phone || '').replace(/^'/, ''),
    city: String(rec.city || ''),
    college: String(rec.college || ''),
    degree: String(rec.degree || ''),
    year_of_study: String(rec.year || ''),
    role_label: String(rec.role || ''),
    skills: String(rec.skills || ''),
    portfolio_url: String(rec.portfolio || ''),
    prev_internship: String(rec.prevIntern || ''),
    cv_url: /^https:\/\//.test(String(rec.cv || '')) ? String(rec.cv).split('\n')[0] : '',
    can_start: String(rec.start || ''),
    hours_per_week: String(rec.hours || ''),
    work_mode: String(rec.mode || ''),
    extra: String(rec.extra || ''),
  };
}

function postPortal_(bodyObj) {
  const cfg = portalConfig_();
  if (!cfg.url || !cfg.secret) return { code: 0, text: 'PORTAL_IMPORT_URL / PORTAL_IMPORT_SECRET not set' };
  const body = JSON.stringify(bodyObj);
  const ts = String(Math.floor(Date.now() / 1000));
  const res = UrlFetchApp.fetch(cfg.url, {
    method: 'post',
    contentType: 'application/json',
    payload: body,
    headers: { 'x-qf-timestamp': ts, 'x-qf-signature': 'sha256=' + signPortal_(cfg.secret, ts, body) },
    muteHttpExceptions: true,
  });
  const text = res.getContentText();
  // Successful replies carry the codes (up to 100 per batch), so keep them whole; trim error text for the log.
  return { code: res.getResponseCode(), text: res.getResponseCode() === 200 ? text : text.slice(0, 300) };
}

/** Portal codes from a 200 response body ([] when the body is not the expected JSON). */
function portalCodes_(text) {
  try {
    const body = JSON.parse(text);
    return body && body.codes ? body.codes : [];
  } catch (err) {
    return [];
  }
}

/** Called from processResponse_ for every new application. Never throws. Returns the portal code or ''. */
function pushToPortal_(rec) {
  try {
    const r = postPortal_(recToPayload_(rec));
    if (r.code !== 200) {
      Logger.log('Portal sync failed for ' + rec.id + ': ' + r.code + ' ' + r.text);
      return '';
    }
    const codes = portalCodes_(r.text);
    const code = codes.length ? String(codes[0].code) : '';
    Logger.log('Portal sync OK for ' + rec.id + ': portal code ' + (code || '(not returned)'));
    return code;
  } catch (err) {
    Logger.log('Portal sync error for ' + rec.id + ': ' + err.message);
    return '';
  }
}

/** Sends every row of "All Applications" (idempotent – safe to run again). */
function backfillPortal() {
  const sh = getSS_().getSheetByName(SHEET.master);
  const last = sh.getLastRow();
  if (last < 2) { Logger.log('No rows'); return; }
  const values = sh.getRange(2, 1, last - 1, COLUMNS.length).getDisplayValues();
  const recs = values.map(function (row) {
    const rec = {};
    COLUMNS.forEach(function (c, j) { rec[c[0]] = row[j]; });
    return rec;
  });
  // Real Date objects for timestamps (display values are locale-formatted text)
  const tsValues = sh.getRange(2, COL.ts, last - 1, 1).getValues();
  recs.forEach(function (r, i) { r.ts = tsValues[i][0]; });

  let sent = 0;
  for (let i = 0; i < recs.length; i += PORTAL_BATCH_SIZE) {
    const chunk = recs.slice(i, i + PORTAL_BATCH_SIZE).map(recToPayload_);
    const r = postPortal_({ applicants: chunk });
    if (r.code === 200) {
      sent += chunk.length;
      const codes = portalCodes_(r.text);
      Logger.log('Batch ' + (i / PORTAL_BATCH_SIZE + 1) + ': 200, ' + codes.length + ' leads saved');
      codes.forEach(function (c) { Logger.log('  ' + c.form_response_id + ' -> ' + c.code); });
    } else {
      Logger.log('Batch ' + (i / PORTAL_BATCH_SIZE + 1) + ': ' + r.code + ' ' + r.text);
    }
  }
  Logger.log('Backfill done: ' + sent + ' / ' + recs.length + ' rows sent.');
}

/** Sends nothing harmful: an invalid payload expecting 422 proves URL + secret work (401 = wrong secret). */
function testPortalConnection() {
  const r = postPortal_({ applicants: [] });
  Logger.log(r.code === 422 ? 'OK – portal reachable and secret accepted (' + r.code + ')' : 'Check config: ' + r.code + ' ' + r.text);
}
