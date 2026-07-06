// Gajamada (eBdesk Fusion) API client with session cookie management
// Manages login session automatically, refreshes on 401.
// Supports per-user credentials (unit/kasubbid own Gajamada accounts).

const BASE_URL = process.env.GAJAMADA_BASE_URL || 'https://gajamada-propam.polri.go.id'
const APP_ID = process.env.GAJAMADA_APP_ID || '1769155096865'
const CONNECTION_ID = process.env.GAJAMADA_CONNECTION_ID || '245b8fd7c4a763019d5172fad5ec0086'
const DATABASE = process.env.GAJAMADA_DATABASE || 'divpropam'
const UPDATE_GATEWAY_ID = process.env.GAJAMADA_UPDATE_GATEWAY_ID || '20270a4ffc0bc262b68aa142418d9b42'

// Per-user sessions: Map<username, {cookieString, user, loggedInAt}>
const _sessions = new Map()
// Per-user credentials: Map<username, {email, password}>
const _creds = new Map()
// Global fallback session (env-var based, backward compat)
let _globalSession = null

// Simple in-memory cache: key -> { data, expires }
const _cache = new Map()
const CACHE_TTL = 30_000 // 30 seconds
function cacheGet(key) {
  const e = _cache.get(key)
  if (!e) return null
  if (Date.now() > e.expires) { _cache.delete(key); return null }
  return e.data
}
function cacheSet(key, data, ttl = CACHE_TTL) {
  _cache.set(key, { data, expires: Date.now() + ttl })
}

function parseSetCookie(setCookieHeader) {
  if (!setCookieHeader) return null
  const cookies = []
  const rawList = Array.isArray(setCookieHeader) ? setCookieHeader : setCookieHeader.split(/,(?=[^;]+?=)/)
  for (const raw of rawList) {
    const first = raw.split(';')[0].trim()
    if (first && first.includes('=')) cookies.push(first)
  }
  return cookies.join('; ')
}

function commonHeaders(session, extra = {}) {
  const h = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/report/laporan-pengaduan`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    ...extra,
  }
  if (session && session.cookieString) h['Cookie'] = session.cookieString
  return h
}

function _getSession(username) {
  if (username) return _sessions.get(username) || null
  return _globalSession
}
function _setSession(username, session) {
  if (username) _sessions.set(username, session)
  else _globalSession = session
}
function _getCreds(username) {
  if (!username) {
    const u = process.env.GAJAMADA_USERNAME
    const p = process.env.GAJAMADA_PASSWORD
    if (!u || !p) return null
    return { email: u, password: p }
  }
  return _creds.get(username) || null
}

// --- Public credential management ---
export function setCreds(username, { email, password }) {
  _creds.set(username, { email, password })
  _sessions.delete(username) // clear existing session for this user
}
export function hasCreds(username) {
  if (!username) return !!(process.env.GAJAMADA_USERNAME && process.env.GAJAMADA_PASSWORD)
  return _creds.has(username)
}
export function clearSession(username) {
  if (username) _sessions.delete(username)
  else _globalSession = null
}

async function doLogin(username) {
  const creds = _getCreds(username)
  if (!creds || !creds.email || !creds.password) {
    const err = new Error(username
      ? `Kredensial Gajamada belum di-set untuk ${username}`
      : 'Gajamada credentials not set in env (GAJAMADA_USERNAME / GAJAMADA_PASSWORD)')
    err.code = 'GAJAMADA_DISABLED'
    throw err
  }

  const url = `${BASE_URL}/api/v1/apps/auth/login`
  const res = await fetch(url, {
    method: 'POST',
    headers: commonHeaders(null, { 'Cookie': '' }),
    body: JSON.stringify({ email: creds.email, password: creds.password }),
  })

  let setCookie = null
  if (typeof res.headers.getSetCookie === 'function') {
    setCookie = res.headers.getSetCookie()
  } else {
    setCookie = res.headers.get('set-cookie')
  }
  const cookieStr = parseSetCookie(setCookie)

  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.metaData?.status !== true) {
    throw new Error(`Gajamada login failed: ${res.status} ${JSON.stringify(body?.metaData || body)}`)
  }

  const session = {
    cookieString: cookieStr,
    user: body.data?.user || null,
    loggedInAt: Date.now(),
  }
  _setSession(username, session)
  return session
}

async function ensureSession(username) {
  const sess = _getSession(username)
  if (!sess || !sess.cookieString) {
    await doLogin(username)
    return
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/apps/auth/validate`, {
      method: 'GET',
      headers: commonHeaders(sess),
    })
    if (res.ok) {
      const j = await res.json().catch(() => null)
      if (j?.data?.status === 'active') return
    }
  } catch (_) { /* ignore */ }
  await doLogin(username)
}

async function apiCall(username, path, options = {}, retry = true) {
  await ensureSession(username)
  const sess = _getSession(username)
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...commonHeaders(sess),
      ...(options.headers || {}),
    },
  })
  if ((res.status === 401 || res.status === 403) && retry) {
    _sessions.delete(username)
    if (!username) _globalSession = null
    await doLogin(username)
    return apiCall(username, path, options, false)
  }
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

// -------------------- Public API --------------------

export async function login(username = null) {
  return await doLogin(username)
}

export function getSessionUser(username = null) {
  const sess = _getSession(username)
  return sess?.user || null
}

// List cases with filters. filters is object: { status, category, disposisi_case_position, search, from, to, page, size, units }
export async function listCases(username = null, {
  page = 1,
  size = 30,
  order = 'desc',
  orderBy = 'created_date',
  status,
  statuses,
  category,
  unit,
  units,
  search,
  from,
  to,
} = {}) {
  const filters = []

  filters.push({
    field: 'status_label',
    fieldType: 'string',
    field_type_origin: '',
    operator: 'is not one of',
    table: 'gold.report',
    value: { gte: 0, is: '', isOneOf: ['Tolak', 'Laporan Ditolak Polda', 'Laporan ditolak'], lte: 0 },
  })

  if (Array.isArray(units) && units.length > 0) {
    filters.push({
      field: 'disposisi_case_position',
      fieldType: 'string',
      field_type_origin: '',
      operator: 'is one of',
      table: 'gold.report',
      value: { gte: 0, is: '', isOneOf: units, lte: 0 },
    })
  } else if (unit) {
    filters.push({
      field: 'disposisi_case_position',
      fieldType: 'string',
      field_type_origin: '',
      operator: 'is',
      table: 'gold.report',
      value: { gte: 0, is: unit, isOneOf: [], lte: 0 },
    })
  }
  if (Array.isArray(statuses) && statuses.length > 0) {
    filters.push({
      field: 'status_label',
      fieldType: 'string',
      field_type_origin: '',
      operator: 'is one of',
      table: 'gold.report',
      value: { gte: 0, is: '', isOneOf: statuses, lte: 0 },
    })
  } else if (status) {
    filters.push({
      field: 'status_label',
      fieldType: 'string',
      field_type_origin: '',
      operator: 'is',
      table: 'gold.report',
      value: { gte: 0, is: status, isOneOf: [], lte: 0 },
    })
  }
  if (category) {
    filters.push({
      field: 'category',
      fieldType: 'string',
      field_type_origin: '',
      operator: 'is',
      table: 'gold.report',
      value: { gte: 0, is: category, isOneOf: [], lte: 0 },
    })
  }
  filters.push({
    field: 'disposisi_polda',
    fieldType: 'string',
    field_type_origin: '',
    operator: 'is',
    table: 'gold.report',
    value: { gte: 0, is: 'POLDA JAWA BARAT', isOneOf: [], lte: 0 },
  })

  const payload = {
    connectionId: CONNECTION_ID,
    table: 'gold.report',
    orderBy,
    order,
    size,
    page,
    database: DATABASE,
    metaData: {
      dashboardId: APP_ID,
      domain: 'gajamada-propam.polri.go.id',
    },
    filters,
    ...(search ? { search, search_by: ['prepetrator_name', 'content', 'category'] } : {}),
  }

  const cacheKey = (username || '_') + ':listCases:' + JSON.stringify(payload)
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const { body } = await apiCall(username, '/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const result = {
    data: body?.data || [],
    total: body?.metaData?.pagination?.totalElements || 0,
    totalPages: body?.metaData?.pagination?.totalPages || 0,
  }
  cacheSet(cacheKey, result)
  return result
}

export async function getCase(username = null, prepetratorId) {
  const payload = {
    connectionId: CONNECTION_ID,
    table: 'gold.report',
    orderBy: 'created_date',
    order: 'desc',
    size: 1,
    page: 1,
    database: DATABASE,
    filters: [
      {
        field: 'prepetrator_id',
        fieldType: 'string',
        operator: 'is',
        table: 'gold.report',
        value: { gte: 0, is: prepetratorId, isOneOf: [], lte: 0 },
      },
    ],
  }
  const { body } = await apiCall(username, '/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return body?.data?.[0] || null
}

export async function getCaseAttachments(username = null, prepetratorId) {
  const payload = {
    connectionId: CONNECTION_ID,
    queryId: '4f602f42d1b2b8a6d387b6026c5efba5',
    sourceId: ['092330451af086bc6f27edb14693e741'],
    name: 'Bukti Pendukung',
    chart: 'table',
    database_type: 'postgresql',
    dateMapping: { timeZone: 'Asia/Jakarta', fields: ['created_at'] },
    filters: [
      {
        table: 'aduan_masyarakat_v3."report_prepetrators"',
        field: 'prepetrator_id',
        fieldType: 'character varying',
        field_type_origin: 'character varying',
        operatorField: 'AND',
        operator: 'is',
        value: { gte: 0, is: prepetratorId, isOneOf: [], lte: 0 },
      },
    ],
  }
  const { body } = await apiCall(username, '/api/v2/apps/config/handler', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = body?.data || []
  if (data.length < 2) return []
  const [header, ...rows] = data
  return rows.map((row) => Object.fromEntries(header.map((k, i) => [k, row[i]])))
}

export async function getCategories(username = null, disposisiCasePosition) {
  const payload = {
    page: 1,
    size: 100,
    order: 'ASC',
    search: '',
    connectionId: CONNECTION_ID,
    database: DATABASE,
    table: 'gold.report_filter',
    search_by: ['value'],
    filters: [
      {
        field: 'type',
        fieldType: 'text',
        operator: 'is',
        table: 'gold.report_filter',
        value: { gte: 0, is: 'category', isOneOf: [], lte: 0 },
      },
      ...(disposisiCasePosition ? [{
        field: 'disposisi_case_position',
        fieldType: 'string',
        field_type_origin: '',
        operator: 'is',
        table: 'gold.report_filter',
        value: { gte: 0, lte: 0, is: disposisiCasePosition, isOneOf: [] },
      }] : []),
    ],
  }
  const { body } = await apiCall(username, '/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data || []).map((r) => r.value).filter(Boolean)
}

export async function getStatuses(username = null, disposisiCasePosition) {
  const payload = {
    page: 1,
    size: 100,
    order: 'ASC',
    search: '',
    connectionId: CONNECTION_ID,
    database: DATABASE,
    table: 'gold.report_filter',
    search_by: ['value'],
    filters: [
      {
        field: 'value',
        fieldType: 'string',
        operator: 'is not one of',
        table: 'gold.report_filter',
        value: { gte: 0, is: '', isOneOf: ['Tolak', 'Laporan Ditolak Polda', 'Laporan ditolak'], lte: 0 },
      },
      {
        field: 'type',
        fieldType: 'string',
        operator: 'is',
        table: 'gold.report_filter',
        value: { gte: 0, is: 'status_label', isOneOf: [], lte: 0 },
      },
      ...(disposisiCasePosition ? [{
        field: 'disposisi_case_position',
        fieldType: 'string',
        field_type_origin: '',
        operator: 'is',
        table: 'gold.report_filter',
        value: { gte: 0, lte: 0, is: disposisiCasePosition, isOneOf: [] },
      }] : []),
    ],
  }
  const { body } = await apiCall(username, '/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data || []).map((r) => r.value).filter(Boolean)
}

export async function getUnitsCatalog(username = null, parentPosition) {
  const payload = {
    orderBy: '',
    order: 'asc',
    page: 1,
    size: 1000,
    connectionId: CONNECTION_ID,
    table: 'dimension.catalog_unit_v2',
    database: DATABASE,
    filters: parentPosition ? [{
      field: 'case_position_after',
      operator: 'is',
      table: 'dimension.catalog_unit_v2',
      fieldType: 'text',
      value: { is: parentPosition },
    }] : [],
  }
  const { body } = await apiCall(username, '/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return body?.data || []
}

export async function getTimeline(username = null, prepetratorId) {
  const payload = {
    connectionId: CONNECTION_ID,
    queryId: '7761377d7802b8a2f07e200d8cde526b',
    sourceId: ['092330451af086bc6f27edb14693e741'],
    name: 'Timeline',
    chart: 'table',
    database_type: 'postgresql',
    dateMapping: { timeZone: 'Asia/Jakarta', fields: ['date_activity'] },
    filters: [
      {
        table: 'aduan_masyarakat_v3."report_officer_detail"',
        field: 'prepetrator_id',
        operatorField: 'AND',
        operator: 'is',
        value: { gte: 0, is: prepetratorId, isOneOf: [], lte: 0 },
      },
    ],
  }
  const { body } = await apiCall(username, '/api/v2/apps/config/handler', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = body?.data || []
  if (data.length < 2) return []
  const [header, ...rows] = data
  return rows.map((row) => Object.fromEntries(header.map((k, i) => [k, row[i]])))
}

export async function pushUpdate(username = null, caseBody) {
  const payload = {
    client: 'Propam Polri',
    gatewayId: UPDATE_GATEWAY_ID,
    params: {},
    body: caseBody,
  }
  const { status, body } = await apiCall(username, '/api/v1/apps/api/gateway/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { status, body }
}

export async function uploadFile(username = null, buffer, filename, mimeType) {
  await ensureSession(username)
  const sess = _getSession(username)
  const qs = new URLSearchParams({
    folder: 'agent',
    workspaceId: '',
    dashboardId: APP_ID,
    createdBy: sess?.user?.id || '',
    extractFile: 'false',
  })
  const form = new FormData()
  const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' })
  form.append('file', blob, filename)
  form.append('tags', 'assets')
  const res = await fetch(`${BASE_URL}/api/v1/apps/upload/upload-file?${qs.toString()}`, {
    method: 'POST',
    headers: { Cookie: sess?.cookieString || '' },
    body: form,
  })
  if (res.status === 401 || res.status === 403) {
    await doLogin(username)
    return uploadFile(username, buffer, filename, mimeType)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.data?.path) {
    throw new Error('Gajamada upload gagal: ' + (body?.message || res.status))
  }
  return body.data
}

const ATTACH_GATEWAY_ID = process.env.GAJAMADA_ATTACH_GATEWAY_ID || '314b80f7ce408ee9911ac3d4723ba0f9'
export async function attachToReport(username = null, reportId, attachments) {
  const sess = _getSession(username)
  const payload = {
    client: 'Propam Polri',
    gatewayId: ATTACH_GATEWAY_ID,
    params: {},
    body: { report_id: reportId, attachment: attachments },
    headers: {},
    additionalPath: '',
    additionalParams: {},
    additionalFileParams: {},
    tags: ['Propam Polri'],
    createdBy: sess?.user?.id || '',
    startDate: '',
    endDate: '',
    dashboardId: APP_ID,
    sessionId: '',
    logging: false,
    appendedLog: false,
  }
  const { status, body } = await apiCall(username, '/api/v1/apps/api/gateway/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { status, body }
}

export async function downloadAttachment(username = null, url) {
  await ensureSession(username)
  const sess = _getSession(username)
  let finalUrl = url
  if (url.startsWith('s3://fusion/')) {
    const key = url.substring('s3://fusion/'.length)
    finalUrl = `${BASE_URL}/cdn/media/fusion/${key}`
  }
  const res = await fetch(finalUrl, { headers: commonHeaders(sess) })
  return res
}

// Test connection with provided credentials (does not store, just validates)
export async function testLogin({ email, password }) {
  const url = `${BASE_URL}/api/v1/apps/auth/login`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/report/laporan-pengaduan`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({ email, password }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body || body.metaData?.status !== true) {
    return { ok: false, error: body?.metaData?.message || body?.message || `HTTP ${res.status}` }
  }
  return { ok: true, user: body.data?.user || null }
}
