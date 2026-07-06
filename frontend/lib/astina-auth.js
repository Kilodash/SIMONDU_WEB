// ASTINA auth (pure HTTP, no browser required)
// Flow discovered from HAR files:
//   1) GET  /api/auth/login_web             -> { data: { key, link_captcha (base64 PNG) } }
//   2) POST /api/auth/login_web             body: { email, password, key, captcha }
//        -> { data: { access_token } }
//   3) POST /api/v1/validasi_otp            body: { otp: <int> }  (Bearer token)
//        -> { status: true }
//   4) subsequent calls -> Authorization: Bearer <access_token>
//
// Captcha is solved with Gemini 2.5 Flash / OpenCode Vision.
// OTP is fetched from Zimbra by IMAP.
// Supports per-user credentials (unit/kasubbid own ASTINA accounts).

const Imap = require('imap')
const { simpleParser } = require('mailparser')

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const ASTINA_BASE = process.env.ASTINA_BASE_URL || 'https://api-gw.polri.go.id/api-eoffice'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'

const commonHeaders = (extra = {}) => ({
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'Origin': 'https://astina.polri.go.id',
  'Referer': 'https://astina.polri.go.id/',
  'User-Agent': UA,
  ...extra,
})

// Module-level env keys cache (set from route handler to bypass webpack bundling)
let _envKeys = null
function setEnvKeys(keys) { _envKeys = keys }
function getEnvKeys() { return _envKeys }

// Per-user sessions: Map<username, session>
const _sessions = new Map()
// Per-user credentials: Map<username, {astina_email, astina_password, zimbra_email, zimbra_password}>
const _creds = new Map()
// Global fallback session (env-var based, backward compat)
let _globalSession = { access_token: null, user: null, obtained_at: 0, otp_verified: false }
let _sessionLoaded = false

const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000

function _getSession(username) {
  if (username) return _sessions.get(username) || null
  return _globalSession
}
function _setSession(username, sess) {
  if (username) _sessions.set(username, sess)
  else _globalSession = sess
}

function _getCreds(username) {
  if (!username) {
    const e = process.env.ASTINA_USERNAME
    const p = process.env.ASTINA_PASSWORD
    const ze = process.env.ZIMBRA_EMAIL
    const zp = process.env.ZIMBRA_PASSWORD
    if (!e || !p) return null
    return { astina_email: e, astina_password: p, zimbra_email: ze || null, zimbra_password: zp || null }
  }
  return _creds.get(username) || null
}

// --- Public credential management ---
function setCreds(username, { astina_email, astina_password, zimbra_email, zimbra_password }) {
  _creds.set(username, { astina_email, astina_password, zimbra_email: zimbra_email || null, zimbra_password: zimbra_password || null })
  _sessions.delete(username)
}
function hasCreds(username) {
  if (!username) return !!(process.env.ASTINA_USERNAME && process.env.ASTINA_PASSWORD)
  return _creds.has(username)
}
function clearUserSession(username) {
  if (username) _sessions.delete(username)
  else _globalSession = { access_token: null, user: null, obtained_at: 0, otp_verified: false }
}

// --- Captcha ---
async function getCaptcha() {
  const r = await fetch(`${ASTINA_BASE}/api/auth/login_web`, {
    method: 'GET',
    headers: commonHeaders(),
  })
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('json')) {
    const e = new Error(`ASTINA server mengembalikan ${ct.split(';')[0]} (bukan JSON). Server mungkin sedang maintenance atau session tidak valid.`)
    e.code = 'OTP_REQUIRED'
    throw e
  }
  const j = await r.json().catch(() => null)
  if (!j) {
    const e = new Error('ASTINA response bukan JSON yang valid.')
    e.code = 'OTP_REQUIRED'
    throw e
  }
  if (!j?.status || !j?.data?.link_captcha || !j?.data?.key) {
    throw new Error('Gagal ambil captcha ASTINA: ' + JSON.stringify(j).slice(0, 200))
  }
  return { key: j.data.key, image_base64: j.data.link_captcha }
}

async function solveCaptcha(base64Png, envKeys = null) {
  const keys = envKeys || _envKeys || {}
  const GEMINI_KEY = keys.gemini || ''
  const OPENCODE_KEY = keys.opencode || ''
  const OPENCODE_BASE = keys.opencode_base || 'https://opencode.ai/zen/go'

  if (!GEMINI_KEY && !OPENCODE_KEY) throw new Error('API key belum di-set. Tambahkan di Pengaturan > AI.')

  const errors = []

  // 1) Gemini (vision-native, free tier)
  if (GEMINI_KEY) {
    try {
      const body = { contents: [{ parts: [
        { text: 'Baca teks captcha di gambar. Jawab HANYA karakter captcha (huruf kecil + angka), tanpa spasi/penjelasan.' },
        { inlineData: { mimeType: 'image/png', data: base64Png } },
      ] }] }
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) throw new Error(`Gemini HTTP ${r.status}: ${j?.error?.message || JSON.stringify(j?.error)}`)
      const text = (j?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().replace(/\s+/g, '').toLowerCase()
      if (text) return text.replace(/[^a-z0-9]/gi, '').slice(0, 8)
      errors.push('Gemini: tidak mengembalikan teks')
    } catch (e) { errors.push('Gemini: ' + e.message) }
  }

  // 2) OpenCode (vision model via Zen Go) — cek /v1/messages endpoint
  if (OPENCODE_KEY) {
    try {
      const body = { model: 'qwen3.6-plus', messages: [{ role: 'user', content: [
        { type: 'text', text: 'Baca teks captcha di gambar. Jawab HANYA karakter captcha (huruf kecil + angka), tanpa spasi/penjelasan.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Png}` } },
      ] }], max_tokens: 50 }
      const r = await fetch(`${OPENCODE_BASE}/v1/messages`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${OPENCODE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const raw = await r.text().catch(() => '')
      if (!r.ok) throw new Error(`OpenCode HTTP ${r.status}: ${raw.slice(0, 200)}`)
      let j = null; try { j = raw ? JSON.parse(raw) : null } catch (_) {}
      if (!j) throw new Error('OpenCode: response bukan JSON')
      if (j.type === 'error') throw new Error(`OpenCode: ${j.error?.message || JSON.stringify(j.error)}`)
      const text = (j?.choices?.[0]?.message?.content || '').trim().replace(/\s+/g, '').toLowerCase()
      if (text) return text.replace(/[^a-z0-9]/gi, '').slice(0, 8)
      errors.push('OpenCode: tidak mengembalikan teks')
    } catch (e) { errors.push('OpenCode: ' + e.message) }
  }

  throw new Error(errors.join(' | ') || 'Captcha solving gagal')
}

async function loginWithCaptcha({ email, password, maxAttempts = 4, envKeys = null }) {
  let lastErr = null
  for (let i = 1; i <= maxAttempts; i++) {
    const { key, image_base64 } = await getCaptcha()
    let captcha
    try { captcha = await solveCaptcha(image_base64, envKeys) } catch (e) { lastErr = e; continue }
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
    if (/password|email|akun|user/i.test(j?.message || '') && !/captcha/i.test(j?.message || '')) break
  }
  throw lastErr || new Error('Login ASTINA gagal setelah percobaan')
}

// --- Zimbra IMAP OTP ---
function fetchOtpFromZimbra({ waitMs = 60_000, since = Date.now() - 5 * 60_000, zimbraEmail, zimbraPassword } = {}) {
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
      user: zimbraEmail,
      password: zimbraPassword,
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

// --- Zimbra SOAP OTP ---
const ZIMBRA_BASE = process.env.ZIMBRA_BASE_URL || 'https://mail.polri.go.id'

async function zimbraAuth(zimbraEmail, zimbraPassword) {
  const soap = {
    Header: { context: { _jsns: 'urn:zimbra', userAgent: { name: 'zclient', version: 'simondu-1' } } },
    Body: { AuthRequest: {
      _jsns: 'urn:zimbraAccount',
      account: { by: 'name', _content: zimbraEmail },
      password: { _content: zimbraPassword },
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

function extractOtp(text) {
  if (!text) return null
  const cleaned = text
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
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
      if (!/otp|verifikasi|kode|token|verification|pin|astina/i.test(full)) continue
      const otp = extractOtp(bodyText) || extractOtp(subject)
      if (otp) return otp
    }
    await new Promise((r) => setTimeout(r, 4_000))
  }
  throw new Error('OTP tidak ditemukan (email harus baru, diterima setelah ' + new Date(sinceMs).toISOString() + ')')
}

async function fetchOtpFromZimbraSoap({ waitMs = 90_000, sinceMs = Date.now() - 5 * 60_000, zimbraEmail, zimbraPassword } = {}) {
  const token = await zimbraAuth(zimbraEmail, zimbraPassword)
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

// --- MongoDB session persistence ---
async function _mongoCollection() {
  try {
    const { getDb } = require('./db')
    const db = await getDb()
    return db.collection('astina_sessions')
  } catch (_) { return null }
}

async function _loadSessionFromMongo(username) {
  if (_sessionLoaded && !username) return _globalSession
  if (username) {
    const existing = _sessions.get(username)
    if (existing) return existing
  }
  const coll = await _mongoCollection()
  if (!coll) return username ? null : _globalSession
  const key = username || 'default'
  try {
    const doc = await coll.findOne({ username: key })
    if (doc && doc.access_token && doc.otp_verified && doc.obtained_at) {
      const age = Date.now() - Number(doc.obtained_at)
      if (age < SESSION_MAX_AGE_MS) {
        const sess = {
          access_token: doc.access_token,
          user: doc.user || null,
          obtained_at: Number(doc.obtained_at),
          otp_verified: !!doc.otp_verified,
        }
        _setSession(username, sess)
        if (!username) _sessionLoaded = true
        return sess
      }
    }
  } catch (_) {}
  if (!username) _sessionLoaded = true
  return _getSession(username)
}

async function _persistSession(username) {
  const coll = await _mongoCollection()
  if (!coll) return
  const key = username || 'default'
  const sess = _getSession(username)
  if (!sess) return
  try {
    await coll.updateOne(
      { username: key },
      { $set: {
        username: key,
        access_token: sess.access_token,
        user: sess.user,
        obtained_at: sess.obtained_at,
        otp_verified: sess.otp_verified,
        updated_at: new Date().toISOString(),
      } },
      { upsert: true },
    )
  } catch (_) {}
}

async function _clearPersistedSession(username) {
  const coll = await _mongoCollection()
  if (!coll) return
  const key = username || 'default'
  try { await coll.deleteOne({ username: key }) } catch (_) {}
}

async function currentSession(username = null) {
  await _loadSessionFromMongo(username)
  const sess = _getSession(username)
  return sess ? { ...sess } : { access_token: null, user: null, obtained_at: 0, otp_verified: false }
}

async function getNewCaptcha() {
  return await getCaptcha()
}

async function loginWithManualCaptcha({ key, captcha, email, password }) {
  const r = await fetch(`${ASTINA_BASE}/api/auth/login_web`, {
    method: 'POST',
    headers: commonHeaders(),
    body: JSON.stringify({ email, password, key, captcha }),
  })
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('json')) throw new Error('ASTINA server mengembalikan non-JSON')
  const j = await r.json().catch(() => null)
  if (!j) throw new Error('ASTINA response bukan JSON valid')
  if (j.status && j.data?.access_token) {
    return { access_token: j.data.access_token, user: j.data.user || null }
  }
  throw new Error(j.message || 'Login gagal (captcha mungkin salah)')
}

async function autoLogin({ manualOtp, waitOtp = false, manualCaptcha = null, username = null } = {}) {
  const creds = _getCreds(username)
  if (!creds || !creds.astina_email || !creds.astina_password) {
    throw new Error(username
      ? `Kredensial ASTINA belum di-set untuk ${username}`
      : 'ASTINA_USERNAME / ASTINA_PASSWORD belum di-set di env')
  }
  const email = creds.astina_email
  const password = creds.astina_password

  const startedAt = Date.now() - 60_000

  let access_token, user
  if (manualCaptcha && manualCaptcha.key && manualCaptcha.captcha) {
    const r = await loginWithManualCaptcha({ key: manualCaptcha.key, captcha: manualCaptcha.captcha, email, password })
    access_token = r.access_token
    user = r.user
  } else {
    const r = await loginWithCaptcha({ email, password })
    access_token = r.access_token
    user = r.user
  }
  const sess = { access_token, user, obtained_at: Date.now(), otp_verified: false }
  _setSession(username, sess)
  if (username) _sessionLoaded = true
  await _persistSession(username)

  if (manualOtp) {
    await validateOtp(access_token, manualOtp)
    sess.otp_verified = true
    await _persistSession(username)
    return { ok: true, step: 'authenticated', user }
  }

  const hasZimbra = creds.zimbra_email && creds.zimbra_password
  if (!waitOtp || !hasZimbra) {
    return {
      ok: true, step: 'awaiting_otp',
      message: 'Login step 1 OK. Cek email untuk OTP, lalu POST /api/astina/verify-otp {"otp":"xxxxxx"} atau POST /api/astina/fetch-otp untuk auto-fetch.',
    }
  }

  const errors = []
  try {
    const otp = await fetchOtpFromZimbra({ waitMs: 30_000, since: startedAt, zimbraEmail: creds.zimbra_email, zimbraPassword: creds.zimbra_password })
    await validateOtp(access_token, otp)
    sess.otp_verified = true
    await _persistSession(username)
    return { ok: true, step: 'authenticated', user, otp_used: otp, otp_source: 'imap' }
  } catch (e) { errors.push('imap: ' + e.message) }
  try {
    const otp = await fetchOtpFromZimbraSoap({ waitMs: 30_000, sinceMs: startedAt, zimbraEmail: creds.zimbra_email, zimbraPassword: creds.zimbra_password })
    await validateOtp(access_token, otp)
    sess.otp_verified = true
    await _persistSession(username)
    return { ok: true, step: 'authenticated', user, otp_used: otp, otp_source: 'zimbra_soap' }
  } catch (e) { errors.push('soap: ' + e.message) }

  return {
    ok: true, step: 'awaiting_otp',
    message: 'Login step 1 OK, auto-fetch OTP gagal: ' + errors.join(' | ') + '. Masukkan OTP manual via /api/astina/verify-otp.',
    zimbra_error: errors.join(' | '),
  }
}

async function fetchOtpFromZimbraAndValidate(username = null) {
  await _loadSessionFromMongo(username)
  const sess = _getSession(username)
  if (!sess || !sess.access_token) throw new Error('Belum login step 1. Jalankan /api/astina/login dulu.')
  const sinceMs = ((sess.obtained_at || Date.now()) - 5_000)
  const creds = _getCreds(username)
  if (!creds || !creds.zimbra_email || !creds.zimbra_password) {
    throw new Error('Zimbra credentials not set')
  }
  const errors = []
  try {
    const otp = await fetchOtpFromZimbra({ waitMs: 30_000, since: sinceMs, zimbraEmail: creds.zimbra_email, zimbraPassword: creds.zimbra_password })
    await validateOtp(sess.access_token, otp)
    sess.otp_verified = true
    await _persistSession(username)
    return { ok: true, otp_used: otp, source: 'imap' }
  } catch (e) { errors.push('imap: ' + e.message) }
  try {
    const otp = await fetchOtpFromZimbraSoap({ waitMs: 30_000, sinceMs, zimbraEmail: creds.zimbra_email, zimbraPassword: creds.zimbra_password })
    await validateOtp(sess.access_token, otp)
    sess.otp_verified = true
    await _persistSession(username)
    return { ok: true, otp_used: otp, source: 'zimbra_soap' }
  } catch (e) { errors.push('soap: ' + e.message) }
  throw new Error(errors.join(' | '))
}

async function verifyOtpOnly(username = null, otp) {
  await _loadSessionFromMongo(username)
  const sess = _getSession(username)
  if (!sess || !sess.access_token) throw new Error('Belum ada session ASTINA. Jalankan /api/astina/login dulu.')
  await validateOtp(sess.access_token, otp)
  sess.otp_verified = true
  await _persistSession(username)
  return { ok: true }
}

// --- ASTINA API Calls ---
async function astinaFetch(path, options = {}, username = null) {
  await _loadSessionFromMongo(username)
  const sess = _getSession(username)
  if (!sess || !sess.access_token || !sess.otp_verified) {
    const tryAutoLogin = options.autoLogin !== false
    if (!tryAutoLogin) {
      const e = new Error('ASTINA belum login. Silakan login manual via /api/astina/login')
      e.code = 'OTP_REQUIRED'; throw e
    }
    const relog = await autoLogin({ waitOtp: true, username })
    if (relog.step !== 'authenticated') {
      const e = new Error('Auto-login ASTINA gagal: ' + (relog.message || relog.step))
      e.code = 'OTP_REQUIRED'; throw e
    }
  }
  const doCall = async () => {
    const currentSess = _getSession(username)
    const opts = { method: (options.method || 'GET'), headers: commonHeaders({ 'Authorization': `Bearer ${currentSess.access_token}` }) }
    if (options.body) opts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    return fetch(`${ASTINA_BASE}${path}`, opts)
  }
  let r = await doCall()
  const retry = options.retry !== false
  if ((r.status === 401 || r.status === 403) && retry) {
    _setSession(username, { access_token: null, user: null, obtained_at: 0, otp_verified: false })
    await _clearPersistedSession(username)
    const relog = await autoLogin({ waitOtp: true, username })
    if (relog.step !== 'authenticated') {
      const e = new Error('Session expired dan re-login otomatis gagal: ' + (relog.message || relog.step))
      e.code = 'OTP_REQUIRED'; throw e
    }
    r = await doCall()
  }
  const j = await r.json().catch(() => null)
  if (!j) {
    const e = new Error('ASTINA mengembalikan respons non-JSON (session expired?)')
    e.code = 'OTP_REQUIRED'
    throw e
  }
  if (j && j.status === false && typeof j.message === 'string' && /otp/i.test(j.message)) {
    const currentSess = _getSession(username)
    if (currentSess) currentSess.otp_verified = false
    await _clearPersistedSession(username)
    const e = new Error(j.message)
    e.code = 'OTP_REQUIRED'
    throw e
  }
  return { status: r.status, body: j }
}

async function logoutSession(username = null) {
  _setSession(username, { access_token: null, user: null, obtained_at: 0, otp_verified: false })
  await _clearPersistedSession(username)
  return { ok: true }
}

// Test ASTINA login with provided credentials (does not store, just validates step1)
async function testLogin({ email, password, envKeys = null }) {
  try {
    const r = await loginWithCaptcha({ email, password, maxAttempts: 2, envKeys })
    return { ok: true, user: r.user }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

// Test captcha solving only (no ASTINA login) — for AI settings page
async function testCaptchaSolving(captchaBase64) {
  const { key, image_base64 } = captchaBase64 ? { key: null, image_base64: captchaBase64 } : await getCaptcha()
  try {
    const captcha = await solveCaptcha(image_base64)
    return { ok: true, solved: captcha, source: 'opencode' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

module.exports = {
  getCaptcha, getNewCaptcha, solveCaptcha, loginWithCaptcha, loginWithManualCaptcha,
  fetchOtpFromZimbra, fetchOtpFromZimbraSoap, zimbraAuth, validateOtp,
  autoLogin, verifyOtpOnly, fetchOtpFromZimbraAndValidate, currentSession,
  astinaFetch, logoutSession,
  setCreds, hasCreds, clearUserSession, testLogin, testCaptchaSolving,
  setEnvKeys, getEnvKeys,
}
