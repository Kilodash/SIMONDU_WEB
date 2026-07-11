// Gajamada (eBdesk Fusion) API client with session cookie management
// Single shared account via env vars GAJAMADA_USERNAME / GAJAMADA_PASSWORD

const BASE_URL = process.env.GAJAMADA_BASE_URL || 'https://gajamada-propam.polri.go.id'
const APP_ID = process.env.GAJAMADA_APP_ID || '1769155096865'
const CONNECTION_ID = process.env.GAJAMADA_CONNECTION_ID || '245b8fd7c4a763019d5172fad5ec0086'
const DATABASE = process.env.GAJAMADA_DATABASE || 'divpropam'
const WIDGET_AKSI_GATEWAY_ID = process.env.GAJAMADA_UPDATE_GATEWAY_ID || 'aa6159ec4d7847e8282943f7dfe87c29'

let _session = null

// Simple in-memory cache
const _cache = new Map()
const CACHE_TTL = 30_000
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

function commonHeaders(extra = {}) {
  const h = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/report/laporan-pengaduan`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    ...extra,
  }
  if (_session && _session.cookieString) h['Cookie'] = _session.cookieString
  return h
}

let _overrideUsername = null
let _overridePassword = null
let _overrideBaseUrl = null

export function setGajamadaCredentials(username, password, baseUrl) {
  _overrideUsername = username || null
  _overridePassword = password || null
  _overrideBaseUrl = baseUrl || null
  _session = null
}

async function doLogin() {
  const email = _overrideUsername || process.env.GAJAMADA_USERNAME
  const password = _overridePassword || process.env.GAJAMADA_PASSWORD
  const loginBaseUrl = _overrideBaseUrl || BASE_URL
  if (!email || !password) {
    const err = new Error('Gajamada credentials not set in env (GAJAMADA_USERNAME / GAJAMADA_PASSWORD)')
    err.code = 'GAJAMADA_DISABLED'
    throw err
  }

  const url = `${loginBaseUrl}/api/v1/apps/auth/login`
  const res = await fetch(url, {
    method: 'POST',
    headers: commonHeaders({ 'Cookie': '' }),
    body: JSON.stringify({ email, password }),
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

  _session = {
    cookieString: cookieStr,
    user: body.data?.user || null,
    loggedInAt: Date.now(),
  }
  return _session
}

async function ensureSession() {
  if (!_session || !_session.cookieString) {
    await doLogin()
    return
  }
  try {
    const res = await fetch(`${BASE_URL}/api/v1/apps/auth/validate`, {
      method: 'GET',
      headers: commonHeaders(),
    })
    if (res.ok) {
      const j = await res.json().catch(() => null)
      if (j?.data?.status === 'active') return
    }
  } catch (_) {}
  await doLogin()
}

async function apiCall(path, options = {}, retry = true) {
  await ensureSession()
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...commonHeaders(),
      ...(options.headers || {}),
    },
  })
  if ((res.status === 401 || res.status === 403) && retry) {
    _session = null
    await doLogin()
    return apiCall(path, options, false)
  }
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

// -------------------- Public API --------------------

export function clearSession() {
  _session = null
}

export function getSessionUser() {
  return _session?.user || null
}

export async function listCases({
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
    ...(search ? { search, search_by: ['prepetrator_id', 'pengirim', 'prepetrator_name', 'perihal', 'content', 'category'] } : {}),
  }

  const cacheKey = 'listCases:' + JSON.stringify(payload)
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const { body } = await apiCall('/api/v1/apps/data/management/get-all', {
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

export async function getCase(prepetratorId) {
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
  const { body } = await apiCall('/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return body?.data?.[0] || null
}

export async function getCaseAttachments(prepetratorId) {
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
  const { body } = await apiCall('/api/v2/apps/config/handler', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = body?.data || []
  if (data.length < 2) return []
  const [header, ...rows] = data
  return rows.map((row) => Object.fromEntries(header.map((k, i) => [k, row[i]])))
}

export async function getCategories(disposisiCasePosition) {
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
  const { body } = await apiCall('/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data || []).map((r) => r.value).filter(Boolean)
}

export async function getStatuses(disposisiCasePosition) {
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
  const { body } = await apiCall('/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data || []).map((r) => r.value).filter(Boolean)
}

export async function getUnitsCatalog(parentPosition) {
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
  const { body } = await apiCall('/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return body?.data || []
}

export async function getTimeline(prepetratorId) {
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
  const { body } = await apiCall('/api/v2/apps/config/handler', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const data = body?.data || []
  if (data.length < 2) return []
  const [header, ...rows] = data
  return rows.map((row) => Object.fromEntries(header.map((k, i) => [k, row[i]])))
}

export async function getKesatuanCatalog(nameFilter = '') {
  const filters = []
  if (nameFilter) {
    filters.push({
      field: 'polda_name',
      operator: 'contains',
      table: 'dimension.catalog_kesatuan_terlapor',
      fieldType: 'text',
      value: { gte: 0, is: '', isOneOf: [], lte: 0, contains: nameFilter },
    })
  }
  const payload = {
    orderBy: 'polda_name',
    order: 'asc',
    page: 1,
    size: 1000,
    connectionId: CONNECTION_ID,
    table: 'dimension.catalog_kesatuan_terlapor',
    database: DATABASE,
    filters,
  }
  const { body } = await apiCall('/api/v1/apps/data/management/get-all', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return (body?.data || []).map((r) => ({
    id: r.id,
    name: r.polda_name,
    level: r.level,
  }))
}

export async function getPoldaJabarUnits() {
  const all = []
  const catalog = await getUnitsCatalog(null)

  const isJabarName = (n) => n.includes('JABAR') || n.includes('JAWA BARAT') || n.includes('BANDUNG')

  for (const c of catalog) {
    if (!c.case_position) continue
    const name = c.case_position.toUpperCase()
    if (isJabarName(name)) {
      all.push({ name: c.case_position, parent: c.case_position_after || null, level: 'INTERNAL', source: 'catalog_unit_v2' })
    }
  }

  const jabarNames = new Set(all.map((a) => a.name.toUpperCase()))
  for (let added = true; added;) {
    added = false
    for (const c of catalog) {
      if (!c.case_position) continue
      const name = c.case_position.toUpperCase()
      if (jabarNames.has(name)) continue
      const parent = (c.case_position_after || '').toUpperCase()
      if (jabarNames.has(parent)) {
        all.push({ name: c.case_position, parent: c.case_position_after || null, level: 'INTERNAL', source: 'catalog_unit_v2' })
        jabarNames.add(name)
        added = true
      }
    }
  }

  const kesatuan = await getKesatuanCatalog('JABAR')
  for (const k of kesatuan) {
    if (!all.some((a) => a.name === k.name)) {
      all.push({ name: k.name, parent: null, level: k.level, source: 'catalog_kesatuan_terlapor' })
    }
  }
  return all
}

export async function pushUpdate(params) {
  const payload = {
    client: 'Propam Polri',
    gatewayId: WIDGET_AKSI_GATEWAY_ID,
    params,
    body: {},
  }
  const { status, body } = await apiCall('/api/v1/apps/api/gateway/execute', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return { status, body }
}

export async function downloadAttachment(url) {
  await ensureSession()
  let finalUrl = url
  if (url.startsWith('s3://fusion/')) {
    const key = url.substring('s3://fusion/'.length)
    finalUrl = `${BASE_URL}/cdn/media/fusion/${key}`
  }
  const res = await fetch(finalUrl, { headers: commonHeaders() })
  return res
}

export async function testLogin({ email, password, baseUrl }) {
  const loginUrl = (baseUrl || _overrideBaseUrl || BASE_URL) + '/api/v1/apps/auth/login'
  const res = await fetch(loginUrl, {
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
