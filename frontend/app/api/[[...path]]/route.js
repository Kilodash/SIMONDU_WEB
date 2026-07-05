import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import * as gajamada from '@/lib/gajamada'
import { getDb, getActiveUnits } from '@/lib/db'
import { authenticate, signSession, getCookieHeader, clearCookieHeader, getUserFromRequest } from '@/lib/auth'
import { CHILD_UNITS, KASUBBID_UNIT, PAMINAL_SCOPE_UNITS, CATEGORY_OPTIONS, DERIVED_STATUS } from '@/lib/units'
import { getSupabaseAdmin, STORAGE_BUCKET, ensureBucket } from '@/lib/supabase-admin'
import { FOLLOWUP_DOC_TYPES, STAGE_LABELS, HASIL_LIDIK_OPTIONS, SETTLEMENT_OPTIONS, renderNumberTemplate, computeChecklist } from '@/lib/checklist'

// Default disposisi task templates
const DEFAULT_DISPOSISI_TASKS = ['LIDIK/PULBAKET', 'GELARKAN', 'SP2HP2', 'LAPORKAN HASILNYA']

function ok(data, extra = {}) { return NextResponse.json({ ok: true, ...data }, extra) }
function fail(msg, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }) }

async function requireAuth(request) {
  const u = await getUserFromRequest(request)
  return u || null
}

async function logAudit(actor, action, resource, meta = {}) {
  try {
    const db = await getDb()
    await db.collection('audit_logs').insertOne({
      id: uuidv4(),
      actor: { username: actor?.username, role: actor?.role, unit: actor?.unit || null },
      action, resource, meta, created_at: new Date(),
    })
  } catch (e) { console.error('audit', e) }
}

// Derive effective status from internal state and Gajamada status_label
function deriveStatus(gajamadaStatus, internal) {
  const { hasDisposisi, hasTimelineOrDoc, isCompleted, settlement } = internal
  if (settlement) {
    if (/perdamaian/i.test(settlement)) return 'Perdamaian'
    if (/restorative/i.test(settlement)) return 'Restorative Justice'
    if (/pencabutan/i.test(settlement)) return 'Pencabutan'
    if (/henti/i.test(settlement)) return 'Henti Lidik'
  }
  if (isCompleted) return DERIVED_STATUS.SELESAI
  if (hasTimelineOrDoc) return DERIVED_STATUS.PROSES_LIDIK
  if (hasDisposisi) return DERIVED_STATUS.DIDISTRIBUSI
  if (/perdamaian/i.test(gajamadaStatus || '')) return 'Perdamaian'
  if (/restorative/i.test(gajamadaStatus || '')) return 'Restorative Justice'
  if (/pencabutan/i.test(gajamadaStatus || '')) return 'Pencabutan'
  if (/henti/i.test(gajamadaStatus || '')) return 'Henti Lidik'
  return gajamadaStatus || DERIVED_STATUS.DITERIMA
}

// Merge internal state into a Gajamada case object
async function enrichCase(caseObj) {
  if (!caseObj) return null
  const db = await getDb()
  const pid = caseObj.prepetrator_id
  const [dispositions, timelines, statusHistory, documents, syncLogs, completed, checklistRows, outcome] = await Promise.all([
    db.collection('dispositions').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray(),
    db.collection('timelines').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray(),
    db.collection('status_history').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray(),
    db.collection('followup_documents').find({ prepetrator_id: pid }).sort({ uploaded_at: -1 }).toArray(),
    db.collection('sync_logs').find({ prepetrator_id: pid }).sort({ request_at: -1 }).limit(10).toArray(),
    db.collection('completions').findOne({ prepetrator_id: pid }),
    db.collection('followup_checklist').find({ prepetrator_id: pid }).toArray(),
    db.collection('case_outcomes').findOne({ prepetrator_id: pid }),
  ])
  const strip = (arr) => arr.map(({ _id, ...rest }) => rest)
  const latestDisp = dispositions[0]
  const derived = deriveStatus(caseObj.status_label, {
    hasDisposisi: !!latestDisp,
    hasTimelineOrDoc: timelines.length + documents.length > 0,
    isCompleted: !!completed,
    settlement: outcome?.settlement || null,
  })
  const cleanOutcome = outcome ? { ...outcome, _id: undefined } : null
  const checklist = computeChecklist(cleanOutcome, strip(checklistRows), strip(documents))
  return {
    ...caseObj,
    disposisi_case_position: latestDisp?.to_unit || caseObj.disposisi_case_position,
    derived_status: derived,
    is_atensi: !!latestDisp?.is_atensi,
    _internal: {
      dispositions: strip(dispositions),
      timelines: strip(timelines),
      status_history: strip(statusHistory),
      documents: strip(documents),
      sync_logs: strip(syncLogs),
      completed: completed ? { ...completed, _id: undefined } : null,
      outcome: cleanOutcome,
      checklist,
    },
  }
}

// Fire-and-forget background sync to Gajamada
async function backgroundSync(pid, actor, reason) {
  try {
    const db = await getDb()
    const original = await gajamada.getCase(pid)
    if (!original) return
    const latestDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
    const completed = await db.collection('completions').findOne({ prepetrator_id: pid })
    const outcome = await db.collection('case_outcomes').findOne({ prepetrator_id: pid })
    const timelines = await db.collection('timelines').find({ prepetrator_id: pid }).sort({ created_at: -1 }).limit(5).toArray()
    const derived = deriveStatus(original.status_label, {
      hasDisposisi: !!latestDisp,
      hasTimelineOrDoc: timelines.length > 0 || (await db.collection('followup_documents').countDocuments({ prepetrator_id: pid })) > 0,
      isCompleted: !!completed,
      settlement: outcome?.settlement || null,
    })
    const pushBody = {
      report_id: original.id,
      id: original.id,
      prepetrator_id: pid,
      prepetrator_name: original.prepetrator_name,
      status_label: derived,
      disposisi_case_position: latestDisp?.to_unit || original.disposisi_case_position,
      disposisi_polda: original.disposisi_polda || 'POLDA JAWA BARAT',
      disposisi_police_function: original.disposisi_police_function || 'PAMINAL',
      category: original.category,
      atensi: !!latestDisp?.is_atensi,
      timeline_note: timelines.map((t) => `${new Date(t.created_at).toISOString()} - ${t.title}: ${t.description}`).join('\n'),
    }
    const syncLog = {
      id: uuidv4(), prepetrator_id: pid, payload: pushBody, status: 'pending',
      request_at: new Date(), reason, by: { username: actor?.username, role: actor?.role },
    }
    try {
      const { status, body } = await gajamada.pushUpdate(pushBody)
      syncLog.response = body; syncLog.http_status = status
      syncLog.status = (status >= 200 && status < 300 && body?.metaData?.status !== false) ? 'success' : 'failed'
    } catch (e) {
      syncLog.error = e.message; syncLog.status = 'failed'
    }
    syncLog.completed_at = new Date()
    await db.collection('sync_logs').insertOne(syncLog)

    // ASTINA sync (fire-and-forget after Gajamada)
    try {
      const localCase = await db.collection('local_cases').findOne({ prepetrator_id: pid }).catch(() => null)
      if (localCase && localCase.source === 'astina') {
        const astinaLog = { id: uuidv4(), prepetrator_id: pid, payload: {}, status: 'pending', request_at: new Date(), reason: reason + ' (ASTINA)', by: { username: actor?.username, role: actor?.role } }
        try {
          const { syncToAstina } = require('@/lib/astina-sync')
          const result = await syncToAstina({ ...localCase, status: derived, keterangan: timelines.map((t) => t.title + ': ' + t.description).join('; ') })
          astinaLog.status = result.ok ? 'success' : 'failed'
          astinaLog.response = result
        } catch (e) { astinaLog.error = e.message; astinaLog.status = 'failed' }
        astinaLog.completed_at = new Date()
        await db.collection('sync_logs').insertOne(astinaLog).catch(() => {})
        if (astinaLog.status === 'success') {
          await db.collection('local_cases').updateOne({ prepetrator_id: pid }, { $set: { synced_to_astina: true, updated_at: new Date() } }).catch(() => {})
        }
      }
    } catch (_) { /* ASTINA sync is optional */ }
  } catch (e) { console.error('backgroundSync error', e) }
}
function scheduleSync(pid, actor, reason) {
  // Fire-and-forget (do not await)
  setTimeout(() => { backgroundSync(pid, actor, reason).catch(() => {}) }, 100)
}

async function handleRoute(request, ctx) {
  const params = await ctx.params
  const path = params?.path || []
  const route = '/' + path.join('/')
  const method = request.method
  const url = new URL(request.url)

  // Module-level cache for all-satker-unit names from Gajamada cases
  if (!handleRoute._satkerCache) { handleRoute._satkerCache = null; handleRoute._satkerCacheTime = 0 }
  const SATKER_CACHE_TTL = 60000

  async function getSatkerUnits() {
    if (handleRoute._satkerCache && Date.now() - handleRoute._satkerCacheTime < SATKER_CACHE_TTL) return handleRoute._satkerCache
    const cases = await gajamada.listCases({ size: 500 }).catch(() => ({ data: [] }))
    const paminalSet = new Set([KASUBBID_UNIT, ...CHILD_UNITS].map((u) => u.toUpperCase()))
    handleRoute._satkerCache = [...new Set((cases.data || []).map((c) => c.disposisi_case_position).filter(Boolean))]
      .filter((u) => !paminalSet.has(u.toUpperCase()))
      .sort()
    handleRoute._satkerCacheTime = Date.now()
    return handleRoute._satkerCache
  }

  const SIMPLIFIED_STATUSES = ['DITERIMA', 'DALAM PROSES', 'TERBUKTI', 'TIDAK TERBUKTI', 'PERDAMAIAN']
  const STATUS_MAPPING = {
    DITERIMA: ['Laporan Diterima', 'Diterima'],
    'DALAM PROSES': ['Didistribusi', 'Proses Lidik', 'Distribusi', 'Lidik'],
    TERBUKTI: ['Selesai', 'Terbukti'],
    'TIDAK TERBUKTI': ['Tidak Terbukti', 'Henti Lidik', 'Tolak', 'Laporan Ditolak Polda', 'Laporan ditolak', 'Pencabutan'],
    PERDAMAIAN: ['Perdamaian', 'Restorative Justice', 'Restorative', 'Laporan Selesai Restorative Justice', 'Selesai Restorative Justice'],
  }

  function resolveGajamadaStatuses(simplifiedStatus) {
    return STATUS_MAPPING[simplifiedStatus] || [simplifiedStatus]
  }

  try {
    // ---------- AUTH ----------
    if (route === '/auth/login' && method === 'POST') {
      const { username, password } = await request.json()
      const user = authenticate(username, password)
      if (!user) return fail('Username atau password salah', 401)
      const token = await signSession(user)
      const res = NextResponse.json({ ok: true, user: { username: user.username, name: user.name, role: user.role, unit: user.unit } })
      res.headers.set('Set-Cookie', getCookieHeader(token))
      await logAudit(user, 'login', 'session')
      return res
    }
    if (route === '/auth/logout' && method === 'POST') {
      const res = ok({}); res.headers.set('Set-Cookie', clearCookieHeader()); return res
    }
    if (route === '/auth/me' && method === 'GET') {
      const u = await getUserFromRequest(request)
      if (!u) return fail('Unauthorized', 401)
      return ok({ user: { username: u.username, name: u.name, role: u.role, unit: u.unit } })
    }

    const me = await requireAuth(request)
    if (!me) return fail('Unauthorized', 401)

    // ---------- ASTINA (api-gw.polri.go.id) auto-login + fetch ----------
    if (route === '/astina/status' && method === 'GET') {
      const { currentSession } = require('@/lib/astina-auth')
      const s = await currentSession()
      return ok({
        session: {
          authenticated: !!s.access_token && !!s.otp_verified,
          has_token: !!s.access_token,
          otp_verified: !!s.otp_verified,
          user: s.user ? { name: s.user.name, nrp: s.user.nrp, email: s.user.email, jabatan_name: s.user.jabatan_name } : null,
          obtained_at: s.obtained_at || null,
        },
      })
    }

    if (route === '/astina/logout' && method === 'POST') {
      const { logoutSession } = require('@/lib/astina-auth')
      await logoutSession()
      await logAudit(me, 'astina_logout', 'session')
      return ok({ ok: true })
    }

    if (route === '/astina/login' && method === 'POST') {
      const { autoLogin } = require('@/lib/astina-auth')
      let manualOtp = null, waitOtp = false
      try { const j = await request.json(); manualOtp = j?.otp ? String(j.otp) : null; waitOtp = !!j?.wait_otp } catch (_) {}
      try {
        const result = await autoLogin({ manualOtp, waitOtp })
        await logAudit(me, 'astina_login', 'session', { step: result.step, otp_used: result.otp_used })
        return ok(result)
      } catch (e) {
        return fail('ASTINA login gagal: ' + e.message, 502)
      }
    }

    if (route === '/astina/fetch-otp' && method === 'POST') {
      const { fetchOtpFromZimbraAndValidate } = require('@/lib/astina-auth')
      try {
        const r = await fetchOtpFromZimbraAndValidate()
        await logAudit(me, 'astina_fetch_otp', 'session')
        return ok(r)
      } catch (e) {
        return fail('IMAP fetch OTP gagal: ' + e.message, 502)
      }
    }

    if (route === '/astina/verify-otp' && method === 'POST') {
      const { verifyOtpOnly } = require('@/lib/astina-auth')
      const { otp } = await request.json()
      if (!otp) return fail('OTP wajib diisi')
      try {
        await verifyOtpOnly(String(otp))
        await logAudit(me, 'astina_otp_verify', 'session')
        return ok({ ok: true })
      } catch (e) {
        return fail('Verifikasi OTP gagal: ' + e.message, 502)
      }
    }

    if (route === '/astina/surat-baru' && method === 'GET') {
      const { getSuratBaru } = require('@/lib/astina-client')
      const per_page = parseInt(url.searchParams.get('per_page') || '30', 10)
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const q = url.searchParams.get('q') || ''
      try {
        const r = await getSuratBaru({ per_page, page, q })
        return ok(r)
      } catch (e) {
        if (e.code === 'OTP_REQUIRED') return fail('ASTINA OTP required. POST /api/astina/verify-otp', 428)
        return fail('ASTINA fetch surat_baru gagal: ' + e.message, 502)
      }
    }

    if (route === '/astina/surat-masuk' && method === 'GET') {
      const { getSuratMasuk } = require('@/lib/astina-client')
      const per_page = parseInt(url.searchParams.get('per_page') || '30', 10)
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const q = url.searchParams.get('q') || ''
      try {
        const r = await getSuratMasuk({ per_page, page, q })
        return ok(r)
      } catch (e) {
        if (e.code === 'OTP_REQUIRED') return fail('ASTINA OTP required. POST /api/astina/verify-otp', 428)
        return fail('ASTINA fetch surat_masuk gagal: ' + e.message, 502)
      }
    }

    {
      const m = route.match(/^\/astina\/surat\/([^/]+)\/riwayat$/)
      if (m && method === 'GET') {
        const id = decodeURIComponent(m[1])
        const { getRiwayatDisposisi } = require('@/lib/astina-client')
        try {
          const r = await getRiwayatDisposisi(id)
          return ok({ riwayat_disposisi: r.data || [], source_path: r.source_path })
        } catch (e) {
          if (e.code === 'OTP_REQUIRED') return fail('ASTINA OTP required', 428)
          return fail('ASTINA fetch riwayat gagal: ' + e.message, 502)
        }
      }
    }

    {
      const m = route.match(/^\/astina\/surat\/([^/]+)$/)
      if (m && method === 'GET') {
        const id = decodeURIComponent(m[1])
        const { getSuratDetail, getRiwayatDisposisi } = require('@/lib/astina-client')
        try {
          const [detail, riwayat] = await Promise.all([
            getSuratDetail(id),
            getRiwayatDisposisi(id).catch(() => ({ status: false, data: [] })),
          ])
          return ok({ detail: detail.data, riwayat_disposisi: riwayat.data || [] })
        } catch (e) {
          if (e.code === 'OTP_REQUIRED') return fail('ASTINA OTP required', 428)
          return fail('ASTINA fetch detail gagal: ' + e.message, 502)
        }
      }
    }

    {
      const m = route.match(/^\/astina\/attachment\/([^/]+)$/)
      if (m && method === 'GET') {
        const fileId = decodeURIComponent(m[1])
        const { getFileLink } = require('@/lib/astina-client')
        try {
          const link = await getFileLink(fileId)
          if (!link.ok) return fail('Gagal ambil link attachment: ' + link.message, 502)
          // Fetch the signed file URL (no auth needed once signed)
          const upstream = await fetch(link.url)
          if (!upstream.ok) return fail(`Attachment upstream HTTP ${upstream.status}`, 502)
          const ct = upstream.headers.get('content-type') || 'application/octet-stream'
          const filename = url.searchParams.get('filename') || `attachment-${fileId}`
          const cd = url.searchParams.get('inline') === '1'
            ? `inline; filename="${filename}"`
            : `attachment; filename="${filename}"`
          const buf = Buffer.from(await upstream.arrayBuffer())
          return new Response(buf, {
            status: 200,
            headers: {
              'Content-Type': ct,
              'Content-Disposition': cd,
              'Cache-Control': 'private, max-age=60',
            },
          })
        } catch (e) {
          if (e.code === 'OTP_REQUIRED') return fail('ASTINA OTP required', 428)
          return fail('ASTINA attachment gagal: ' + e.message, 502)
        }
      }
    }

    // ---------- REFERENCE ----------
    if (route === '/reference' && method === 'GET') {
      const [dynamicUnits, db, gajamadaStatuses, nonPaminal] = await Promise.all([
        getActiveUnits(),
        getDb(),
        gajamada.getStatuses().catch(() => []),
        getSatkerUnits(),
      ])
      const satkerRows = await db.collection('satker_satwil').find({}).sort({ order: 1, name: 1 }).toArray()
      const allStatuses = SIMPLIFIED_STATUSES
      const groups = { YANDUAN: false, WASSIDIK: false, POLRES_TA_TABES: false, PROVOS: false, WABPROF: false }
      for (const u of nonPaminal) {
        const up = u.toUpperCase()
        if (up.includes('YANDUAN')) groups.YANDUAN = true
        else if (up.includes('WASSIDIK')) groups.WASSIDIK = true
        else if (up.includes('POLRES')) groups.POLRES_TA_TABES = true
        else if (up.includes('PROVOS')) groups.PROVOS = true
        else if (up.includes('WABPROF')) groups.WABPROF = true
      }
      const gajamadaSatker = [
        ...(groups.YANDUAN ? ['YANDUAN'] : ['YANDUAN']),
        ...(groups.WASSIDIK ? ['WASSIDIK'] : ['WASSIDIK']),
        ...(groups.POLRES_TA_TABES ? ['POLRES/TA/TABES'] : ['POLRES/TA/TABES']),
        ...(groups.PROVOS ? ['KASUBBID PROVOS POLDA JAWA BARAT'] : ['KASUBBID PROVOS POLDA JAWA BARAT']),
        ...(groups.WABPROF ? ['KASUBBID WABPROF POLDA JAWA BARAT'] : ['KASUBBID WABPROF POLDA JAWA BARAT']),
      ]
      return ok({
        units: dynamicUnits.length ? dynamicUnits : CHILD_UNITS,
        kasubbid: KASUBBID_UNIT,
        paminalScope: [KASUBBID_UNIT, ...(dynamicUnits.length ? dynamicUnits : CHILD_UNITS)],
        statuses: allStatuses,
        categories: CATEGORY_OPTIONS,
        default_disposisi_tasks: DEFAULT_DISPOSISI_TASKS,
        followup_doc_types: FOLLOWUP_DOC_TYPES,
        stage_labels: STAGE_LABELS,
        hasil_lidik_options: HASIL_LIDIK_OPTIONS,
        settlement_options: SETTLEMENT_OPTIONS,
        satker_satwil: satkerRows.map(({ _id, ...r }) => r),
        gajamada_satker: gajamadaSatker,
        all_satker_units: nonPaminal,
      })
    }

    // ---------- UNITS MASTER (CRUD) ----------
    if (route === '/units-master' && method === 'GET') {
      const db = await getDb()
      const rows = await db.collection('units_master').find({}).sort({ order: 1, name: 1 }).toArray()
      return ok({ data: rows.map(({ _id, ...r }) => r) })
    }
    if (route === '/units-master' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const { name, parent, is_kasubbid, order } = await request.json()
      if (!name) return fail('Nama unit wajib')
      const db = await getDb()
      const doc = { id: uuidv4(), name, parent: parent || KASUBBID_UNIT, is_kasubbid: !!is_kasubbid, active: true, order: order || 99, created_at: new Date() }
      try { await db.collection('units_master').insertOne(doc) } catch (e) { return fail('Unit dengan nama tersebut sudah ada', 409) }
      await logAudit(me, 'unit_create', doc.id, { name })
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    if (route === '/units-master/sync-gajamada' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const catalog = await gajamada.getUnitsCatalog(KASUBBID_UNIT)
      const db = await getDb()
      let added = 0, existing = 0
      for (const c of catalog) {
        if (!c.case_position) continue
        const existingUnit = await db.collection('units_master').findOne({ name: c.case_position })
        if (existingUnit) { existing++; continue }
        await db.collection('units_master').insertOne({
          id: uuidv4(), name: c.case_position, parent: c.case_position_after || KASUBBID_UNIT,
          is_kasubbid: false, active: true, order: 99, created_at: new Date(), source: 'gajamada',
        })
        added++
      }
      await logAudit(me, 'unit_sync_gajamada', 'catalog', { added, existing })
      return ok({ added, existing, total: catalog.length })
    }
    {
      const m = route.match(/^\/units-master\/([^/]+)$/)
      if (m && (method === 'PUT' || method === 'PATCH')) {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        await db.collection('units_master').updateOne({ id }, { $set: { ...patch, updated_at: new Date() } })
        const row = await db.collection('units_master').findOne({ id })
        if (!row) return fail('Unit tidak ditemukan', 404)
        await logAudit(me, 'unit_update', id, patch)
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
      if (m && method === 'DELETE') {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const db = await getDb()
        await db.collection('units_master').deleteOne({ id })
        await logAudit(me, 'unit_delete', id)
        return ok({})
      }
    }

    // ---------- SATKER/SATWIL MASTER ----------
    if (route === '/satker-satwil' && method === 'GET') {
      const db = await getDb()
      const rows = await db.collection('satker_satwil').find({}).sort({ order: 1, name: 1 }).toArray()
      return ok({ data: rows.map(({ _id, ...r }) => r) })
    }
    if (route === '/satker-satwil' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const { name } = await request.json()
      if (!name) return fail('Nama satker/satwil wajib')
      const db = await getDb()
      const doc = { id: uuidv4(), name, order: 99, created_at: new Date() }
      await db.collection('satker_satwil').insertOne(doc)
      await logAudit(me, 'satker_satwil_create', doc.id, { name })
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    {
      const m = route.match(/^\/satker-satwil\/([^/]+)$/)
      if (m && (method === 'PUT' || method === 'PATCH')) {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        await db.collection('satker_satwil').updateOne({ id }, { $set: { ...patch, updated_at: new Date() } })
        const row = await db.collection('satker_satwil').findOne({ id })
        if (!row) return fail('Satker/Satwil tidak ditemukan', 404)
        await logAudit(me, 'satker_satwil_update', id, patch)
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
      if (m && method === 'DELETE') {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const db = await getDb()
        await db.collection('satker_satwil').deleteOne({ id })
        await logAudit(me, 'satker_satwil_delete', id)
        return ok({})
      }
    }

    // ---------- CASES ----------
    async function fetchCasesForUser(u, opts) {
      let units = opts.units // explicit array override
      const scope = opts.scope || 'paminal'
      if (u.role === 'unit') {
        units = [u.unit]
      } else if (opts.unit && scope === 'all') {
        const allUnits = await getSatkerUnits()
        const up = opts.unit.toUpperCase()
        if (up === 'YANDUAN') units = allUnits.filter((n) => n.toUpperCase().includes('YANDUAN'))
        else if (up === 'WASSIDIK') units = allUnits.filter((n) => n.toUpperCase().includes('WASSIDIK'))
        else if (up === 'POLRES/TA/TABES') units = allUnits.filter((n) => n.toUpperCase().includes('POLRES'))
        else if (up === 'KASUBBID PROVOS POLDA JAWA BARAT') units = allUnits.filter((n) => n.toUpperCase().includes('PROVOS'))
        else if (up === 'KASUBBID WABPROF POLDA JAWA BARAT') units = allUnits.filter((n) => n.toUpperCase().includes('WABPROF'))
        else units = [opts.unit]
        if (!units || units.length === 0) units = [opts.unit]
      } else if (opts.unit) {
        units = [opts.unit]
      } else if (!units) {
        units = scope === 'paminal' ? PAMINAL_SCOPE_UNITS : undefined
      }
      const params = { ...opts, units }
      delete params.scope
      delete params.unit // 'units' array takes precedence
      // Map simplified status to Gajamada statuses
      if (params.status && SIMPLIFIED_STATUSES.includes(params.status)) {
        params.statuses = resolveGajamadaStatuses(params.status)
        delete params.status
      }
      const r = await gajamada.listCases(params).catch((e) => {
        if (e.code === 'GAJAMADA_DISABLED') return { data: [], meta: { total: 0, disabled: true } }
        throw e
      })
      // Enrich each with derived info
      const db = await getDb()
      const pids = r.data.map((c) => c.prepetrator_id)
      const [dispRows, timelineRows, docRows, completedRows, localCaseRows] = await Promise.all([
        db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).sort({ created_at: -1 }).toArray(),
        db.collection('timelines').find({ prepetrator_id: { $in: pids } }).limit(2000).toArray(),
        db.collection('followup_documents').find({ prepetrator_id: { $in: pids } }).limit(2000).toArray(),
        db.collection('completions').find({ prepetrator_id: { $in: pids } }).toArray(),
        opts.case_type ? db.collection('local_cases').find({ prepetrator_id: { $in: pids } }).toArray().catch(() => []) : Promise.resolve([]),
      ])
      const dispBy = {}; const tlByPid = new Set(); const docByPid = new Set(); const compBy = new Set()
      for (const d of dispRows) if (!dispBy[d.prepetrator_id]) dispBy[d.prepetrator_id] = d
      for (const t of timelineRows) tlByPid.add(t.prepetrator_id)
      for (const d of docRows) docByPid.add(d.prepetrator_id)
      for (const c of completedRows) compBy.add(c.prepetrator_id)
      // Build case_type map from local_cases for filtering
      let lcByPid = {}
      if (opts.case_type && localCaseRows.length) {
        for (const lc of localCaseRows) if (!lcByPid[lc.prepator_id]) lcByPid[lc.prepator_id] = lc.case_type
      }
      const source = r.data.filter((c) => {
        if (opts.case_type) return !lcByPid[c.prepetrator_id] || lcByPid[c.prepetrator_id] === opts.case_type
        return true
      })
      const enriched = source.map((c) => {
        const d = dispBy[c.prepetrator_id]
        const hasTLorDoc = tlByPid.has(c.prepetrator_id) || docByPid.has(c.prepetrator_id)
        const isCompleted = compBy.has(c.prepetrator_id)
        const derived = deriveStatus(c.status_label, { hasDisposisi: !!d, hasTimelineOrDoc: hasTLorDoc, isCompleted })
        return {
          ...c,
          disposisi_case_position: d?.to_unit || c.disposisi_case_position,
          _internal_disposisi: !!d,
          is_atensi: !!d?.is_atensi,
          derived_status: derived,
        }
      })
      return { data: enriched, total: opts.case_type ? enriched.length : r.total }
    }

    if (route === '/cases' && method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const size = parseInt(url.searchParams.get('size') || '20', 10)
      const search = url.searchParams.get('search') || undefined
      const status = url.searchParams.get('status') || undefined
      const category = url.searchParams.get('category') || undefined
      const unit = url.searchParams.get('unit') || undefined
      const scope = url.searchParams.get('scope') || 'paminal'
      const caseType = url.searchParams.get('case_type') || undefined
      const result = await fetchCasesForUser(me, { page, size, search, status, category, unit: unit || undefined, scope, case_type: caseType })
      return ok({ ...result, page, size })
    }

    // Disposisi queue: Gajamada cases + local_cases (ASTINA/manual)
    if (route === '/disposisi-queue' && method === 'GET') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const db = await getDb()

      // Gajamada cases at KASUBBID position, not yet dispositioned
      const r = await gajamada.listCases({ units: [KASUBBID_UNIT], size: 100 }).catch(() => ({ data: [] }))
      const pids = r.data.map((c) => c.prepetrator_id)
      const disp = await db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).toArray()
      const dispSet = new Set(disp.map((d) => d.prepetrator_id))
      const gajamadaQueue = r.data.filter((c) => !dispSet.has(c.prepetrator_id)).map((c) => ({
        ...c,
        _source: 'gajamada',
        source_alias: c.source_alias || 'GAJAMADA',
      }))

      // Local cases (ASTINA/manual) not yet dispositioned
      const localQueue = []
      try {
        const localCases = await db.collection('local_cases').find({ status: 'Laporan Diterima' }).sort({ created_at: -1 }).limit(50).toArray()
        const localPids = localCases.map((c) => c.prepator_id)
        const localDisp = await db.collection('dispositions').find({ prepetrator_id: { $in: localPids } }).toArray()
        const localDispSet = new Set(localDisp.map((d) => d.prepetrator_id))
        for (const lc of localCases) {
          if (!localDispSet.has(lc.prepator_id)) {
            localQueue.push({
              id: lc.prepator_id, prepetrator_id: lc.prepator_id,
              prepetrator_name: lc.prepator_name || lc.pengirim || '-',
              category: lc.category || 'NON-DUMAS', source_alias: lc.source_alias || lc.source,
              summary: lc.perihal || lc.summary || '', content: lc.content || '',
              pengirim: lc.pengirim || '', created_date: lc.created_at,
              status_label: lc.status, perihal: lc.perihal, nomor_surat: lc.nomor_surat,
              tgl_surat: lc.tgl_surat, case_type: lc.case_type, jenis_surat: lc.jenis_surat,
              pdf_url: lc.pdf_url, _source: lc.source, _is_local: true,
            })
          }
        }
      } catch (_) {}

      // ASTINA live surat (belum disposisi) from api-gw.polri.go.id (Bearer auth)
      const astinaQueue = []
      let astinaError = null
      try {
        const { getSuratBaru, getRiwayatDisposisi } = require('@/lib/astina-client')
        const r = await getSuratBaru({ per_page: 30, page: 1 })
        const suratBaru = r.status ? (r.data || []) : []
        const astinaIds = suratBaru.map((s) => s.id)
        const astinaDisp = await db.collection('dispositions').find({ prepetrator_id: { $in: astinaIds } }).toArray().catch(() => [])
        const astinaDispSet = new Set(astinaDisp.map((d) => d.prepetrator_id))
        // Fetch riwayat disposisi in parallel (best-effort, limit concurrency)
        const riwayatMap = {}
        await Promise.all(suratBaru.slice(0, 20).map(async (s) => {
          try {
            const rr = await getRiwayatDisposisi(s.id)
            riwayatMap[s.id] = rr.status ? (rr.data || []) : []
          } catch (_) { riwayatMap[s.id] = [] }
        }))
        for (const s of suratBaru) {
          if (!astinaDispSet.has(s.id)) {
            astinaQueue.push({
              id: s.id, prepetrator_id: s.id,
              prepetrator_name: '-', category: 'NON-DUMAS',
              source_alias: 'ASTINA',
              summary: '', content: '',
              pengirim: s.pengirim || s.dari_name || '', created_date: s.tanggal_surat || s.created_at || new Date().toISOString(),
              status_label: s.status_surat || 'Diterima',
              perihal: s.perihal || '', nomor_surat: s.no_surat || '',
              tgl_surat: s.tanggal_surat || s.tanggal, case_type: 'non_pengaduan',
              jenis_surat: s.klasifikasi || s.jenis_name || '',
              tipe: s.tipe, derajat: s.derajat, note: s.note, kka_name: s.kka_name,
              pembuat_surat: s.pembuat_surat, jam: s.jam,
              files: s.file || [], lampiran: s.lampiran || [],
              _source: 'astina', _is_live: true,
              _astina_raw: s,
              _riwayat_disposisi: riwayatMap[s.id] || [],
            })
          }
        }
      } catch (e) {
        astinaError = e.code === 'OTP_REQUIRED' ? 'OTP_REQUIRED' : e.message
      }

      const queue = [...gajamadaQueue, ...localQueue, ...astinaQueue]
      return ok({ data: queue, total: queue.length, astina_error: astinaError })
    }

    // Lightweight count-only endpoint for sidebar notification badge
    if (route === '/disposisi-queue/count' && method === 'GET') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return ok({ count: 0 })
      const r = await gajamada.listCases({ units: [KASUBBID_UNIT], size: 100 }).catch(() => ({ data: [] }))
      const db = await getDb()
      const pids = r.data.map((c) => c.prepetrator_id)
      const disp = await db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).toArray()
      const dispSet = new Set(disp.map((d) => d.prepetrator_id))
      let count = r.data.filter((c) => !dispSet.has(c.prepetrator_id)).length

      // Add ASTINA count (best-effort, uses Bearer session; ignores if not logged in)
      try {
        const { getSuratBaru } = require('@/lib/astina-client')
        const r = await getSuratBaru({ per_page: 30, page: 1 })
        if (r.status) {
          const astinaIds = (r.data || []).map((s) => s.id)
          const astinaDisp = await db.collection('dispositions').find({ prepetrator_id: { $in: astinaIds } }).toArray().catch(() => [])
          const astinaDispSet = new Set(astinaDisp.map((d) => d.prepetrator_id))
          count += (r.data || []).filter((s) => !astinaDispSet.has(s.id)).length
        }
      } catch (_) {}

      return ok({ count })
    }

    // Bulk disposisi
    if (route === '/disposisi-bulk' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const { items, to_unit, note, is_atensi, case_type } = await request.json()
      if (!Array.isArray(items) || items.length === 0) return fail('items wajib')
      if (!to_unit || !CHILD_UNITS.includes(to_unit)) return fail('Unit tujuan tidak valid')
      const db = await getDb()
      const results = []
      for (const pid of items) {
        const disp = {
          id: uuidv4(),
          prepetrator_id: pid,
          to_unit,
          from_unit: KASUBBID_UNIT,
          note: note || '',
          is_atensi: !!is_atensi,
          case_type: case_type || 'dumas',
          by: { username: me.username, name: me.name, role: me.role },
          created_at: new Date(),
          synced_to_gajamada: false,
        }
        await db.collection('dispositions').insertOne(disp)
        // Upsert case_type to local_cases for tab filtering
        try {
          await db.collection('local_cases').updateOne(
            { prepetrator_id: pid },
            { $set: { case_type: case_type || 'dumas', updated_at: new Date() }, $setOnInsert: { prepetrator_id: pid, source: 'gajamada', created_at: new Date() } },
            { upsert: true }
          )
        } catch (_) {}
        await db.collection('timelines').insertOne({
          id: uuidv4(), prepetrator_id: pid,
          title: `Disposisi ke ${to_unit}${is_atensi ? ' (ATENSI)' : ''}`,
          description: note || '-',
          by: { username: me.username, name: me.name, role: me.role },
          created_at: new Date(),
        })
        scheduleSync(pid, me, 'disposisi')
        await logAudit(me, 'disposisi', pid, { to_unit, is_atensi: !!is_atensi })
        results.push({ pid, ok: true })
      }
      return ok({ data: results })
    }

    // Riwayat disposisi (sudah didisposisi)
    if (route === '/disposisi-history' && method === 'GET') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const db = await getDb()
      const dispositions = await db.collection('dispositions').find({}).sort({ created_at: -1 }).limit(200).toArray()
      const pids = [...new Set(dispositions.map((d) => d.prepetrator_id))]
      // Get case info from Gajamada in batches
      const caseMap = {}
      if (pids.length > 0) {
        const r = await gajamada.listCases({ size: pids.length, units: PAMINAL_SCOPE_UNITS }).catch(() => ({ data: [] }))
        for (const c of r.data) caseMap[c.prepetrator_id] = c
      }
      const enriched = dispositions.map((d) => ({
        ...d,
        case_info: caseMap[d.prepetrator_id] || null,
      }))
      return ok({ data: enriched.map(({ _id, ...r }) => r) })
    }

    // Edit disposisi (ubah unit/catatan/atensi)
    {
      const m = route.match(/^\/dispositions\/([^/]+)$/)
      if (m && (method === 'PUT' || method === 'PATCH')) {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        const existing = await db.collection('dispositions').findOne({ id })
        if (!existing) return fail('Disposisi tidak ditemukan', 404)
        await db.collection('dispositions').updateOne({ id }, { $set: { ...patch, updated_at: new Date() } })
        if (patch.to_unit || patch.note || patch.is_atensi !== undefined) {
          await db.collection('timelines').insertOne({
            id: uuidv4(), prepetrator_id: existing.prepetrator_id,
            title: `Disposisi diubah${patch.to_unit ? ' ke ' + patch.to_unit : ''}${patch.is_atensi ? ' (ATENSI)' : ''}`,
            description: patch.note || 'Disposisi diperbarui oleh ' + me.name,
            by: { username: me.username, name: me.name, role: me.role },
            created_at: new Date(),
          })
          scheduleSync(existing.prepetrator_id, me, 'edit_disposisi')
        }
        await logAudit(me, 'disposisi_edit', id, patch)
        const row = await db.collection('dispositions').findOne({ id })
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
    }

    // ---------- Sub-resources of cases ----------
    const attMatch = route.match(/^\/cases\/([^/]+)\/attachments$/)
    if (attMatch && method === 'GET') {
      const pid = decodeURIComponent(attMatch[1])
      const atts = await gajamada.getCaseAttachments(pid)
      return ok({ data: atts })
    }

    // Merged Gajamada timeline + internal timeline
    const tlAllMatch = route.match(/^\/cases\/([^/]+)\/timeline-all$/)
    if (tlAllMatch && method === 'GET') {
      const pid = decodeURIComponent(tlAllMatch[1])
      const [gjEntries, internal] = await Promise.all([
        gajamada.getTimeline(pid).catch(() => []),
        (async () => {
          const db = await getDb()
          const rows = await db.collection('timelines').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray()
          return rows.map(({ _id, ...r }) => r)
        })(),
      ])
      // Normalize Gajamada entries
      const gjNorm = gjEntries.map((e) => ({
        source: 'gajamada',
        id: `gj-${e.date_activity}-${e.previous_case_position || ''}`,
        date_activity: e.date_activity,
        status: e.status,
        status_alias: e.status_alias,
        title: e.status_alias || e.status,
        description: e.handling_progress || '',
        previous_case_position: e.previous_case_position,
        case_position: e.case_position,
        officer_report_name: e.officer_report_name,
        police_function: e.police_function,
        sub_function: e.sub_function,
      }))
      const intNorm = internal.map((t) => ({
        source: 'internal',
        id: t.id,
        date_activity: t.created_at,
        title: t.title,
        description: t.description,
        officer_report_name: t.by?.name || t.by?.username,
      }))
      const merged = [...gjNorm, ...intNorm].sort((a, b) => {
        const da = new Date(a.date_activity).getTime() || 0
        const db2 = new Date(b.date_activity).getTime() || 0
        return db2 - da
      })
      return ok({ data: merged, gajamada_count: gjNorm.length, internal_count: intNorm.length })
    }

    const upMatch = route.match(/^\/cases\/([^/]+)\/documents$/)
    if (upMatch && method === 'POST') {
      const pid = decodeURIComponent(upMatch[1])
      const form = await request.formData()
      const file = form.get('file')
      const description = form.get('description') || ''
      const documentType = form.get('document_type') || 'lainnya'
      if (!file || typeof file === 'string') return fail('File tidak valid')
      await ensureBucket()
      const sb = getSupabaseAdmin()
      const filename = `${pid}/${Date.now()}_${(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const arrayBuffer = await file.arrayBuffer()
      const { data: upData, error: upErr } = await sb.storage.from(STORAGE_BUCKET).upload(filename, arrayBuffer, {
        contentType: file.type || 'application/octet-stream', upsert: false,
      })
      if (upErr) return fail('Upload gagal: ' + upErr.message, 500)
      const { data: pub } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(filename)

      // Upload asli ke storage Gajamada juga (bukan hanya Supabase), lalu lampirkan
      // ke report via gateway attach-only (tidak mengubah status/case_position).
      let gajamadaPath = null, gajamadaAttachStatus = 'skipped', gajamadaError = null
      try {
        const gjUpload = await gajamada.uploadFile(Buffer.from(arrayBuffer), file.name || 'dokumen', file.type)
        gajamadaPath = gjUpload.path
        const { status, body } = await gajamada.attachToReport(pid, [{ url: gajamadaPath, name: file.name }])
        gajamadaAttachStatus = (status >= 200 && status < 300 && body?.metaData?.status !== false) ? 'success' : 'failed'
      } catch (e) {
        gajamadaAttachStatus = 'failed'; gajamadaError = e.message
        console.error('gajamada upload/attach error', e)
      }

      const docDef = FOLLOWUP_DOC_TYPES.find((d) => d.key === documentType)
      const doc = {
        id: uuidv4(), prepetrator_id: pid,
        filename: file.name, storage_path: upData.path, public_url: pub.publicUrl,
        content_type: file.type, size: file.size, description,
        document_type: documentType,
        gajamada_path: gajamadaPath, gajamada_attach_status: gajamadaAttachStatus, gajamada_error: gajamadaError,
        uploaded_by: { username: me.username, name: me.name, role: me.role, unit: me.unit },
        uploaded_at: new Date(),
      }
      const db = await getDb()
      await db.collection('followup_documents').insertOne(doc)
      // Auto-mark checklist item as completed when it matches a known SOP document type
      if (docDef) {
        await db.collection('followup_checklist').updateOne(
          { prepetrator_id: pid, document_type: documentType },
          { $set: { status: 'completed', updated_by: { username: me.username, name: me.name, role: me.role }, updated_at: new Date() } },
          { upsert: true }
        )
      }
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Upload dokumen: ${docDef?.label || file.name}`,
        description: gajamadaAttachStatus === 'success' ? 'Tersimpan di SIMONDU & Gajamada' : 'Tersimpan di SIMONDU (sinkron ke Gajamada gagal/pending)',
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      const { _id, ...clean } = doc
      scheduleSync(pid, me, 'document_upload')
      await logAudit(me, 'upload_document', pid, { filename: file.name, document_type: documentType, gajamadaAttachStatus })
      return ok({ data: clean })
    }
    if (upMatch && method === 'GET') {
      const pid = decodeURIComponent(upMatch[1])
      const db = await getDb()
      const docs = await db.collection('followup_documents').find({ prepetrator_id: pid }).sort({ uploaded_at: -1 }).toArray()
      return ok({ data: docs.map(({ _id, ...r }) => r) })
    }

    // ---------- FOLLOWUP CHECKLIST (Pusat Tindak Lanjut) ----------
    // Set hasil Lidik (terbukti/tidak_terbukti) and/or jalur penutupan dini (settlement)
    const outcomeMatch = route.match(/^\/cases\/([^/]+)\/outcome$/)
    if (outcomeMatch && method === 'POST') {
      const pid = decodeURIComponent(outcomeMatch[1])
      if (me.role === 'unit') {
        const db0 = await getDb()
        const latestDisp = await db0.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
        if (latestDisp && latestDisp.to_unit !== me.unit) return fail('Kasus ini bukan untuk unit Anda', 403)
      }
      const { hasil_lidik, settlement, pelimpahan } = await request.json()
      if (hasil_lidik && !HASIL_LIDIK_OPTIONS.some((o) => o.value === hasil_lidik)) return fail('Nilai hasil_lidik tidak valid')
      if (settlement && !SETTLEMENT_OPTIONS.some((o) => o.value === settlement)) return fail('Nilai settlement tidak valid')
      const db = await getDb()
      await db.collection('case_outcomes').updateOne(
        { prepetrator_id: pid },
        { $set: { prepetrator_id: pid, hasil_lidik: hasil_lidik || null, settlement: settlement || null, pelimpahan: pelimpahan || null, updated_by: { username: me.username, name: me.name, role: me.role }, updated_at: new Date() } },
        { upsert: true }
      )
      const settlementLabel = SETTLEMENT_OPTIONS.find((o) => o.value === settlement)?.label
      const hasilLabel = HASIL_LIDIK_OPTIONS.find((o) => o.value === hasil_lidik)?.label
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: settlement ? `Jalur Penyelesaian: ${settlementLabel}` : `Hasil Penyelidikan: ${hasilLabel || '-'}`,
        description: '-', by: { username: me.username, name: me.name, role: me.role }, created_at: new Date(),
      })
      scheduleSync(pid, me, 'outcome_update')
      await logAudit(me, 'outcome_update', pid, { hasil_lidik, settlement })
      return ok({})
    }

    // Manually set a checklist item status (pending / completed / not_applicable) + note
    const clMatch = route.match(/^\/cases\/([^/]+)\/checklist\/([^/]+)$/)
    if (clMatch && (method === 'POST' || method === 'PATCH')) {
      const pid = decodeURIComponent(clMatch[1])
      const docType = decodeURIComponent(clMatch[2])
      if (!FOLLOWUP_DOC_TYPES.some((d) => d.key === docType)) return fail('Jenis dokumen tidak dikenal')
      if (me.role === 'unit') {
        const db0 = await getDb()
        const latestDisp = await db0.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
        if (latestDisp && latestDisp.to_unit !== me.unit) return fail('Kasus ini bukan untuk unit Anda', 403)
      }
      const { status, note } = await request.json()
      if (!['pending', 'completed', 'not_applicable'].includes(status)) return fail('Status tidak valid')
      const db = await getDb()
      await db.collection('followup_checklist').updateOne(
        { prepetrator_id: pid, document_type: docType },
        { $set: { status, note: note || '', updated_by: { username: me.username, name: me.name, role: me.role }, updated_at: new Date() } },
        { upsert: true }
      )
      const label = FOLLOWUP_DOC_TYPES.find((d) => d.key === docType)?.label || docType
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Checklist "${label}" → ${status === 'not_applicable' ? 'Tidak Berlaku' : status === 'completed' ? 'Lengkap' : 'Belum Lengkap'}`,
        description: note || '-', by: { username: me.username, name: me.name, role: me.role }, created_at: new Date(),
      })
      scheduleSync(pid, me, 'checklist_update')
      await logAudit(me, 'checklist_update', pid, { docType, status })
      return ok({})
    }

    // Generate the next auto-number for a document type (Sprin/ND/Surat) for this case
    const genNumMatch = route.match(/^\/cases\/([^/]+)\/checklist\/([^/]+)\/generate-number$/)
    if (genNumMatch && method === 'POST') {
      const pid = decodeURIComponent(genNumMatch[1])
      const docType = decodeURIComponent(genNumMatch[2])
      const docDef = FOLLOWUP_DOC_TYPES.find((d) => d.key === docType)
      if (!docDef || !docDef.numbering) return fail('Jenis dokumen ini tidak menggunakan penomoran otomatis')
      const db = await getDb()
      const now = new Date(); const year = now.getFullYear()
      let setting = await db.collection('numbering_settings').findOne({ document_type: docType })
      if (!setting) {
        setting = { id: uuidv4(), document_type: docType, template: docDef.defaultTemplate, next_seq: 1, reset_yearly: true, last_year: year }
        await db.collection('numbering_settings').insertOne(setting)
      }
      let seq = setting.next_seq || 1
      if (setting.reset_yearly && setting.last_year !== year) seq = 1
      const documentNumber = renderNumberTemplate(setting.template, { seq, date: now })
      await db.collection('numbering_settings').updateOne(
        { document_type: docType },
        { $set: { next_seq: seq + 1, last_year: year }, $setOnInsert: { id: setting.id || uuidv4(), template: setting.template, reset_yearly: setting.reset_yearly !== false } },
        { upsert: true }
      )
      await db.collection('followup_checklist').updateOne(
        { prepetrator_id: pid, document_type: docType },
        { $set: { document_number: documentNumber, document_date: now, updated_by: { username: me.username, name: me.name, role: me.role }, updated_at: now } },
        { upsert: true }
      )
      // Also record in document_register
      try {
        await db.collection('document_register').insertOne({
          id: uuidv4(),
          document_type: docType,
          number: documentNumber,
          date: now,
          perihal: `Penomoran otomatis kasus ${pid}`,
          requesting_unit: '',
          keterangan: '',
          is_manual: false,
          prepetrator_id: pid,
          created_at: now,
          updated_at: now,
        })
      } catch (_) { /* document_register table may not exist yet */ }
      await logAudit(me, 'checklist_generate_number', pid, { docType, documentNumber })
      return ok({ data: { document_number: documentNumber } })
    }

    // ---------- NUMBERING SETTINGS (Pengaturan Nomor Otomatis) ----------
    if (route === '/numbering-settings' && method === 'GET') {
      const db = await getDb()
      const rows = await db.collection('numbering_settings').find({}).toArray()
      const byKey = {}
      for (const r of rows) byKey[r.document_type] = r
      const year = new Date().getFullYear()
      const data = FOLLOWUP_DOC_TYPES.filter((d) => d.numbering).map((d) => {
        const existing = byKey[d.key]
        return {
          document_type: d.key,
          label: d.label,
          template: existing?.template || d.defaultTemplate,
          next_seq: existing?.reset_yearly !== false && existing?.last_year && existing.last_year !== year ? 1 : (existing?.next_seq || 1),
          reset_yearly: existing?.reset_yearly !== false,
          preview: renderNumberTemplate(existing?.template || d.defaultTemplate, { seq: existing?.reset_yearly !== false && existing?.last_year && existing.last_year !== year ? 1 : (existing?.next_seq || 1) }),
        }
      })
      return ok({ data })
    }
    {
      const m = route.match(/^\/numbering-settings\/([^/]+)$/)
      if (m && (method === 'PUT' || method === 'PATCH')) {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const docType = decodeURIComponent(m[1])
        if (!FOLLOWUP_DOC_TYPES.some((d) => d.key === docType)) return fail('Jenis dokumen tidak dikenal')
        const { template, next_seq, reset_yearly } = await request.json()
        const db = await getDb()
        const patch = { updated_at: new Date() }
        if (template) patch.template = template
        if (typeof next_seq === 'number') patch.next_seq = next_seq
        if (typeof reset_yearly === 'boolean') patch.reset_yearly = reset_yearly
        await db.collection('numbering_settings').updateOne(
          { document_type: docType },
          { $set: patch, $setOnInsert: { id: uuidv4(), document_type: docType, last_year: new Date().getFullYear() } },
          { upsert: true }
        )
        await logAudit(me, 'numbering_update', docType, patch)
        return ok({})
      }
    }

    // Single disposisi (kept for compatibility, primary flow is bulk)
    const dispMatch = route.match(/^\/cases\/([^/]+)\/disposisi$/)
    if (dispMatch && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const pid = decodeURIComponent(dispMatch[1])
      const { to_unit, note, is_atensi } = await request.json()
      if (!to_unit || !CHILD_UNITS.includes(to_unit)) return fail('Unit tujuan tidak valid')
      const db = await getDb()
      const disp = {
        id: uuidv4(), prepetrator_id: pid, to_unit, from_unit: KASUBBID_UNIT,
        note: note || '', is_atensi: !!is_atensi,
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(), synced_to_gajamada: false,
      }
      await db.collection('dispositions').insertOne(disp)
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Disposisi ke ${to_unit}${is_atensi ? ' (ATENSI)' : ''}`,
        description: note || '-',
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'disposisi')
      await logAudit(me, 'disposisi', pid, { to_unit })
      const { _id, ...clean } = disp
      return ok({ data: clean })
    }

    // Timeline entry (also triggers auto status transition)
    const tlMatch = route.match(/^\/cases\/([^/]+)\/timeline$/)
    if (tlMatch && method === 'POST') {
      const pid = decodeURIComponent(tlMatch[1])
      const { title, description } = await request.json()
      if (!title) return fail('Title wajib diisi')
      const db = await getDb()
      // Unit users can only work on cases assigned to their unit
      if (me.role === 'unit') {
        const latestDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
        if (latestDisp && latestDisp.to_unit !== me.unit) return fail('Kasus ini bukan untuk unit Anda', 403)
      }
      const rec = {
        id: uuidv4(), prepetrator_id: pid, title, description: description || '',
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      }
      await db.collection('timelines').insertOne(rec)
      scheduleSync(pid, me, 'timeline_add')
      await logAudit(me, 'timeline_add', pid, { title })
      const { _id, ...clean } = rec
      return ok({ data: clean })
    }

    // Mark as complete
    const compMatch = route.match(/^\/cases\/([^/]+)\/complete$/)
    if (compMatch && method === 'POST') {
      const pid = decodeURIComponent(compMatch[1])
      const { note } = await request.json().catch(() => ({}))
      const db = await getDb()
      if (me.role === 'unit') {
        const latestDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
        if (latestDisp && latestDisp.to_unit !== me.unit) return fail('Kasus ini bukan untuk unit Anda', 403)
      }
      // Gating: dokumen tindak lanjut wajib (sesuai SOP & cabang hasil Lidik) harus
      // Lengkap/Tidak Berlaku dahulu, kecuali sudah memilih jalur penyelesaian dini.
      const [outcomeRow, checklistRows, documents] = await Promise.all([
        db.collection('case_outcomes').findOne({ prepetrator_id: pid }),
        db.collection('followup_checklist').find({ prepetrator_id: pid }).toArray(),
        db.collection('followup_documents').find({ prepetrator_id: pid }).toArray(),
      ])
      const checklist = computeChecklist(outcomeRow, checklistRows, documents)
      if (!checklist.canComplete) {
        const missing = checklist.items.filter((i) => i.required && i.status === 'pending').map((i) => i.label)
        return fail(`Lengkapi dokumen tindak lanjut wajib dahulu: ${missing.join(', ')}`, 400)
      }
      await db.collection('completions').updateOne(
        { prepetrator_id: pid },
        { $set: { prepetrator_id: pid, note: note || '', by: { username: me.username, name: me.name, role: me.role, unit: me.unit }, completed_at: new Date() } },
        { upsert: true }
      )
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid, title: 'Kasus ditandai Selesai',
        description: note || '-', by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'complete')
      await logAudit(me, 'complete', pid)
      return ok({ data: { prepetrator_id: pid, completed: true } })
    }

    // ---------- PERDAMAIAN ----------
    const perdamaianMatch = route.match(/^\/cases\/([^/]+)\/perdamaian$/)
    if (perdamaianMatch && method === 'POST') {
      const pid = decodeURIComponent(perdamaianMatch[1])
      const { checks } = await request.json()
      const db = await getDb()
      await db.collection('case_outcomes').updateOne(
        { prepetrator_id: pid },
        { $set: { prepetrator_id: pid, settlement: 'perdamaian', updated_by: { username: me.username, name: me.name, role: me.role }, updated_at: new Date() } },
        { upsert: true }
      )
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: 'Perdamaian',
        description: JSON.stringify(checks),
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'perdamaian')
      await logAudit(me, 'perdamaian', pid, { checks })
      return ok({ data: { prepetrator_id: pid, perdamaian: true } })
    }

    const caseMatch = route.match(/^\/cases\/([^/]+)$/)
    if (caseMatch && method === 'GET') {
      const pid = decodeURIComponent(caseMatch[1])
      const c = await gajamada.getCase(pid)
      if (!c) return fail('Kasus tidak ditemukan', 404)
      const enriched = await enrichCase(c)
      return ok({ data: enriched })
    }

    // ---------- DOWNLOAD PROXY ----------
    if (route === '/download' && method === 'GET') {
      const target = url.searchParams.get('url')
      if (!target) return fail('url param required')
      const res = await gajamada.downloadAttachment(target)
      const buffer = await res.arrayBuffer()
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      const name = url.searchParams.get('name') || target.split('/').pop() || 'file'
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${name}"`,
          'Cache-Control': 'private, max-age=60',
        },
      })
    }

    // ---------- ANEV ----------
    if (route === '/anev' && method === 'GET') {
      const scope = url.searchParams.get('scope') || 'paminal'
      const opts = { page: 1, size: 500 }
      if (me.role === 'unit') opts.units = [me.unit]
      else opts.units = scope === 'paminal' ? PAMINAL_SCOPE_UNITS : undefined
      const result = await gajamada.listCases(opts).catch((e) => {
        if (e.code === 'GAJAMADA_DISABLED') return { data: [], total: 0, meta: { disabled: true } }
        throw e
      })
      const cases = result.data
      const total = result.total
      const db = await getDb()
      const pids = cases.map((c) => c.prepetrator_id)
      const [dispRows, tlRows, docRows, compRows] = await Promise.all([
        db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).sort({ created_at: -1 }).toArray(),
        db.collection('timelines').find({ prepetrator_id: { $in: pids } }).limit(2000).toArray(),
        db.collection('followup_documents').find({ prepetrator_id: { $in: pids } }).limit(2000).toArray(),
        db.collection('completions').find({ prepetrator_id: { $in: pids } }).toArray(),
      ])
      const dispBy = {}; const tlSet = new Set(); const docSet = new Set(); const compSet = new Set()
      for (const d of dispRows) if (!dispBy[d.prepetrator_id]) dispBy[d.prepetrator_id] = d
      for (const t of tlRows) tlSet.add(t.prepetrator_id)
      for (const d of docRows) docSet.add(d.prepetrator_id)
      for (const c of compRows) compSet.add(c.prepetrator_id)
      const effective = cases.map((c) => {
        const d = dispBy[c.prepetrator_id]
        const eff_status = deriveStatus(c.status_label, {
          hasDisposisi: !!d,
          hasTimelineOrDoc: tlSet.has(c.prepetrator_id) || docSet.has(c.prepetrator_id),
          isCompleted: compSet.has(c.prepetrator_id),
        })
        return { ...c, eff_unit: d?.to_unit || c.disposisi_case_position, eff_status, is_atensi: !!d?.is_atensi }
      })
      const byStatus = {}, byCategory = {}, byUnit = {}
      let totalDiterima = 0, totalDidistribusi = 0, totalLidik = 0, totalSelesai = 0, totalAtensi = 0
      for (const c of effective) {
        const s = c.eff_status || 'Tidak diketahui'
        byStatus[s] = (byStatus[s] || 0) + 1
        if (s === DERIVED_STATUS.DITERIMA) totalDiterima++
        else if (s === DERIVED_STATUS.DIDISTRIBUSI) totalDidistribusi++
        else if (s === DERIVED_STATUS.PROSES_LIDIK) totalLidik++
        else if (s === DERIVED_STATUS.SELESAI) totalSelesai++
        if (c.is_atensi) totalAtensi++
        const cat = c.category || 'Tidak dikategorikan'
        byCategory[cat] = (byCategory[cat] || 0) + 1
        const u = c.eff_unit || 'Belum didisposisi'
        byUnit[u] = (byUnit[u] || 0) + 1
      }
      const toArr = (o) => Object.entries(o).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
      return ok({
        total, sampled: cases.length, scope,
        kpi: { totalDiterima, totalDidistribusi, totalLidik, totalSelesai, totalAtensi },
        byStatus: toArr(byStatus), byCategory: toArr(byCategory), byUnit: toArr(byUnit),
      })
    }

    if (route === '/audit' && method === 'GET') {
      const db = await getDb()
      const limit = parseInt(url.searchParams.get('limit') || '100', 10)
      const rows = await db.collection('audit_logs').find({}).sort({ created_at: -1 }).limit(limit).toArray()
      return ok({ data: rows.map(({ _id, ...r }) => r) })
    }

    if (route === '/sync-logs' && method === 'GET') {
      const db = await getDb()
      const rows = await db.collection('sync_logs').find({}).sort({ request_at: -1 }).limit(100).toArray()
      return ok({ data: rows.map(({ _id, ...r }) => r) })
    }

    // ---------- DOCUMENT REGISTER ----------
    if (route === '/document-register' && method === 'GET') {
      try {
        const db = await getDb()
        const docType = url.searchParams.get('document_type') || undefined
        const search = url.searchParams.get('search') || undefined
        let q = db.collection('document_register').find({})
        if (docType) q = db.collection('document_register').find({ document_type: docType })
        let rows = await q.sort({ created_at: -1 }).toArray()
        if (search) {
          const s = search.toLowerCase()
          rows = rows.filter((r) => (r.number || '').toLowerCase().includes(s) || (r.perihal || '').toLowerCase().includes(s) || (r.keterangan || '').toLowerCase().includes(s))
        }
        return ok({ data: rows.map(({ _id, ...r }) => r) })
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) return ok({ data: [] })
        throw e
      }
    }
    if (route === '/document-register/next-seq' && method === 'GET') {
      const docType = url.searchParams.get('document_type')
      if (!docType) return fail('document_type required')
      const db = await getDb()
      const rows = await db.collection('document_register').find({ document_type: docType }).toArray()
      return ok({ document_type: docType, next_seq: rows.length + 1 })
    }
    if (route === '/document-register' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const { document_type, number, date, perihal, requesting_unit, keterangan, is_manual, prepetrator_id } = await request.json()
      if (!document_type || !number) return fail('document_type dan number wajib')
      const db = await getDb()
      const doc = {
        id: uuidv4(),
        document_type, number,
        date: date ? new Date(date) : null,
        perihal: perihal || '',
        requesting_unit: requesting_unit || '',
        keterangan: keterangan || '',
        is_manual: !!is_manual,
        prepetrator_id: prepetrator_id || null,
        created_at: new Date(),
        updated_at: new Date(),
      }
      await db.collection('document_register').insertOne(doc)
      await logAudit(me, 'docreg_create', doc.id, { document_type, number })
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    if (route === '/document-register/book' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const { document_type, number, date, perihal, requesting_unit, keterangan, is_manual, prepetrator_id, target_seq } = await request.json()
      if (!document_type || !number) return fail('document_type dan number wajib')
      const db = await getDb()
      const doc = {
        id: uuidv4(),
        document_type, number,
        date: date ? new Date(date) : null,
        perihal: perihal || '',
        requesting_unit: requesting_unit || '',
        keterangan: keterangan || '',
        is_manual: !!is_manual,
        prepetrator_id: prepetrator_id || null,
        created_at: target_seq ? new Date(Date.now() - (target_seq * 1000)) : new Date(),
        updated_at: new Date(),
      }
      await db.collection('document_register').insertOne(doc)
      await logAudit(me, 'docreg_book', doc.id, { document_type, number, target_seq })
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    {
      const m = route.match(/^\/document-register\/([^/]+)$/)
      if (m && method === 'PUT') {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        await db.collection('document_register').updateOne({ id }, { $set: { ...patch, updated_at: new Date() } })
        const row = await db.collection('document_register').findOne({ id })
        if (!row) return fail('Dokumen tidak ditemukan', 404)
        await logAudit(me, 'docreg_update', id, patch)
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
      if (m && method === 'DELETE') {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const db = await getDb()
        await db.collection('document_register').deleteOne({ id })
        await logAudit(me, 'docreg_delete', id)
        return ok({})
      }
    }

    // ---------- PERSONEL ----------
    if (route === '/personel' && method === 'GET') {
      try {
        const db = await getDb()
        const search = url.searchParams.get('search') || ''
        let rows = await db.collection('personel').find({}).toArray()
        if (search) {
          const s = search.toLowerCase()
          rows = rows.filter((r) => (r.nama_lengkap || '').toLowerCase().includes(s) || (r.nip || '').toLowerCase().includes(s) || (r.jabatan || '').toLowerCase().includes(s))
        }
        const rank = (j) => {
          const u = (j || '').toUpperCase()
          if (u.startsWith('KASUBBID')) return 1
          if (u.startsWith('KAUR')) return 2
          if (u.startsWith('KANIT')) return 3
          if (u.startsWith('PAMIN')) return 4
          if (u.startsWith('PANIT')) return 5
          if (u.startsWith('PAMA')) return 6
          if (u.includes('ANGGOTA')) return 7
          if (u.startsWith('PNS')) return 8
          return 9
        }
        const rankPangkat = (p) => {
          const u = (p || '').toUpperCase()
          const PANGKAT_ORDER = [
            'KOMBES', 'AKBP', 'KOMPOL', 'AKP',
            'AIPTU', 'IPTU', 'AIPDA', 'IPDA',
            'BRIPKA', 'BRIGADIR', 'BRIPTU', 'BRIPDA',
            'ABRIP', 'BHARATU', 'BHARADA',
            'PNS',
          ]
          const found = PANGKAT_ORDER.findIndex((r) => u === r || u.startsWith(r + ' '))
          return found >= 0 ? found : 99
        }
        rows.sort((a, b) => rank(a.jabatan) - rank(b.jabatan) || rankPangkat(a.pangkat) - rankPangkat(b.pangkat) || (a.nip || '').localeCompare(b.nip || ''))
        return ok({ data: rows.map(({ _id, ...r }) => r) })
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) return ok({ data: [] })
        throw e
      }
    }
    if (route === '/personel' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const body = await request.json()
      if (!body.nama_lengkap) return fail('Nama lengkap wajib')
      const db = await getDb()
      const doc = {
        id: body.id || uuidv4(),
        tenant_id: body.tenant_id || null,
        organization_id: body.organization_id || null,
        role: body.role || '',
        nip: body.nip || '',
        nama_lengkap: body.nama_lengkap,
        pangkat: body.pangkat || '',
        jabatan: body.jabatan || '',
        kesatuan: body.kesatuan || '',
        tim: body.tim || '',
        unit: body.unit || '',
        nomor_wa: body.nomor_wa || '',
        ketua_tim: !!body.ketua_tim,
        created_at: new Date(),
        updated_at: new Date(),
      }
      await db.collection('personel').insertOne(doc)
      await logAudit(me, 'personel_create', doc.id, { nama: doc.nama_lengkap })
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    {
      const m = route.match(/^\/personel\/([^/]+)$/)
      if (m && method === 'PUT') {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const patch = await request.json()
        if (patch.ketua_tim !== undefined) patch.ketua_tim = !!patch.ketua_tim
        const db = await getDb()
        await db.collection('personel').updateOne({ id }, { $set: { ...patch, updated_at: new Date() } })
        const row = await db.collection('personel').findOne({ id })
        if (!row) return fail('Personel tidak ditemukan', 404)
        await logAudit(me, 'personel_update', id, patch)
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
      if (m && method === 'DELETE') {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        const id = m[1]
        const db = await getDb()
        await db.collection('personel').deleteOne({ id })
        await logAudit(me, 'personel_delete', id)
        return ok({})
      }
    }

    // ---------- LOCAL CASES (non-Gajamada: ASTINA/manual) ----------
    if (route === '/local-cases' && method === 'GET') {
      try {
        const db = await getDb()
        const source = url.searchParams.get('source') || undefined
        const caseType = url.searchParams.get('case_type') || undefined
        const search = url.searchParams.get('search') || ''
        let q = db.collection('local_cases').find({})
        if (source) q = db.collection('local_cases').find({ source })
        if (caseType) q = db.collection('local_cases').find({ case_type: { $in: [caseType, caseType === 'non_dumas' ? 'non_pengaduan' : null].filter(Boolean) } })
        let rows = await q.sort({ created_at: -1 }).toArray()
        if (search) {
          const s = search.toLowerCase()
          rows = rows.filter((r) => (r.pengirim || '').toLowerCase().includes(s) || (r.perihal || '').toLowerCase().includes(s) || (r.prepator_name || '').toLowerCase().includes(s))
        }
        return ok({ data: rows.map(({ _id, ...r }) => r) })
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) return ok({ data: [] })
        throw e
      }
    }
    if (route === '/local-cases' && method === 'POST') {
      const body = await request.json()
      if (!body.perihal && !body.pengirim) return fail('Perihal atau pengirim wajib')
      const db = await getDb()
      const now = new Date()
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const existCount = await db.collection('local_cases').countDocuments({ source: body.source || 'manual' })
      const pid = body.prepator_id || `SIM-${now.getFullYear()}${month}${day}-${String(existCount + 1).padStart(5, '0')}`
      const doc = {
        id: uuidv4(),
        prepetrator_id: pid,
        source: body.source || 'manual',
        case_type: body.case_type || 'pengaduan',
        perihal: body.perihal || '',
        nomor_surat: body.nomor_surat || '',
        tgl_surat: body.tgl_surat ? new Date(body.tgl_surat) : null,
        jenis_surat: body.jenis_surat || '',
        pengirim: body.pengirim || '',
        reporter_nik: body.reporter_nik || '',
        phone_no: body.phone_no || '',
        email: body.email || '',
        prepetrator_name: body.prepator_name || '',
        summary: body.summary || '',
        content: body.content || '',
        category: body.category || '',
        status: 'Laporan Diterima',
        source_alias: body.source_alias || (body.source === 'astina' ? 'ASTINA' : 'Manual'),
        pdf_url: body.pdf_url || '',
        raw_data: body.raw_data || {},
        created_at: now,
        updated_at: now,
      }
      await db.collection('local_cases').insertOne(doc)
      await logAudit(me, 'local_case_create', doc.id, { pid, source: body.source })
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    {
      const m = route.match(/^\/local-cases\/([^/]+)$/)
      if (m && method === 'PUT') {
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        await db.collection('local_cases').updateOne({ id }, { $set: { ...patch, updated_at: new Date() } })
        const row = await db.collection('local_cases').findOne({ id })
        if (!row) return fail('Kasus tidak ditemukan', 404)
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
    }

    // ---------- HAR IMPORT + AI EXTRACT ----------
    if (route === '/har-import' && method === 'POST') {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file) return fail('File HAR wajib')
      const harText = await file.text()
      let har
      try { har = JSON.parse(harText) } catch (_) { return fail('File HAR tidak valid') }
      const entries = (har.log?.entries || []).filter((e) => {
        const url = e.request?.url || ''
        return url.includes('astina.polri.go.id') && !/\.(js|css|png|jpg|svg|woff|ico|map|gif)$/.test(url)
      })
      // Extract PDF from response bodies
      const pdfs = []
      for (const entry of entries) {
        const content = entry.response?.content
        if (!content || !content.mimeType || !content.mimeType.includes('pdf')) continue
        const text = content.text || ''
        if (text.length < 100) continue
        const isBase64 = content.encoding === 'base64'
        pdfs.push({
          url: entry.request?.url || '',
          mimeType: content.mimeType,
          size: content.size || text.length,
          isBase64,
          text: isBase64 ? text.substring(0, 200) + '...[base64]' : text.substring(0, 500),
        })
      }
      return ok({ data: { total_entries: entries.length, pdfs_found: pdfs.length, pdfs } })
    }

    // AI extract PDF content
    if (route === '/har-import/extract' && method === 'POST') {
      const { pdf_url, pdf_base64 } = await request.json()
      if (!pdf_base64) return fail('pdf_base64 required')
      const apiKey = process.env.OPENCODE_API_KEY
      const baseUrl = process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai'
      if (!apiKey) return fail('OpenCode API key not configured')
      try {
        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'opencode-vision',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Ekstrak data berikut dari surat/dokumen ini dalam format JSON. Hanya kembalikan JSON, tanpa teks lain:\n{\n  "perihal": "...",\n  "pengirim": "...",\n  "nomor_surat": "...",\n  "tanggal_surat": "...",\n  "isi_ringkas": "..."\n}\nJika tidak ada, isi dengan string kosong.' },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdf_base64}` } }
              ]
            }],
            max_tokens: 1000,
          }),
        })
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content || ''
        let extracted = {}
        try { extracted = JSON.parse(text.replace(/```json\n?|```/g, '').trim()) } catch (_) { extracted = { perihal: text.substring(0, 200), pengirim: '', nomor_surat: '', tanggal_surat: '', isi_ringkas: '' } }
        return ok({ data: extracted })
      } catch (e) { return fail('AI extraction failed: ' + e.message) }
    }

    // ---------- NON-DUMAS (surat dinas) ----------
    if (route === '/non-dumas' && method === 'GET') {
      try {
        const db = await getDb()
        const rows = await db.collection('surat_non_dumas').find({}).sort({ created_at: -1 }).toArray()
        return ok({ data: rows.map(({ _id, ...r }) => r) })
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) return ok({ data: [] })
        throw e
      }
    }
    if (route === '/non-dumas' && method === 'POST') {
      const { letter_id, tgl_tindak_lanjut, nomor, jenis_surat, keterangan, status } = await request.json()
      const db = await getDb()
      const doc = {
        id: uuidv4(),
        letter_id: letter_id || null,
        tgl_tindak_lanjut: tgl_tindak_lanjut ? new Date(tgl_tindak_lanjut) : null,
        nomor: nomor || '',
        jenis_surat: jenis_surat || '',
        keterangan: keterangan || '',
        status: status || 'Diterima',
        created_at: new Date(),
        updated_at: new Date(),
      }
      await db.collection('surat_non_dumas').insertOne(doc)
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    {
      const m = route.match(/^\/non-dumas\/([^/]+)$/)
      if (m && method === 'PUT') {
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        await db.collection('surat_non_dumas').updateOne({ id }, { $set: { ...patch, updated_at: new Date() } })
        const row = await db.collection('surat_non_dumas').findOne({ id })
        if (!row) return fail('Tidak ditemukan', 404)
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
    }

    // ---------- UNIT MAPPING ----------
    if (route === '/unit-mapping' && method === 'GET') {
      try {
        const db = await getDb()
        const rows = await db.collection('unit_mapping').find({}).sort({ external_name: 1 }).toArray()
        return ok({ data: rows.map(({ _id, ...r }) => r) })
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) return ok({ data: [] })
        throw e
      }
    }
    if (route === '/unit-mapping' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const { external_name, internal_unit } = await request.json()
      if (!external_name || !internal_unit) return fail('Nama eksternal dan internal wajib')
      const db = await getDb()
      const doc = { id: uuidv4(), external_name, internal_unit, created_at: new Date(), updated_at: new Date() }
      await db.collection('unit_mapping').insertOne(doc)
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    {
      const m = route.match(/^\/unit-mapping\/([^/]+)$/)
      if (m && method === 'DELETE') {
        if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
        await (await getDb()).collection('unit_mapping').deleteOne({ id: m[1] })
        return ok({})
      }
    }

    // ---------- ASTINA FETCH ----------
    if (route === '/astina-fetch' && method === 'GET') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      try {
        const { getSuratBaru } = require('../../../lib/astina-client')
        const data = await getSuratBaru()
        return ok(data)
      } catch (e) {
        return fail('Gagal fetch ASTINA: ' + (e.message || 'unknown'))
      }
    }

    // ---------- ASTINA SET COOKIE ----------
    if (route === '/astina-cookie' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      const { cookie } = await request.json()
      if (!cookie) return fail('Cookie wajib')
      process.env.ASTINA_COOKIE = cookie
      return ok({ message: 'Cookie disimpan' })
    }

    // ---------- ASTINA REFRESH COOKIE (auto-login) ----------
    if (route === '/astina-refresh-cookie' && method === 'POST') {
      if (!(me.role === 'kasubbid' || me.role === 'admin')) return fail('Hanya Kasubbid/Admin', 403)
      try {
        const { refreshAstinaCookie } = require('../../../lib/astina-auth')
        const result = await refreshAstinaCookie()
        return ok(result)
      } catch (e) {
        return fail('Gagal refresh cookie ASTINA: ' + (e.message || 'unknown'))
      }
    }

    return fail(`Route ${route} not found`, 404)
  } catch (err) {
    console.error('API error', err)
    return fail(err.message || 'Internal error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
export async function OPTIONS() { return new NextResponse(null, { status: 200 }) }

// Auto-refresh ASTINA cookie on startup and every 2 hours
if (typeof globalThis !== 'undefined' && !globalThis.__astinaRefreshScheduled && process.env.ASTINA_USERNAME) {
  globalThis.__astinaRefreshScheduled = true
  const REFRESH_MS = 2 * 60 * 60 * 1000
  const doRefresh = async () => {
    try {
      const { refreshAstinaCookie } = require('../../../lib/astina-auth')
      const result = await refreshAstinaCookie()
      if (result.ok) console.log('[ASTINA] Auto-refresh cookie OK')
      else console.log('[ASTINA] Auto-refresh cookie FAILED:', result.error)
    } catch (e) { console.log('[ASTINA] Auto-refresh error:', e.message) }
  }
  // First refresh after 10s (let server stabilize)
  setTimeout(doRefresh, 10000)
  setInterval(doRefresh, REFRESH_MS)
}
