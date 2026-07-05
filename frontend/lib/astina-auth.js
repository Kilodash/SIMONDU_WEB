// ASTINA auth (pure HTTP, no browser required)
// Flow discovered from HAR files:
//   1) GET  /api/auth/login_web             -> { data: { key, link_captcha (base64 PNG) } }
//   2) POST /api/auth/login_web             body: { email, password, key, captcha }
//        -> { data: { access_token } }
//   3) POST /api/v1/validasi_otp            body: { otp: <int> }  (Bearer token)
//        -> { status: true }
//   4) subsequent calls -> Authorization: Bearer <access_token>
//
// Captcha is solved with Gemini 2.5 Flash via the Emergent LLM proxy.
// OTP is fetched from Zimbra by IMAP.

const Imap = require('imap')
const { simpleParser } = require('mailparser')

// Some polri.go.id endpoints serve certificates that Node's default CA store
// won't trust (broken chain / self-signed). Disable TLS verification for
// outbound fetches from this module. Scope is limited: this runs server-side
// only, inside a controlled ASTINA client module.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const ASTINA_BASE = process.env.ASTINA_BASE_URL || 'https://api-gw.polri.go.id/api-eoffice'
const LLM_BASE = process.env.EMERGENT_LLM_BASE_URL || 'https://integrations.emergentagent.com/llm'
const LLM_KEY = process.env.EMERGENT_LLM_KEY || ''
const LLM_MODEL = process.env.CAPTCHA_MODEL || 'gemini/gemini-2.5-flash'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

const commonHeaders = (extra = {}) => ({
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Origin': 'https://astina.polri.go.id',
  'Referer': 'https://astina.polri.go.id/',
  'User-Agent': UA,
  ...extra,
})

async function getCaptcha() {
  const r = await fetch(`${ASTINA_BASE}/api/auth/login_web`, {
    method: 'GET',
    headers: commonHeaders(),
  })
  const j = await r.json()
  if (!j?.status || !j?.data?.link_captcha || !j?.data?.key) {
    throw new Error('Gagal ambil captcha ASTINA: ' + JSON.stringify(j).slice(0, 200))
  }
  return { key: j.data.key, image_base64: j.data.link_captcha }
}

async function solveCaptcha(base64Png) {
  if (!LLM_KEY) throw new Error('EMERGENT_LLM_KEY not set')
  const body = {
    model: LLM_MODEL,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Baca teks captcha di gambar. Jawab HANYA karakter captcha (6 huruf kecil + angka), tanpa spasi/penjelasan.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Png}` } },
      ],
    }],
    max_tokens: 300,
    reasoning_effort: 'low',
  }
  const r = await fetch(`${LLM_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LLM_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  const text = (j?.choices?.[0]?.message?.content || '').trim().replace(/\s+/g, '').toLowerCase()
  if (!text) throw new Error('Vision AI tidak mengembalikan teks captcha')
  // Keep only alphanumeric
  return text.replace(/[^a-z0-9]/gi, '').slice(0, 8)
}

async function loginWithCaptcha({ email, password, maxAttempts = 4 }) {
  let lastErr = null
  for (let i = 1; i <= maxAttempts; i++) {
    const { key, image_base64 } = await getCaptcha()
    let captcha
    try { captcha = await solveCaptcha(image_base64) } catch (e) { lastErr = e; continue }
    if (!captcha) { lastErr = new Error('Captcha kosong'); continue }
    const r = await fetch(`${ASTINA_BASE}/api/auth/login_web`, {
      method: 'POST',
      headers: commonHeaders(),
      body: JSON.stringify({ email, password, key, captcha }),
    })
    const j = await r.json().catch(() => null)
    if (j?.status && j?.data?.access_token) {
      return { access_token: j.data.access_token, user: j.data.user || null, captcha_used: captcha }
    }
    lastErr = new Error(`Attempt ${i}: ${j?.message || 'login gagal'} (captcha=${captcha})`)
    // If it says captcha wrong keep looping; otherwise fail fast on credential error
    if (/password|email|akun|user/i.test(j?.message || '') && !/captcha/i.test(j?.message || '')) break
  }
  throw lastErr || new Error('Login ASTINA gagal setelah percobaan')
}

// -------------------- ZIMBRA IMAP OTP --------------------
function fetchOtpFromZimbra({ waitMs = 60_000, since = Date.now() - 5 * 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    let done = false
    const finish = (err, otp) => {
      if (done) return
      done = true
      try { imap.end() } catch (_) {}
      err ? reject(err) : resolve(otp)
    }
    const imap = new Imap({
      user: process.env.ZIMBRA_EMAIL,
      password: process.env.ZIMBRA_PASSWORD,
      host: process.env.ZIMBRA_IMAP_HOST || 'mail.polri.go.id',
      port: parseInt(process.env.ZIMBRA_IMAP_PORT || '993', 10),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30_000,
      authTimeout: 20_000,
    })

    const OTP_RE = /\b(\d{4,6})\b/

    function tryOnce() {
      imap.openBox('INBOX', false, (err) => {
        if (err) return finish(new Error('IMAP openBox: ' + err.message))
        const criteria = [['SINCE', new Date(since).toUTCString()]]
        imap.search(criteria, (err, results) => {
          if (err) return finish(new Error('IMAP search: ' + err.message))
          if (!results || !results.length) {
            if (Date.now() - started >= waitMs) return finish(new Error('OTP email belum ditemukan (timeout)'))
            return setTimeout(tryOnce, 5000)
          }
          // Fetch newest 10 messages
          const latest = results.slice(-10)
          const fetch = imap.fetch(latest, { bodies: '', struct: true })
          const candidates = []
          fetch.on('message', (msg, seqno) => {
            let attrs = null
            msg.once('attributes', (a) => { attrs = a })
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (err) return
                const msgDate = parsed.date ? parsed.date.getTime() : (attrs?.date ? new Date(attrs.date).getTime() : 0)
                if (msgDate <= since) return
                const subject = (parsed.subject || '').toLowerCase()
                const text = (parsed.text || '') + '\n' + ((parsed.html || '').replace(/<[^>]+>/g, ' '))
                const full = (subject + ' ' + text).toLowerCase()
                if (!/otp|verifikasi|kode|token|verification|pin|astina/i.test(full)) return
                const otp = extractOtp(text) || extractOtp(parsed.subject || '')
                if (otp) candidates.push({ date: msgDate, otp })
              })
            })
          })
          fetch.once('error', (e) => finish(new Error('IMAP fetch: ' + e.message)))
          fetch.once('end', () => {
            setTimeout(() => {
              if (candidates.length > 0) {
                candidates.sort((a, b) => b.date - a.date)
                return finish(null, candidates[0].otp)
              }
              if (Date.now() - started >= waitMs) return finish(new Error('OTP tidak ditemukan (email harus baru, setelah ' + new Date(since).toISOString() + ')'))
              setTimeout(tryOnce, 5000)
            }, 500)
          })
        })
      })
    }
    imap.once('ready', tryOnce)
    imap.once('error', (err) => finish(new Error('IMAP error: ' + err.message)))
    imap.connect()
  })
}

// -------------------- ZIMBRA SOAP OTP (works without IMAP enabled) --------------------
// Zimbra webmail uses SOAP. We POST /service/soap/AuthRequest with the same
// credentials the user types into the webmail login page, keep the session
// cookie, then POST /service/soap/SearchRequest to grep the inbox for the
// most recent OTP-looking message. This is the fallback when Zimbra IMAP
// access is disabled at the account level (common default).

const ZIMBRA_BASE = process.env.ZIMBRA_BASE_URL || 'https://mail.polri.go.id'

async function zimbraAuth() {
  const email = process.env.ZIMBRA_EMAIL
  const pass = process.env.ZIMBRA_PASSWORD
  if (!email || !pass) throw new Error('ZIMBRA_EMAIL / ZIMBRA_PASSWORD belum di-set')
  const soap = {
    Header: { context: { _jsns: 'urn:zimbra', userAgent: { name: 'zclient', version: 'simondu-1' } } },
    Body: { AuthRequest: {
      _jsns: 'urn:zimbraAccount',
      account: { by: 'name', _content: email },
      password: { _content: pass },
    } },
  }
  const r = await fetch(`${ZIMBRA_BASE}/service/soap/AuthRequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/soap+xml', 'Accept': 'application/json, text/javascript' },
    body: JSON.stringify(soap),
  })
  const j = await r.json().catch(() => null)
  const token = j?.Body?.AuthResponse?.authToken?.[0]?._content
  if (!token) throw new Error('Zimbra auth gagal: ' + JSON.stringify(j?.Body?.Fault || j).slice(0, 300))
  return token
}

// Extract an OTP code from message text. ASTINA sends 6-digit OTPs, but the
// mail body also contains dates like "2026" and times "17:27" which would
// match a naive \d{4,6} regex. So we prefer 6-digit codes and, within a
// tier, pick the LAST match (OTPs are typically shown near the bottom).
function extractOtp(text) {
  if (!text) return null
  // Strip 4-digit years / clock times so they don't shadow the real OTP.
  const cleaned = text
    .replace(/\b(19|20)\d{2}\b/g, ' ')       // years 1900-2099
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ') // HH:MM(:SS)
  for (const width of [6, 5, 4]) {
    const re = new RegExp(`(?<!\\d)(\\d{${width}})(?!\\d)`, 'g')
    const matches = [...cleaned.matchAll(re)].map((m) => m[1])
    if (matches.length) return matches[matches.length - 1]
  }
  return null
}

function decodeHtml(s) {
  if (!s) return ''
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ').trim()
}

async function zimbraSearchOtp({ authToken, waitMs = 60_000, sinceMs = Date.now() - 5 * 60_000 }) {
  const started = Date.now()
  const OTP_RE = /\b(\d{4,6})\b/
  // Small initial delay so the OTP email has time to arrive.
  await new Promise((r) => setTimeout(r, 3_000))
  while (Date.now() - started < waitMs) {
    const soap = {
      Header: {
        context: {
          _jsns: 'urn:zimbra',
          authToken: { _content: authToken },
        },
      },
      Body: {
        SearchRequest: {
          _jsns: 'urn:zimbraMail',
          types: 'message',
          sortBy: 'dateDesc',
          limit: 10,
          fetch: 'all',
          html: 1,
          query: 'in:inbox after:-30minute',
        },
      },
    }
    const r = await fetch(`${ZIMBRA_BASE}/service/soap/SearchRequest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml', 'Accept': 'application/json' },
      body: JSON.stringify(soap),
    })
    const j = await r.json().catch(() => null)
    const fault = j?.Body?.Fault
    if (fault) throw new Error('Zimbra search fault: ' + JSON.stringify(fault).slice(0, 300))
    const msgs = j?.Body?.SearchResponse?.m || []
    // Only accept messages with date strictly newer than sinceMs; iterate newest-first.
    for (const m of msgs) {
      const msgDate = Number(m.d || 0)
      if (msgDate <= sinceMs) continue
      const subject = m.su || ''
      const parts = []
      const collect = (p) => {
        if (!p) return
        if (Array.isArray(p)) return p.forEach(collect)
        if (p.content) parts.push(p.content)
        if (p.mp) collect(p.mp)
      }
      collect(m.mp)
      const bodyText = decodeHtml(parts.join('\n'))
      const full = (subject + ' ' + bodyText).toLowerCase()
      // Must be an OTP-ish email (avoids picking up random 6-digit numbers)
      if (!/otp|verifikasi|kode|token|verification|pin|astina/i.test(full)) continue
      const otp = extractOtp(bodyText) || extractOtp(subject)
      if (otp) return otp
    }
    await new Promise((r) => setTimeout(r, 4_000))
  }
  throw new Error('OTP tidak ditemukan (email harus baru, diterima setelah ' + new Date(sinceMs).toISOString() + ')')
}

async function fetchOtpFromZimbraSoap({ waitMs = 90_000, sinceMs = Date.now() - 5 * 60_000 } = {}) {
  const token = await zimbraAuth()
  return zimbraSearchOtp({ authToken: token, waitMs, sinceMs })
}

async function validateOtp(accessToken, otp) {
  const r = await fetch(`${ASTINA_BASE}/api/v1/validasi_otp`, {
    method: 'POST',
    headers: commonHeaders({ 'Authorization': `Bearer ${accessToken}` }),
    body: JSON.stringify({ otp: parseInt(otp, 10) }),
  })
  const j = await r.json().catch(() => null)
  if (!j?.status) throw new Error('Validasi OTP gagal: ' + (j?.message || `HTTP ${r.status}`))
  return true
}

// -------------------- FULL AUTO-LOGIN --------------------
// In-memory session cache (per Node process). Backed by MongoDB
// (collection `astina_sessions`) so restarts don't force a fresh
// captcha + OTP round-trip when a valid token already exists.
let _session = { access_token: null, user: null, obtained_at: 0, otp_verified: false }
let _sessionLoaded = false

const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000 // ASTINA tokens are stable ~hours

async function _mongoCollection() {
  try {
    const { getDb } = require('./db')
    const db = await getDb()
    return db.collection('astina_sessions')
  } catch (_) { return null }
}

async function _loadSessionFromMongo() {
  if (_sessionLoaded) return _session
  _sessionLoaded = true
  const coll = await _mongoCollection()
  if (!coll) return _session
  const email = process.env.ASTINA_USERNAME || 'default'
  try {
    const doc = await coll.findOne({ email })
    if (doc && doc.access_token && doc.otp_verified && doc.obtained_at) {
      const age = Date.now() - Number(doc.obtained_at)
      if (age < SESSION_MAX_AGE_MS) {
        _session = {
          access_token: doc.access_token,
          user: doc.user || null,
          obtained_at: Number(doc.obtained_at),
          otp_verified: !!doc.otp_verified,
        }
      }
    }
  } catch (_) {}
  return _session
}

async function _persistSession() {
  const coll = await _mongoCollection()
  if (!coll) return
  const email = process.env.ASTINA_USERNAME || 'default'
  try {
    await coll.updateOne(
      { email },
      { $set: {
        email,
        access_token: _session.access_token,
        user: _session.user,
        obtained_at: _session.obtained_at,
        otp_verified: _session.otp_verified,
        updated_at: new Date().toISOString(),
      } },
      { upsert: true },
    )
  } catch (_) {}
}

async function _clearPersistedSession() {
  const coll = await _mongoCollection()
  if (!coll) return
  const email = process.env.ASTINA_USERNAME || 'default'
  try { await coll.deleteOne({ email }) } catch (_) {}
}

async function currentSession() {
  await _loadSessionFromMongo()
  return { ..._session }
}

async function autoLogin({ manualOtp, waitOtp = false } = {}) {
  const email = process.env.ASTINA_USERNAME
  const password = process.env.ASTINA_PASSWORD
  if (!email || !password) throw new Error('ASTINA_USERNAME / ASTINA_PASSWORD belum di-set di env')

  // Timestamp before login = anchor for OTP search (SOAP + IMAP)
  const startedAt = Date.now() - 60_000 // include 1 min buffer

  const { access_token, user, captcha_used } = await loginWithCaptcha({ email, password })
  _session = { access_token, user, obtained_at: Date.now(), otp_verified: false }
  _sessionLoaded = true
  await _persistSession()

  if (manualOtp) {
    await validateOtp(access_token, manualOtp)
    _session.otp_verified = true
    await _persistSession()
    return { ok: true, step: 'authenticated', user, captcha_used, otp_used: manualOtp }
  }

  if (!waitOtp || !process.env.ZIMBRA_EMAIL || !process.env.ZIMBRA_PASSWORD) {
    return {
      ok: true, step: 'awaiting_otp',
      message: 'Login step 1 OK. Cek email untuk OTP, lalu POST /api/astina/verify-otp {"otp":"xxxxxx"} atau POST /api/astina/fetch-otp untuk auto-fetch.',
      captcha_used,
    }
  }

  // Try Zimbra SOAP first (works even when per-account IMAP is disabled),
  // then IMAP as fallback. Same order as the dedicated /fetch-otp endpoint.
  const errors = []
  try {
    const otp = await fetchOtpFromZimbraSoap({ waitMs: 90_000, sinceMs: startedAt })
    await validateOtp(access_token, otp)
    _session.otp_verified = true
    await _persistSession()
    return { ok: true, step: 'authenticated', user, captcha_used, otp_used: otp, otp_source: 'zimbra_soap' }
  } catch (e) { errors.push('soap: ' + e.message) }
  try {
    const otp = await fetchOtpFromZimbra({ waitMs: 60_000, since: startedAt })
    await validateOtp(access_token, otp)
    _session.otp_verified = true
    await _persistSession()
    return { ok: true, step: 'authenticated', user, captcha_used, otp_used: otp, otp_source: 'imap' }
  } catch (e) { errors.push('imap: ' + e.message) }

  return {
    ok: true, step: 'awaiting_otp',
    message: 'Login step 1 OK, auto-fetch OTP gagal: ' + errors.join(' | ') + '. Masukkan OTP manual via /api/astina/verify-otp.',
    captcha_used, zimbra_error: errors.join(' | '),
  }
}

async function fetchOtpFromZimbraAndValidate() {
  await _loadSessionFromMongo()
  if (!_session.access_token) throw new Error('Belum login step 1. Jalankan /api/astina/login dulu.')
  // Only accept OTPs sent after login step 1. Small negative buffer for clock skew.
  const sinceMs = (_session.obtained_at || Date.now()) - 5_000
  const errors = []
  // 1) Zimbra SOAP first (works even when IMAP is disabled per account)
  try {
    const otp = await fetchOtpFromZimbraSoap({ waitMs: 60_000, sinceMs })
    await validateOtp(_session.access_token, otp)
    _session.otp_verified = true
    await _persistSession()
    return { ok: true, otp_used: otp, source: 'zimbra_soap' }
  } catch (e) { errors.push('soap: ' + e.message) }
  // 2) IMAP fallback
  try {
    const otp = await fetchOtpFromZimbra({ waitMs: 60_000, since: sinceMs })
    await validateOtp(_session.access_token, otp)
    _session.otp_verified = true
    await _persistSession()
    return { ok: true, otp_used: otp, source: 'imap' }
  } catch (e) { errors.push('imap: ' + e.message) }
  throw new Error(errors.join(' | '))
}

async function verifyOtpOnly(otp) {
  await _loadSessionFromMongo()
  if (!_session.access_token) throw new Error('Belum ada session ASTINA. Jalankan /api/astina/login dulu.')
  await validateOtp(_session.access_token, otp)
  _session.otp_verified = true
  await _persistSession()
  return { ok: true }
}

// -------------------- ASTINA API CALLS --------------------
async function astinaFetch(path, { method = 'GET', body = null, retry = true } = {}) {
  await _loadSessionFromMongo()
  if (!_session.access_token || !_session.otp_verified) {
    // Cold start OR token exists but OTP not yet verified -> do full auto-login
    // (captcha + password + Zimbra OTP fetch) in one shot.
    const relog = await autoLogin({ waitOtp: true })
    if (relog.step !== 'authenticated') {
      const e = new Error('Auto-login ASTINA gagal: ' + (relog.message || relog.step))
      e.code = 'OTP_REQUIRED'; throw e
    }
  }
  const doCall = async () => {
    const opts = { method, headers: commonHeaders({ 'Authorization': `Bearer ${_session.access_token}` }) }
    if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body)
    return fetch(`${ASTINA_BASE}${path}`, opts)
  }
  let r = await doCall()
  if ((r.status === 401 || r.status === 403) && retry) {
    // ASTINA token/session expired. Full re-login WITH fresh OTP so the caller
    // gets its data on the same request (best-effort — if Zimbra fails, throw).
    _session = { access_token: null, user: null, obtained_at: 0, otp_verified: false }
    await _clearPersistedSession()
    const relog = await autoLogin({ waitOtp: true })
    if (relog.step !== 'authenticated') {
      const e = new Error('Session expired dan re-login otomatis gagal: ' + (relog.message || relog.step))
      e.code = 'OTP_REQUIRED'; throw e
    }
    r = await doCall()
  }
  const j = await r.json().catch(() => null)
  // ASTINA returns 200 with status:false and message about OTP when the
  // session's OTP hasn't been validated yet. Surface that as OTP_REQUIRED
  // so the API layer can respond with a 428 the UI already handles.
  if (j && j.status === false && typeof j.message === 'string' && /otp/i.test(j.message)) {
    // Persisted session is stale — invalidate so next call re-authenticates
    _session.otp_verified = false
    await _clearPersistedSession()
    const e = new Error(j.message)
    e.code = 'OTP_REQUIRED'
    throw e
  }
  return { status: r.status, body: j }
}

async function logoutSession() {
  _session = { access_token: null, user: null, obtained_at: 0, otp_verified: false }
  _sessionLoaded = true
  await _clearPersistedSession()
  return { ok: true }
}

module.exports = {
  getCaptcha, solveCaptcha, loginWithCaptcha,
  fetchOtpFromZimbra, fetchOtpFromZimbraSoap, zimbraAuth, validateOtp,
  autoLogin, verifyOtpOnly, fetchOtpFromZimbraAndValidate, currentSession,
  astinaFetch, logoutSession,
}
