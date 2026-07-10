import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import * as gajamada from '@/lib/gajamada'
import { getDb, getActiveUnits, getKasubbidName, getKasubbidAliases, getPolresUnits, getAllActiveUnitNames } from '@/lib/db'
import { authenticate, signSession, getCookieHeader, clearCookieHeader, getUserFromRequest, isDisposisiRole, isAdminRole, isKasubbidRole, isUnitRole, setDbUsers, getAllUsers } from '@/lib/auth'
import { CATEGORY_OPTIONS, FILTER_UNITS } from '@/lib/units'
import { simplifyStatus, simplifyUnit } from '@/lib/mapping'
import { STAGE_LABELS, NON_DUMAS_STAGE_LABELS, HASIL_LIDIK_OPTIONS, SETTLEMENT_OPTIONS, computeChecklist, getStageOrder, getStageLabels, MINI_CHECKLIST, UNIT_DOC_TYPES, UNIT_DEFAULT_TASKS, getUnitType, getCaseTypeForUnit } from '@/lib/checklist'
import { STATUS, RESOLUSI, BUCKET, getBucket, canTransition, canResolve } from '@/lib/status'

// Default disposisi task templates
const DEFAULT_DISPOSISI_TASKS = ['LIDIK/PULBAKET', 'GELARKAN', 'SP2HP2', 'LAPORKAN HASILNYA']
const NON_DUMAS_DISPOSISI_TASKS = ['TINDAKLANJUTI', 'CATAT/DATAKAN/FILE', 'UDK', 'TUNTASKAN']

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

// Merge internal state into a Gajamada case object
async function enrichCase(caseObj) {
  if (!caseObj) return null
  const db = await getDb()
  const pid = caseObj.prepetrator_id
  const [dispositions, timelines, statusHistory, syncLogs, completed, checklistRows, outcome, localCase, saranYanduan] = await Promise.all([
    db.collection('dispositions').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray(),
    db.collection('timelines').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray(),
    db.collection('status_history').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray(),
    db.collection('sync_logs').find({ prepetrator_id: pid }).sort({ request_at: -1 }).limit(10).toArray(),
    db.collection('completions').findOne({ prepetrator_id: pid }),
    db.collection('followup_checklist').find({ prepetrator_id: pid }).toArray(),
    db.collection('case_outcomes').findOne({ prepetrator_id: pid }),
    db.collection('local_cases').findOne({ prepetrator_id: pid }),
    db.collection('saran_yanduan').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } }),
  ])
  const strip = (arr) => arr.map(({ _id, ...rest }) => rest)
  const latestDisp = dispositions[0]
  const status = localCase?.status || STATUS.SURAT_MASUK_POLDA_JABAR
  const resolusi = localCase?.resolusi || null
  const _sync_status = (() => {
    const last = syncLogs[0]
    if (!last) return 'unknown'
    return last.status === 'success' ? 'synced' : 'pending'
  })()
  const cleanOutcome = outcome ? { ...outcome, _id: undefined } : null
  const checklist = computeChecklist(cleanOutcome, strip(checklistRows))
  return {
    ...caseObj,
    summary: caseObj.perihal || caseObj.summary || (caseObj.content ? String(caseObj.content).slice(0, 200) : ''),
    disposisi_case_position: caseObj.disposisi_case_position,
    status,
    resolusi,
    bucket: getBucket(status),
    is_atensi: !!latestDisp?.is_atensi,
    _saran_yanduan: saranYanduan ? { ...saranYanduan, _id: undefined } : null,
    _sync_status,
    _internal: {
      dispositions: strip(dispositions),
      timelines: strip(timelines),
      status_history: strip(statusHistory),
      sync_logs: strip(syncLogs),
      completed: completed ? { ...completed, _id: undefined } : null,
      outcome: cleanOutcome,
      checklist,
    },
  }
}

// Fire-and-forget background sync to Gajamada
async function backgroundSync(pid, actor, reason) {
  let db
  try { db = await getDb() } catch (e) { console.error('backgroundSync getDb failed', pid, e.message); return }
  const syncLog = {
    id: uuidv4(), prepetrator_id: pid, payload: null, status: 'pending',
    request_at: new Date(), reason, by: { username: actor?.username, role: actor?.role },
  }
  try {
    const original = await gajamada.getCase(pid)
    if (!original) { syncLog.status = 'skipped'; syncLog.error = 'getCase returned null'; syncLog.completed_at = new Date(); await db.collection('sync_logs').insertOne(syncLog); return }
    const latestDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
    const localCase = await db.collection('local_cases').findOne({ prepetrator_id: pid })
    const timelines = await db.collection('timelines').find({ prepetrator_id: pid }).sort({ created_at: -1 }).limit(5).toArray()
    const status = localCase?.status || STATUS.SURAT_MASUK_POLDA_JABAR
    const combinedNote = [
      latestDisp?.note ? latestDisp.note.replace(/^TASKS:\s*[^\n]*\n?/gm, '').trim() : '',
      ...timelines.slice(0, 3).map((t) => (t.description || '').replace(/^TASKS:\s*[^\n]*\n?/gm, '').trim()),
    ].filter(Boolean).join('; ')

    // Resolve case_position: internal unit → Gajamada unit name via unit_mapping
    // For Polres units: always map to "Kasipropam Polres xxxx Polda Jabar"
    const internalUnit = latestDisp?.to_unit || ''
    let casePosition = original.disposisi_case_position || ''
    if (internalUnit) {
      const mappings = await db.collection('unit_mapping').find({ internal_unit: internalUnit }).toArray()
      if (mappings.length > 0) {
        const kasipropam = mappings.find((m) => m.external_name.toUpperCase().includes('KASIPROPAM'))
        casePosition = kasipropam?.external_name || mappings[0].external_name
      }
    }
    const params = {
      report_id: pid,
      status: toGajamadaStatus(status),
      case_position: casePosition,
      note: combinedNote || 'Disposisi oleh ' + (actor?.name || 'SIMONDU'),
      createdBy: actor?.name || 'SIMONDU',
    }
    syncLog.payload = params
    try {
      const { status, body } = await gajamada.pushUpdate(params)
      syncLog.response = body; syncLog.http_status = status
      syncLog.status = (status >= 200 && status < 300 && body?.metaData?.status !== false) ? 'success' : 'failed'
    } catch (e) {
      syncLog.error = e.message; syncLog.status = 'failed'
    }
    syncLog.completed_at = new Date()
    await db.collection('sync_logs').insertOne(syncLog)
  } catch (e) {
    syncLog.status = 'failed'; syncLog.error = e.message; syncLog.completed_at = new Date()
    await db.collection('sync_logs').insertOne(syncLog).catch(() => {})
    console.error('backgroundSync error', pid, e.message, e.stack?.slice(0, 200))
  }
}
function scheduleSync(pid, actor, reason) {
  // Fire-and-forget (do not await)
  setTimeout(() => { backgroundSync(pid, actor, reason).catch((e) => console.error('scheduleSync fatal', pid, e.message)) }, 100)
}

// Derive internal STATUS from Gajamada status label + activity flags.
// Used by /anev dashboard to bucket cases into the new 3-bucket model.
function deriveStatus(statusLabel, { hasDisposisi, hasTimeline, isCompleted }) {
  const label = (statusLabel || '').toLowerCase()

  // Completed cases — always SELESAI regardless of label
  if (isCompleted) return STATUS.SELESAI

  // Gajamada says it's done
  if (label.includes('selesai') || label.includes('terbukti') || label.includes('tidak terbukti')
      || label.includes('perdamaian') || label.includes('restorative') || label.includes('pencabutan')
      || label.includes('tolak') || label.includes('henti')) {
    return STATUS.SELESAI
  }

  // Sidang / Putusan
  if (label.includes('putusan sidang') || label.includes('sidang')) {
    return STATUS.SIDANG_DISIPLIN
  }

  // Unit-specific receipt — Paminal
  if (label.includes('paminal')) {
    return STATUS.PENYELIDIKAN_PAMINAL
  }

  // Unit-specific receipt — Provos
  if (label.includes('provos')) {
    return STATUS.PENYELIDIKAN_PROVOS
  }

  // Unit-specific receipt — Wabprof / Yanduan / Wassidik (internal Polda Jabar)
  if (label.includes('wabprof') || label.includes('yanduan') || label.includes('wassidik')) {
    return STATUS.DISPOSISI_PIMPINAN
  }

  // Sent to Polres (distribution to child unit)
  if (label.includes('dikirim ke polres') || label.includes('polres')) {
    return STATUS.DISPOSISI_PIMPINAN
  }

  // Gajamada says it's in disposisi/pimpinan stage
  if (label.includes('didistribusi') || label.includes('distribusi') || label.includes('disposisi')) {
    return STATUS.DISPOSISI_PIMPINAN
  }

  // Activity-based fallback for in-progress cases
  if (hasTimeline || hasDisposisi) {
    if (label.includes('limpa')) return STATUS.LIMPAH_PAMINAL_PROVOS
    return STATUS.PENYELIDIKAN_PAMINAL
  }

  // Incoming / received (no activity yet)
  if (label.includes('dikirim') || label.includes('diterima')) {
    return STATUS.SURAT_MASUK_POLDA_JABAR
  }

  // Default — no activity yet
  return STATUS.SURAT_MASUK_POLDA_JABAR
}

// One-time idempotent migration: assign new STATUS values to local_cases
// that are still on the old status model (status null/empty/missing).
// Decision tree (first match wins):
//   - has completions row       -> STATUS.SELESAI
//   - has timelines row         -> STATUS.PENYELIDIKAN_PAMINAL
//   - has dispositions row      -> STATUS.PENYELIDIKAN_PAMINAL
//   - otherwise                 -> STATUS.SURAT_MASUK_POLDA_JABAR
// Idempotent: re-runs are no-ops because the update filter only matches
// rows whose status is still null/empty/missing.
async function migrateLocalCasesStatus() {
  const startedAt = new Date()
  const result = { startedAt, migrated: 0, skipped: 0, broken: 0, log: [] }
  const STATUS_MISSING = { $or: [{ status: { $exists: false } }, { status: null }, { status: '' }] }
  try {
    const db = await getDb()
    const targets = await db.collection('local_cases').find(STATUS_MISSING).toArray()
    console.log(`[migrate-local-cases] found ${targets.length} local_cases without status`)
    if (targets.length === 0) return result
    for (const lc of targets) {
      const pid = lc.prepetrator_id
      if (!pid) { result.broken++; result.log.push({ id: lc.id || null, reason: 'missing prepetrator_id' }); continue }
      try {
        const [completion, hasTimeline, hasDisposisi] = await Promise.all([
          db.collection('completions').findOne({ prepetrator_id: pid }, { projection: { _id: 1 } }),
          db.collection('timelines').findOne({ prepetrator_id: pid }, { projection: { _id: 1 } }),
          db.collection('dispositions').findOne({ prepetrator_id: pid }, { projection: { _id: 1 } }),
        ])
        let newStatus, reason
        if (completion) { newStatus = STATUS.SELESAI; reason = 'has_completion' }
        else if (hasTimeline) { newStatus = STATUS.PENYELIDIKAN_PAMINAL; reason = 'has_timeline' }
        else if (hasDisposisi) { newStatus = STATUS.PENYELIDIKAN_PAMINAL; reason = 'has_disposisi' }
        else { newStatus = STATUS.SURAT_MASUK_POLDA_JABAR; reason = 'no_activity' }
        const upd = await db.collection('local_cases').updateOne(
          { id: lc.id, ...STATUS_MISSING },
          { $set: { status: newStatus, migrated_at: startedAt, migration_reason: reason } }
        )
        if (upd.matchedCount === 0) { result.skipped++; result.log.push({ id: lc.id, pid, reason: 'race_status_already_set' }); continue }
        result.migrated++
        result.log.push({ id: lc.id, pid, newStatus, reason })
      } catch (e) {
        result.broken++
        result.log.push({ id: lc.id || null, pid, error: e.message })
        console.error('[migrate-local-cases] row error', lc.id, e.message)
      }
    }
    console.log(`[migrate-local-cases] done. migrated=${result.migrated} skipped=${result.skipped} broken=${result.broken}`)
  } catch (e) {
    console.error('[migrate-local-cases] fatal', e.message)
    result.fatal = e.message
  }
  result.completedAt = new Date()
  return result
}

async function handleRoute(request, ctx) {
  const params = await ctx.params
  const path = params?.path || []
  const route = '/' + path.join('/')
  const method = request.method
  const url = new URL(request.url)

  // Module-level cache for all unit names from Gajamada cases
  if (!handleRoute._allPositions) { handleRoute._allPositions = null; handleRoute._allPositionsTime = 0 }
  const POSITIONS_CACHE_TTL = 60000

  const UNIT_FILTER_PATTERNS = {
    'KABID PROPAM': ['KABID PROPAM'],
    'SUBBAG YANDUAN': ['SUBBAG YANDUAN', 'OPERATOR YANDUAN', 'OPERATOR SUBBAG YANDUAN', 'KASUBBAG YANDUAN'],
    'SUBBID PAMINAL': ['SUBBID PAMINAL', 'KASUBBID PAMINAL', 'UNIT 1 PAMINAL', 'UNIT 2 PAMINAL', 'UNIT 3 PAMINAL', 'UR PRODOK PAMINAL', 'UR BINPAM PAMINAL', 'UR LITPERS PAMINAL', 'KAUR PRODOK', 'KAUR LITPERS', 'KAUR BINPAM'],
    'SUBBID PROVOS': ['SUBBID PROVOS', 'KASUBBID PROVOS', 'UNIT PROVOS'],
    'SUBBID WABPROF': ['SUBBID WABPROF', 'KASUBBID WABPROF', 'UNIT WABPROF'],
    'SUBBAG REHABPERS': ['REHABPERS'],
    'WASSIDIK': ['WASSIDIK'],
    'SAT BRIMOB': ['BRIMOB'],
    'POLRES': ['POLRES', 'POLRESTA', 'POLRESTABES', 'KASIPROPAM', 'KAUR', 'KANIT']
  }

  async function getAllPositions() {
    if (handleRoute._allPositions && Date.now() - handleRoute._allPositionsTime < POSITIONS_CACHE_TTL) return handleRoute._allPositions
    const cases = await gajamada.listCases({ size: 500 }).catch(() => ({ data: [] }))
    handleRoute._allPositions = [...new Set((cases.data || []).map((c) => c.disposisi_case_position).filter(Boolean))].sort()
    handleRoute._allPositionsTime = Date.now()
    return handleRoute._allPositions
  }

  function resolveUnitFilter(filterValue, allPositions) {
    const up = (s) => (s || '').toUpperCase()
    if (filterValue === 'SATKER LAIN') {
      const allPatterns = Object.entries(UNIT_FILTER_PATTERNS)
        .filter(([k]) => k !== 'SATKER LAIN')
        .flatMap(([, patterns]) => patterns)
      const matched = new Set(allPositions.filter((pos) => allPatterns.some((p) => up(pos).includes(up(p)))))
      return allPositions.filter((pos) => !matched.has(pos))
    }
    const patterns = UNIT_FILTER_PATTERNS[filterValue]
    if (!patterns) return [filterValue]
    const matches = allPositions.filter((pos) => patterns.some((p) => up(pos).includes(up(p))))
    return matches.length > 0 ? matches : [filterValue]
  }

  if (!handleRoute._unitListCache) { handleRoute._unitListCache = null; handleRoute._unitListCacheTime = 0 }
  const UNIT_LIST_CACHE_TTL = 60000

  async function loadUnitList() {
    if (handleRoute._unitListCache && Date.now() - handleRoute._unitListCacheTime < UNIT_LIST_CACHE_TTL) return handleRoute._unitListCache
    const db = await getDb()
    const rows = await db.collection('unit_mapping').find({}).toArray()
    handleRoute._unitListCache = [...new Set(rows.map((r) => r.internal_unit).filter(Boolean))]
    handleRoute._unitListCacheTime = Date.now()
    return handleRoute._unitListCache
  }

  const SIMPLIFIED_STATUSES = ['DITERIMA', 'DALAM PROSES', 'PROSES SIDANG', 'TERBUKTI', 'TIDAK TERBUKTI', 'PERDAMAIAN']
  const STATUS_MAPPING = {
    DITERIMA: ['Laporan Diterima', 'Diterima', 'Laporan Dikirim ke Polda', 'Laporan Diterima Polda'],
    'DALAM PROSES': ['Didistribusi', 'Proses Lidik', 'Distribusi', 'Lidik', 'Laporan Diterima Kasubbid Paminal', 'Laporan Diterima Kasubbid Provos', 'Laporan Diterima Kasubbid Wabprof', 'Laporan Dikirim ke Polres'],
    'PROSES SIDANG': ['PUTUSAN SIDANG', 'Sidang', 'Sidang Disiplin', 'Sidang KKE'],
    TERBUKTI: ['Selesai', 'Terbukti'],
    'TIDAK TERBUKTI': ['Tidak Terbukti', 'Henti Lidik', 'Tolak', 'Laporan Ditolak Polda', 'Laporan ditolak', 'Pencabutan', 'HENTI LIDIK SEBELUM TERBIT SPRIN'],
    PERDAMAIAN: ['Perdamaian', 'Restorative Justice', 'Restorative', 'Laporan Selesai Restorative Justice', 'Selesai Restorative Justice'],
  }

  function resolveGajamadaStatuses(simplifiedStatus) {
    return STATUS_MAPPING[simplifiedStatus] || [simplifiedStatus]
  }

  // Mapping from internal STATUS constants to arrays of Gajamada status labels for list filtering.
  const GAJAMADA_STATUS_MAP = {
    [STATUS.SURAT_MASUK_POLDA_JABAR]: ['Laporan Diterima', 'Diterima', 'Laporan Dikirim ke Polda', 'Laporan Diterima Polda'],
    [STATUS.DISPOSISI_PIMPINAN]: ['Didistribusi', 'Distribusi', 'Lidik', 'Laporan Dikirim ke Polres'],
    [STATUS.PENYELIDIKAN_PAMINAL]: ['Proses Lidik', 'Laporan Diterima Kasubbid Paminal'],
    [STATUS.PENYELIDIKAN_PROVOS]: ['Laporan Diterima Kasubbid Provos'],
    [STATUS.PEMERIKSAAN_GARPLIN]: [],
    [STATUS.PEMERIKSAAN_GAR_KEPP]: [],
    [STATUS.SIDANG_DISIPLIN]: ['PUTUSAN SIDANG'],
    [STATUS.SIDANG_KKE]: [],
    [STATUS.LIMPAH_PAMINAL_PROVOS]: ['Didistribusi'],
    [STATUS.PUTUSAN_SIDANG]: [],
    [STATUS.SELESAI]: ['Selesai', 'Terbukti', 'Tidak Terbukti', 'Perdamaian', 'Restorative Justice', 'Henti Lidik', 'Tolak', 'Laporan Ditolak Polda', 'Laporan ditolak', 'Pencabutan', 'HENTI LIDIK SEBELUM TERBIT SPRIN'],
  }
  const ALL_GAJAMADA_STATUSES = Object.values(GAJAMADA_STATUS_MAP).flat()

  // Map internal STATUS constants back to a single Gajamada-compatible status string.
  // Gajamada only understands its own labels, so we translate on push.
  function toGajamadaStatus(internalStatus) {
    switch (internalStatus) {
      case STATUS.SURAT_MASUK_POLDA_JABAR: return 'Laporan Diterima Polda'
      case STATUS.DISPOSISI_PIMPINAN: return 'Didistribusi'
      case STATUS.PENYELIDIKAN_PAMINAL: return 'Laporan Diterima Kasubbid Paminal'
      case STATUS.PENYELIDIKAN_PROVOS: return 'Laporan Diterima Kasubbid Provos'
      case STATUS.SIDANG_DISIPLIN: return 'PUTUSAN SIDANG'
      case STATUS.LIMPAH_PAMINAL_PROVOS: return 'Didistribusi'
      case STATUS.SELESAI: return 'Selesai'
      default: return internalStatus || 'Laporan Diterima Polda'
    }
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

    // Lazy-load users from DB (once per process)
    if (!handleRoute._usersLoaded) {
      try {
        const db = await getDb()
        const rows = await db.collection('users').find({}).toArray()
        if (rows.length > 0) setDbUsers(rows)
      } catch (_) {}
      handleRoute._usersLoaded = true
    }

    // ---------- REFERENCE ----------
    if (route === '/reference' && method === 'GET') {
      const [dynamicUnits, db, gajamadaStatuses, nonPaminal, polresUnits, allActiveUnits] = await Promise.all([
        getActiveUnits(),
        getDb(),
        gajamada.getStatuses().catch(() => []),
        getAllPositions(),
        getPolresUnits(),
        getAllActiveUnitNames(),
      ])
      const satkerRows = await db.collection('satker_satwil').find({}).sort({ order: 1, name: 1 }).toArray()
      const allStatuses = SIMPLIFIED_STATUSES
      const groups = { YANDUAN: false, WASSIDIK: false, POLRES_TA_TABES: false, PROVOS: false, WABPROF: false, PAMINAL: false }
      for (const u of nonPaminal) {
        const up = u.toUpperCase()
        if (up.includes('YANDUAN')) groups.YANDUAN = true
        else if (up.includes('WASSIDIK')) groups.WASSIDIK = true
        else if (up.includes('POLRES')) groups.POLRES_TA_TABES = true
        else if (up.includes('PROVOS')) groups.PROVOS = true
        else if (up.includes('WABPROF')) groups.WABPROF = true
      }
      for (const u of allActiveUnits) {
        const up = u.toUpperCase()
        if (up.includes('PAMINAL')) groups.PAMINAL = true
      }
      const gajamadaSatker = [
        ...(groups.YANDUAN ? ['YANDUAN'] : ['YANDUAN']),
        ...(groups.WASSIDIK ? ['WASSIDIK'] : ['WASSIDIK']),
        ...(groups.POLRES_TA_TABES ? ['POLRES/TA/TABES'] : ['POLRES/TA/TABES']),
        ...(groups.PROVOS ? ['KASUBBID PROVOS POLDA JAWA BARAT'] : ['KASUBBID PROVOS POLDA JAWA BARAT']),
        ...(groups.WABPROF ? ['KASUBBID WABPROF POLDA JAWA BARAT'] : ['KASUBBID WABPROF POLDA JAWA BARAT']),
        ...(groups.PAMINAL ? ['KASUBBID PAMINAL POLDA JAWA BARAT'] : ['KASUBBID PAMINAL POLDA JAWA BARAT']),
      ]
      const kasubbid = await getKasubbidName()
      const childUnits = await loadUnitList()
      const db2 = await getDb()
      const simonduUnits = await db2.collection('units_master').find({ active: true }).sort({ order: 1, name: 1 }).toArray()
      const unitMappings = await db2.collection('unit_mapping').find({}).toArray()
      return ok({
        units: dynamicUnits.length ? dynamicUnits : childUnits,
        kasubbid,
        paminalScope: [kasubbid, ...(dynamicUnits.length ? dynamicUnits : childUnits)].filter(Boolean),
        statuses: allStatuses,
        categories: CATEGORY_OPTIONS,
        default_disposisi_tasks: DEFAULT_DISPOSISI_TASKS,
        non_dumas_disposisi_tasks: NON_DUMAS_DISPOSISI_TASKS,
        unit_default_tasks: UNIT_DEFAULT_TASKS,
        stage_labels: STAGE_LABELS,
        non_dumas_stage_labels: NON_DUMAS_STAGE_LABELS,
        hasil_lidik_options: HASIL_LIDIK_OPTIONS,
        settlement_options: SETTLEMENT_OPTIONS,
        satker_satwil: satkerRows.map(({ _id, ...r }) => r),
        gajamada_satker: gajamadaSatker,
        all_satker_units: nonPaminal,
        filter_units: FILTER_UNITS,
        polres_units: polresUnits,
        all_active_units: allActiveUnits,
        simondu_units: simonduUnits.map(({ _id, ...r }) => r),
        unit_mappings: unitMappings.map(({ _id, ...r }) => r),
      })
    }

    // ---------- UNITS MASTER (CRUD) ----------
    if (route === '/units-master' && method === 'GET') {
      const db = await getDb()
      const rows = await db.collection('units_master').find({}).sort({ order: 1, name: 1 }).toArray()
      return ok({ data: rows.map(({ _id, ...r }) => r) })
    }
    if (route === '/units-master' && method === 'POST') {
      if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
      const { name, parent, is_kasubbid, order } = await request.json()
      if (!name) return fail('Nama unit wajib')
      const db = await getDb()
      const doc = { id: uuidv4(), name, parent: parent || (await getKasubbidName()), is_kasubbid: !!is_kasubbid, active: true, order: order || 99, created_at: new Date() }
      try { await db.collection('units_master').insertOne(doc) } catch (e) { return fail('Unit dengan nama tersebut sudah ada', 409) }
      await logAudit(me, 'unit_create', doc.id, { name })
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    if (route === '/units-master/reorder' && method === 'PATCH') {
      const { id, order } = await request.json()
      if (!id) return fail('id wajib')
      const db = await getDb()
      const result = await db.collection('units_master').updateOne({ id }, { $set: { order, updated_at: new Date() } })
      if (result.matchedCount === 0) return fail('Unit tidak ditemukan', 404)
      return ok({ success: true })
    }
    if (route === '/units-master/sync-gajamada' && method === 'POST') {
      if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
      const db = await getDb()
      let added = 0, existing = 0, total = 0

      // 1. Internal Polda Jabar units (catalog_unit_v2 + catalog_kesatuan_terlapor)
      const allUnits = await gajamada.getPoldaJabarUnits().catch(() => [])
      for (const u of allUnits) {
        if (!u.name) continue
        total++
        const existingUnit = await db.collection('units_master').findOne({ name: u.name })
        if (existingUnit) { existing++; continue }
        await db.collection('units_master').insertOne({
          id: uuidv4(), name: u.name, parent: u.parent || null,
          is_kasubbid: false, active: true, order: 99, created_at: new Date(), source: u.source || 'gajamada',
        })
        added++
      }

      // 2. Also sync from Gajamada cases (parent-based catalog, backward compat)
      const catalog = await gajamada.getUnitsCatalog(await getKasubbidName()).catch(() => [])
      for (const c of catalog) {
        if (!c.case_position) continue
        total++
        const existingUnit = await db.collection('units_master').findOne({ name: c.case_position })
        if (existingUnit) { existing++; continue }
        await db.collection('units_master').insertOne({
          id: uuidv4(), name: c.case_position, parent: c.case_position_after || (await getKasubbidName()),
          is_kasubbid: false, active: true, order: 99, created_at: new Date(), source: 'gajamada',
        })
        added++
      }

      // 3. Seed essential Polda Jabar units that may not exist in Gajamada catalog
      const ESSENTIAL_UNITS = [
        { name: 'KASUBBID WABPROF POLDA JAWA BARAT', parent: 'BIDPROPAM POLDA JAWA BARAT' },
        { name: 'SUBBAG REHABPERS', parent: 'BIDPROPAM POLDA JAWA BARAT' },
        { name: 'SAT BRIMOB', parent: 'BIDPROPAM POLDA JAWA BARAT' },
        { name: 'WASSIDIK', parent: 'BIDPROPAM POLDA JAWA BARAT' },
      ]
      for (const eu of ESSENTIAL_UNITS) {
        const exists = await db.collection('units_master').findOne({ name: eu.name })
        if (!exists) {
          await db.collection('units_master').insertOne({
            id: uuidv4(), name: eu.name, parent: eu.parent || null,
            is_kasubbid: false, active: true, order: 99, created_at: new Date(), source: 'seed',
          })
          added++
        }
        total++
      }

      await logAudit(me, 'unit_sync_gajamada', 'catalog', { added, existing, total })
      return ok({ added, existing, total })
    }
    {
      const m = route.match(/^\/units-master\/([^/]+)$/)
      if (m && (method === 'PUT' || method === 'PATCH')) {
        if (!isDisposisiRole(me.role) && !isAdminRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
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
        if (!isDisposisiRole(me.role) && !isAdminRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
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
      if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
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
        if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
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
        if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
        const id = m[1]
        const db = await getDb()
        await db.collection('satker_satwil').deleteOne({ id })
        await logAudit(me, 'satker_satwil_delete', id)
        return ok({})
      }
    }

    // ---------- CASES ----------
    async function fetchCasesLocal(u, opts) {
      const db = await getDb()
      let rows = await db.collection('local_cases').find({}).sort({ created_at: -1 }).toArray()
      if (opts.case_type) rows = rows.filter((r) => r.case_type === opts.case_type || (!r.case_type && opts.case_type === 'dumas'))
      if (opts.bucket) {
        const statuses = BUCKET[opts.bucket] || []
        rows = rows.filter((r) => statuses.includes(r.status || STATUS.SURAT_MASUK_POLDA_JABAR))
      }
      if (opts.search) {
        const s = opts.search.toLowerCase()
        rows = rows.filter((r) => (r.pengirim || '').toLowerCase().includes(s) || (r.perihal || '').toLowerCase().includes(s) || (r.prepetrator_name || r.prepator_name || '').toLowerCase().includes(s) || (r.prepetrator_id || r.prepator_id || '').toLowerCase().includes(s))
      }
      if (opts.status) {
        rows = rows.filter((r) => r.status === opts.status)
      }
      if (opts.category) {
        rows = rows.filter((r) => r.category === opts.category)
      }
      // Unit filter based on latest disposition
      if (opts.unit && rows.length > 0) {
        const allPids = [...new Set(rows.map((r) => r.prepator_id || r.prepetrator_id).filter(Boolean))]
        const dispRows = await db.collection('dispositions').find({ prepetrator_id: { $in: allPids } }).sort({ created_at: -1 }).toArray()
        const latestByPid = {}
        for (const d of dispRows) {
          if (!latestByPid[d.prepetrator_id]) latestByPid[d.prepetrator_id] = d
        }
        if (opts.unit === 'POLRES' && opts.polres) {
          rows = rows.filter((r) => {
            const pid = r.prepator_id || r.prepetrator_id
            const d = latestByPid[pid]
            return d && d.to_unit === opts.polres
          })
        } else if (opts.unit === 'KABID PROPAM') {
          rows = rows.filter((r) => r.status === STATUS.DISPOSISI_PIMPINAN)
        } else if (opts.unit === 'SUBBAG YANDUAN') {
          rows = rows.filter((r) => r.status === STATUS.SURAT_MASUK_POLDA_JABAR)
        } else {
          const up = opts.unit.toUpperCase()
          rows = rows.filter((r) => {
            const pid = r.prepator_id || r.prepetrator_id
            const d = latestByPid[pid]
            return d && d.to_unit && d.to_unit.toUpperCase().includes(up)
          })
        }
      }
      const total = rows.length
      const page = opts.page || 1
      const size = opts.size || 20
      const paged = rows.slice((page - 1) * size, page * size)
      // Enrich with disposition info
      const pids = paged.map((r) => r.prepator_id || r.prepetrator_id).filter(Boolean)
      if (pids.length > 0) {
        const [dispRows, syncRows] = await Promise.all([
          db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).sort({ created_at: -1 }).toArray(),
          db.collection('sync_logs').find({ prepetrator_id: { $in: pids } }).sort({ request_at: -1 }).toArray(),
        ])
        const dispBy = {}; const syncByPid = {}
        for (const d of dispRows) if (!dispBy[d.prepetrator_id]) dispBy[d.prepetrator_id] = d
        for (const s of syncRows) if (!syncByPid[s.prepetrator_id]) syncByPid[s.prepetrator_id] = s
        for (const r of paged) {
          const pid = r.prepator_id || r.prepetrator_id
          const d = dispBy[pid]
          const sl = syncByPid[pid]
          r.disposisi_case_position = d?.to_unit || '-'
          r.is_atensi = !!d?.is_atensi
          r._internal_disposisi = !!d
          r.status_label = r.status || STATUS.SURAT_MASUK_POLDA_JABAR
          r.bucket = getBucket(r.status || STATUS.SURAT_MASUK_POLDA_JABAR)
          r._simplified_status = simplifyStatus(r.status_label)
          r._simplified_unit = simplifyUnit(d?.to_unit || '-')
          r._sync_status = sl ? (sl.status === 'success' ? 'synced' : 'pending') : 'unknown'
          r.created_date = r.created_at
          r.pengirim = r.pengirim || '-'
          r.prepetrator_id = pid
          r.prepetrator_name = r.prepator_name || r.prepetrator_name || '-'
          r.perihal = r.perihal || r.summary || ''
          r.summary = r.perihal || r.summary || r.content || ''
          r.category = r.category || 'NON-DUMAS'
          r.source_alias = r.source_alias || r.source || 'LOCAL'
        }
      }
      return { data: paged, total }
    }

    async function fetchCasesForUser(u, opts) {
      if (u.role !== 'kasubbag_yanduan' && u.role !== 'admin' && u.role !== 'super_admin') {
        return fetchCasesLocal(u, opts)
      }
      let units = opts.units
      if (u.role === 'unit') {
        units = [u.unit]
      } else if (opts.unit) {
        if (opts.unit === 'POLRES' && opts.polres) {
          units = [opts.polres]
        } else {
          const db = await getDb()
          const mappings = await db.collection('unit_mapping').find({ internal_unit: opts.unit }).toArray()
          if (mappings.length > 0) {
            units = mappings.map((m) => m.external_name)
          } else {
            const allPositions = await getAllPositions()
            units = resolveUnitFilter(opts.unit, allPositions)
          }
        }
      } else if (!units) {
        units = await getAllPositions()
      }
      const params = { ...opts, units }
      delete params.unit
      delete params.polres
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
      const [dispRows, timelineRows, localCaseRows, syncRows] = await Promise.all([
        db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).sort({ created_at: -1 }).toArray(),
        db.collection('timelines').find({ prepetrator_id: { $in: pids } }).limit(2000).toArray(),
        db.collection('local_cases').find({ prepetrator_id: { $in: pids } }).toArray().catch(() => []),
        db.collection('sync_logs').find({ prepetrator_id: { $in: pids } }).sort({ request_at: -1 }).toArray(),
      ])
      const dispBy = {}; const tlByPid = new Set(); const lcByPid = {}; const syncByPid = {}
      for (const d of dispRows) if (!dispBy[d.prepetrator_id]) dispBy[d.prepetrator_id] = d
      for (const t of timelineRows) tlByPid.add(t.prepetrator_id)
      for (const lc of localCaseRows) if (!lcByPid[lc.prepetrator_id]) lcByPid[lc.prepetrator_id] = lc
      for (const s of syncRows) if (!syncByPid[s.prepetrator_id]) syncByPid[s.prepetrator_id] = s
      const source = r.data.filter((c) => {
        if (opts.case_type) return !lcByPid[c.prepetrator_id]?.case_type || lcByPid[c.prepetrator_id].case_type === opts.case_type
        if (opts.bucket) {
          const status = lcByPid[c.prepetrator_id]?.status || STATUS.SURAT_MASUK_POLDA_JABAR
          return getBucket(status) === opts.bucket
        }
        return true
      })
      const enriched = source.map((c) => {
        const d = dispBy[c.prepetrator_id]
        const lc = lcByPid[c.prepetrator_id]
        const sl = syncByPid[c.prepetrator_id]
        const status = lc?.status || STATUS.SURAT_MASUK_POLDA_JABAR
        const resolusi = lc?.resolusi || null
        const position = d?.to_unit || c.disposisi_case_position
        return {
          ...c,
          disposisi_case_position: position,
          _internal_disposisi: !!d,
          is_atensi: !!d?.is_atensi,
          status,
          resolusi,
          bucket: getBucket(status),
          _simplified_status: simplifyStatus(c.status_label || c.status),
          _simplified_unit: simplifyUnit(position),
          _sync_status: sl ? (sl.status === 'success' ? 'synced' : 'pending') : 'unknown',
        }
      })
      return { data: enriched, total: r.total || enriched.length }
    }

    if (route === '/cases' && method === 'GET') {
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const size = parseInt(url.searchParams.get('size') || '20', 10)
      const search = url.searchParams.get('search') || undefined
      const status = url.searchParams.get('status') || undefined
      const category = url.searchParams.get('category') || undefined
      const unit = url.searchParams.get('unit') || undefined
      const polres = url.searchParams.get('polres') || undefined
      const caseType = url.searchParams.get('case_type') || undefined
      const bucket = url.searchParams.get('bucket') || undefined
      const result = await fetchCasesForUser(me, { page, size, search, status, category, unit: unit || undefined, polres, case_type: caseType, bucket })
      return ok({ ...result, page, size })
    }

    // Disposisi queue: Gajamada cases + local_cases (manual)
    if (route === '/disposisi-queue' && method === 'GET') {
      if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
      const db = await getDb()

      const isYanduan = me.role === 'kasubbag_yanduan'
      const queueUnits = isYanduan
        ? (await getAllPositions()).filter((p) => {
            const up = p.toUpperCase()
            return up.includes('YANDUAN') && !up.includes('POLRES') && !up.includes('POLRESTA') && !up.includes('POLRESTABES')
          })
        : await getKasubbidAliases()

      const r = await gajamada.listCases({ units: queueUnits, size: 100 }).catch(() => ({ data: [] }))
      const pids = r.data.map((c) => c.prepetrator_id)
      const disp = await db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).toArray()
      const dispSet = new Set(disp.map((d) => d.prepetrator_id))
      const gajamadaQueue = r.data.filter((c) => !dispSet.has(c.prepetrator_id)).map((c) => ({
        ...c,
        summary: c.perihal || c.summary || (c.content ? String(c.content).slice(0, 200) : ''),
        _source: 'gajamada',
        source_alias: c.source_alias || 'GAJAMADA',
      }))

      // Local cases (manual) not yet dispositioned
      const localQueue = []
      try {
        const localCases = await db.collection('local_cases').find({ status: STATUS.SURAT_MASUK_POLDA_JABAR }).sort({ created_at: -1 }).limit(50).toArray()
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

      const queue = [...gajamadaQueue, ...localQueue].filter((item) => item.prepetrator_id && (item.perihal || item.prepetrator_name !== '-'))
      return ok({ data: queue, total: queue.length })
    }

// Lightweight count-only endpoint for sidebar notification badge
    if (route === '/disposisi-queue/count' && method === 'GET') {
      if (!isDisposisiRole(me.role)) return ok({ count: 0 })
      const isYanduan = me.role === 'kasubbag_yanduan'
      let count = 0

      const queueUnits = isYanduan
        ? (await getAllPositions()).filter((p) => {
            const up = p.toUpperCase()
            return up.includes('YANDUAN') && !up.includes('POLRES') && !up.includes('POLRESTA') && !up.includes('POLRESTABES')
          })
        : await getKasubbidAliases()

      // Gajamada undisposed
      try {
        const r = await gajamada.listCases({ units: queueUnits, size: 100 }).catch(() => ({ data: [] }))
        const pids = r.data.map((c) => c.prepetrator_id)
        const db = await getDb()
        const disp = await db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).toArray()
        const dispSet = new Set(disp.map((d) => d.prepetrator_id))
        count += r.data.filter((c) => !dispSet.has(c.prepetrator_id)).length
      } catch (_) {}

      // Local cases undisposed
      try {
        const db2 = await getDb()
        const localCases = await db2.collection('local_cases').find({ status: STATUS.SURAT_MASUK_POLDA_JABAR }).toArray()
        const localPids = localCases.map((c) => c.prepetrator_id)
        if (localPids.length) {
          const localDisp = await db2.collection('dispositions').find({ prepetrator_id: { $in: localPids } }).toArray()
          const localDispSet = new Set(localDisp.map((d) => d.prepetrator_id))
          count += localCases.filter((c) => !localDispSet.has(c.prepetrator_id)).length
        }
      } catch (_) {}

      return ok({ count })
    }

    // Bulk disposisi
    if (route === '/disposisi-bulk' && method === 'POST') {
      if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
      const { items, to_unit, note, is_atensi, case_type, tasks } = await request.json()
      if (!Array.isArray(items) || items.length === 0) return fail('items wajib')
      const allUnits = await getAllActiveUnitNames()
      if (!to_unit || !allUnits.includes(to_unit)) return fail('Unit tujuan tidak valid')
      const db = await getDb()
      const results = []
      const unitType = getUnitType(to_unit)
      const autoCaseType = case_type || getCaseTypeForUnit(unitType)
      const fromUnit = me.role === 'kabid_propam' ? 'KABID PROPAM' : 'SUBBAG YANDUAN'
      for (const item of items) {
        const pid = typeof item === 'string' ? item : item.pid
        const itemSource = typeof item === 'string' ? 'gajamada' : (item.source || 'gajamada')
        const exists = await db.collection('dispositions').findOne({ prepetrator_id: pid, to_unit })
        if (exists) { results.push({ pid, status: 'skipped', reason: 'Sudah didisposisi ke unit ini' }); continue }
        const taskLabels = Array.isArray(tasks) ? tasks.filter((t) => t.checked && t.label).map((t) => t.label) : []
        const taskNote = taskLabels.length ? `TASKS: ${taskLabels.join(', ')}\n` : ''
        const disp = {
          id: uuidv4(),
          prepetrator_id: pid,
          to_unit,
          from_unit: fromUnit,
          note: taskNote + (note || ''),
          is_atensi: !!is_atensi,
          by: { username: me.username, name: me.name, role: me.role },
          created_at: new Date(),
          synced_to_gajamada: false,
        }
        await db.collection('dispositions').insertOne(disp)
        try {
          const docTypes = MINI_CHECKLIST
          for (const dt of docTypes) {
            await db.collection('followup_checklist').updateOne(
              { prepetrator_id: pid, document_type: dt.key },
              { $setOnInsert: { prepetrator_id: pid, document_type: dt.key, status: 'pending', note: '', updated_at: new Date().toISOString() }, $set: {} },
              { upsert: true }
            )
          }
        } catch (_) {}
        const newStatus = me.role === 'kabid_propam'
          ? (unitType === 'PAMINAL' || unitType === 'POLRES' ? STATUS.PENYELIDIKAN_PAMINAL : STATUS.PENYELIDIKAN_PROVOS)
          : STATUS.DISPOSISI_PIMPINAN
        try {
          await db.collection('local_cases').updateOne(
            { prepetrator_id: pid },
            { $set: { case_type: autoCaseType, status: newStatus, updated_at: new Date() }, $setOnInsert: { prepetrator_id: pid, source: itemSource, created_at: new Date() } },
            { upsert: true }
          )
        } catch (_) {}
        await db.collection('timelines').insertOne({
          id: uuidv4(), prepetrator_id: pid,
          title: `Didistribusi ke ${to_unit}`,
          description: `${is_atensi ? 'ATENSI - ' : ''}${note || 'Disposisi oleh ' + me.name}`,
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
      if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
      const db = await getDb()
      const dispositions = await db.collection('dispositions').find({}).sort({ created_at: -1 }).limit(200).toArray()
      const pids = [...new Set(dispositions.map((d) => d.prepetrator_id))]
      const caseMap = {}
      if (pids.length > 0) {
        // Gajamada: coba tanpa filter unit dulu (lebih luas)
        const gData = await gajamada.listCases({ size: 200 }).catch(() => ({ data: [] }))
        for (const c of gData.data) caseMap[c.prepetrator_id] = { pengirim: c.pengirim || c.prepetrator_name || '-', perihal: c.perihal || c.summary || '-', nomor_surat: c.nomor_surat || '-' }
        // Fallback: getCase untuk PID yang belum ketemu (Gajamada)
        const missingGj = pids.filter((p) => !caseMap[p] && p.length < 30)
        if (missingGj.length > 0) {
          const results = await Promise.all(missingGj.slice(0, 10).map(async (p) => {
            const c = await gajamada.getCase(p).catch(() => null)
            if (c) caseMap[p] = { pengirim: c.pengirim || c.prepetrator_name || '-', perihal: c.perihal || c.summary || '-', nomor_surat: c.nomor_surat || '-' }
          }))
        }
        // Local cases: batch per 20 untuk hindari limit PostgREST
        for (let i = 0; i < pids.length; i += 20) {
          const batch = pids.slice(i, i + 20)
          const rows = await db.collection('local_cases').find({ prepetrator_id: { $in: batch } }).toArray().catch(() => [])
          for (const l of rows) {
            if (!caseMap[l.prepetrator_id]) caseMap[l.prepetrator_id] = { pengirim: l.pengirim || l.prepetrator_name || '-', perihal: l.perihal || l.summary || '-', nomor_surat: l.nomor_surat || '-' }
          }
        }
      }
      const enriched = dispositions.map((d) => ({
        ...d,
        case_info: caseMap[d.prepetrator_id] || { pengirim: '-', perihal: '-', nomor_surat: '-' },
      }))
      return ok({ data: enriched.map(({ _id, ...r }) => r) })
    }

    // Edit disposisi (ubah unit/catatan/atensi)
    {
      const m = route.match(/^\/dispositions\/([^/]+)$/)
      if (m && (method === 'PUT' || method === 'PATCH')) {
        if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        const existing = await db.collection('dispositions').findOne({ id })
        if (!existing) return fail('Disposisi tidak ditemukan', 404)
        await db.collection('dispositions').updateOne({ id }, { $set: { ...patch } })
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

    // ---------- SARAN YANDUAN ----------
    if (route === '/saran-yanduan' && method === 'POST') {
      if (me.role !== 'kasubbag_yanduan' && me.role !== 'admin' && me.role !== 'super_admin') return fail('Hanya Kasubbag Yanduan', 403)
      const { pid, checklist, catatan, to_unit } = await request.json()
      if (!pid) return fail('pid wajib')
      const db = await getDb()
      const doc = {
        id: uuidv4(), prepetrator_id: pid,
        checklist: checklist || [],
        catatan: catatan || '',
        to_unit: to_unit || null,
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      }
      await db.collection('saran_yanduan').insertOne(doc)
      await db.collection('local_cases').updateOne({ prepetrator_id: pid }, { $set: { status: STATUS.DISPOSISI_PIMPINAN, updated_at: new Date() } }, { upsert: true })
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: 'Saran/Masukan dari Yanduan',
        description: catatan || 'Telaah selesai, menunggu disposisi Kabid',
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'saran_yanduan')
      await logAudit(me, 'saran_yanduan', pid, { checklist, catatan, to_unit: to_unit || null })
      return ok({ data: doc })
    }

    // ---------- LIMPAS WASSIDIK ----------
    if (route === '/limpas-wassidik' && method === 'POST') {
      if (me.role !== 'kabid_propam' && me.role !== 'admin' && me.role !== 'super_admin') return fail('Hanya Kabid Propam', 403)
      const { pid, catatan } = await request.json()
      if (!pid) return fail('pid wajib')
      const db = await getDb()
      await db.collection('local_cases').updateOne({ prepetrator_id: pid }, { $set: { status: STATUS.SELESAI, limpas_wassidik: true, limpas_wassidik_at: new Date(), updated_at: new Date() } }, { upsert: true })
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: 'Dilimpahkan ke Wassidik',
        description: catatan || 'Dilimpahkan oleh Kabid',
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'limpas_wassidik')
      await logAudit(me, 'limpas_wassidik', pid, { catatan })
      return ok({ data: { pid, status: STATUS.SELESAI } })
    }

    // ---------- TOLAK (Unit kembalikan ke Kabid) ----------
    if (route === '/tolak' && method === 'POST') {
      if (!isKasubbidRole(me.role) && me.role !== 'admin' && me.role !== 'super_admin') return fail('Hanya Kasubbid/Admin', 403)
      const { pid, alasan } = await request.json()
      if (!pid) return fail('pid wajib')
      const db = await getDb()
      const latestDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
      const fromUnit = latestDisp?.to_unit || me.unit
      await db.collection('local_cases').updateOne({ prepetrator_id: pid }, { $set: { status: STATUS.DISPOSISI_PIMPINAN, updated_at: new Date() } }, { upsert: true })
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Ditolak oleh ${fromUnit}, kembali ke Kabid`,
        description: alasan || 'Dikembalikan ke Kabid Propam',
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'tolak')
      await logAudit(me, 'tolak', pid, { alasan, from_unit: fromUnit })
      return ok({ data: { pid, status: STATUS.DISPOSISI_PIMPINAN } })
    }

    // ---------- LIMPAS ANTAR UNIT ----------
    if (route === '/limpas-unit' && method === 'POST') {
      if (!isKasubbidRole(me.role) && me.role !== 'admin' && me.role !== 'super_admin') return fail('Hanya Kasubbid/Admin', 403)
      const { pid, to_unit, alasan } = await request.json()
      if (!pid || !to_unit) return fail('pid dan to_unit wajib')
      const db = await getDb()
      const currentDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
      const fromUnit = currentDisp?.to_unit || me.unit
      const newDisp = {
        id: uuidv4(), prepetrator_id: pid, to_unit,
        from_unit: fromUnit,
        note: alasan || '', is_atensi: false,
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(), synced_to_gajamada: false,
        is_limpas: true,
      }
      await db.collection('dispositions').insertOne(newDisp)
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Dilimpahkan dari ${fromUnit} ke ${to_unit}`,
        description: alasan || '',
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'limpas_unit')
      await logAudit(me, 'limpas_unit', pid, { from: fromUnit, to: to_unit, alasan })
      return ok({ data: { pid, to_unit } })
    }

    // ---------- RIWAYAT SAYA ----------
    if (route === '/riwayat-saya' && method === 'GET') {
      const db = await getDb()
      const username = me.username
      const myDisp = await db.collection('dispositions').find({ 'by.username': username }).sort({ created_at: -1 }).limit(100).toArray()
      const myTimelines = await db.collection('timelines').find({ 'by.username': username }).sort({ created_at: -1 }).limit(100).toArray()
      const involvedPids = [...new Set([...myDisp.map((d) => d.prepetrator_id), ...myTimelines.map((t) => t.prepetrator_id)])]
      const result = []
      for (const pid of involvedPids) {
        const [lc] = await Promise.all([
          db.collection('local_cases').findOne({ prepetrator_id: pid }).catch(() => null),
        ])
        let caseInfo = { prepetrator_id: pid, pengirim: '-', perihal: '-', status: lc?.status || STATUS.SURAT_MASUK_POLDA_JABAR }
        try {
          const gj = await gajamada.getCase(pid).catch(() => null)
          if (gj) caseInfo = { ...caseInfo, pengirim: gj.pengirim || gj.prepetrator_name || '-', perihal: gj.perihal || gj.summary || '-', nomor_surat: gj.nomor_surat || '-', disposisi_case_position: gj.disposisi_case_position }
        } catch (_) {}
        result.push(caseInfo)
      }
      return ok({ data: result.slice(0, 50) })
    }

    // ---------- REKOMENDASI REHABPERS ----------
    if (route === '/rekomendasi-rehabpers' && method === 'POST') {
      if (me.role !== 'kasubbag_rehabpers' && me.role !== 'admin' && me.role !== 'super_admin') return fail('Hanya Kasubbag Rehabpers', 403)
      const { pid, rekomendasi } = await request.json()
      if (!pid || !rekomendasi) return fail('pid dan rekomendasi wajib')
      const db = await getDb()
      await db.collection('local_cases').updateOne({ prepetrator_id: pid }, { $set: { status: STATUS.SELESAI, rekomendasi_rehabpers: rekomendasi, updated_at: new Date() } }, { upsert: true })
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: 'Rekomendasi Rehabpers',
        description: rekomendasi,
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      scheduleSync(pid, me, 'rekomendasi_rehabpers')
      await logAudit(me, 'rekomendasi_rehabpers', pid, { rekomendasi })
      return ok({ data: { pid, status: STATUS.SELESAI } })
    }

    // Antrian putusan sidang untuk Rehabpers
    if (route === '/antrian-rehabpers' && method === 'GET') {
      if (me.role !== 'kasubbag_rehabpers' && me.role !== 'admin' && me.role !== 'super_admin') return fail('Hanya Kasubbag Rehabpers', 403)
      const db = await getDb()
      const cases = await db.collection('local_cases').find({ status: STATUS.PUTUSAN_SIDANG }).sort({ updated_at: -1 }).limit(50).toArray()
      const result = []
      for (const lc of cases) {
        let info = { ...lc, pengirim: lc.pengirim || '-', perihal: lc.perihal || '-' }
        try {
          const gj = await gajamada.getCase(lc.prepator_id).catch(() => null)
          if (gj) info = { ...info, pengirim: gj.pengirim || gj.prepetrator_name || '-', perihal: gj.perihal || '-', nomor_surat: gj.nomor_surat || '-', disposisi_case_position: gj.disposisi_case_position }
        } catch (_) {}
        result.push(info)
      }
      return ok({ data: result.map(({ _id, ...r }) => r) })
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
      const label = docType
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Checklist "${label}" → ${status === 'not_applicable' ? 'Tidak Berlaku' : status === 'completed' ? 'Lengkap' : 'Belum Lengkap'}`,
        description: note || '-', by: { username: me.username, name: me.name, role: me.role }, created_at: new Date(),
      })
      scheduleSync(pid, me, 'checklist_update')
      await logAudit(me, 'checklist_update', pid, { docType, status })
      return ok({})
    }

    // Single disposisi (kept for compatibility, primary flow is bulk)
    const dispMatch = route.match(/^\/cases\/([^/]+)\/disposisi$/)
    if (dispMatch && method === 'POST') {
      if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
      const pid = decodeURIComponent(dispMatch[1])
      const { to_unit, note, is_atensi } = await request.json()
      const allUnits = await getAllActiveUnitNames()
      if (!to_unit || !allUnits.includes(to_unit)) return fail('Unit tujuan tidak valid')
      const db = await getDb()
      const fromUnit = me.role === 'kabid_propam' ? 'KABID PROPAM' : 'SUBBAG YANDUAN'
      const disp = {
        id: uuidv4(), prepetrator_id: pid, to_unit, from_unit: fromUnit,
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
      const [outcomeRow, checklistRows] = await Promise.all([
        db.collection('case_outcomes').findOne({ prepetrator_id: pid }),
        db.collection('followup_checklist').find({ prepetrator_id: pid }).toArray(),
      ])
      const checklist = computeChecklist(outcomeRow, checklistRows)
      if (!checklist.canComplete) {
        const missing = checklist.items.filter((i) => i.required && i.status === 'pending').map((i) => i.label)
        return fail(`Lengkapi checklist tindak lanjut dahulu: ${missing.join(', ')}`, 400)
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
      const c = await gajamada.getCase(pid).catch(() => null)
      if (c) {
        const enriched = await enrichCase(c)
        return ok({ data: enriched })
      }
      // Fallback: local_cases (manual)
      const db = await getDb()
      const lc = await db.collection('local_cases').findOne({ prepetrator_id: pid }).catch(() => null)
      if (lc) {
        const dispositions = await db.collection('dispositions').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray().catch(() => [])
        const timelines = await db.collection('timelines').find({ prepetrator_id: pid }).sort({ created_at: -1 }).toArray().catch(() => [])
        const syncLogs = await db.collection('sync_logs').find({ prepetrator_id: pid }).sort({ request_at: -1 }).limit(10).toArray().catch(() => [])
        const completed = await db.collection('completions').findOne({ prepetrator_id: pid }).catch(() => null)
        const outcome = await db.collection('case_outcomes').findOne({ prepetrator_id: pid }).catch(() => null)
        const checklistRows = await db.collection('followup_checklist').find({ prepetrator_id: pid }).toArray().catch(() => [])
        const strip = (arr) => arr.map(({ _id, ...r }) => r)
        const status = lc.status || STATUS.SURAT_MASUK_POLDA_JABAR
        const resolusi = lc.resolusi || null
        const _sync_status = (() => {
          const last = syncLogs[0]
          if (!last) return 'unknown'
          return last.status === 'success' ? 'synced' : 'pending'
        })()
        return ok({ data: {
          id: lc.id, prepetrator_id: pid,
          prepetrator_name: lc.prepetrator_name || lc.pengirim || '-',
          pengirim: lc.pengirim || '-',
          perihal: lc.perihal || '',
          summary: lc.summary || lc.content || '',
          category: lc.category || 'NON-DUMAS',
          case_type: lc.case_type || 'non_pengaduan',
          nomor_surat: lc.nomor_surat || '',
          tgl_surat: lc.tgl_surat,
          jenis_surat: lc.jenis_surat || '',
          status_label: status,
          source_alias: lc.source_alias || lc.source || 'LOCAL',
          disposisi_case_position: dispositions[0]?.to_unit || '-',
          is_atensi: !!dispositions[0]?.is_atensi,
          status,
          resolusi,
          bucket: getBucket(status),
          _sync_status,
          created_date: lc.created_at,
          updated_at: lc.updated_at || lc.created_at,
          dispositions: strip(dispositions),
          timelines: strip(timelines),
          sync_logs: strip(syncLogs),
          completed: completed ? { ...completed, _id: undefined } : null,
          outcome: outcome ? { ...outcome, _id: undefined } : null,
          checklist: checklistRows.map(({ _id, ...r }) => r),
        }})
      }
      return fail('Kasus tidak ditemukan', 404)
    }

    // ---------- TERIMA (unit accepts case) ----------
    const terimaMatch = route.match(/^\/cases\/([^/]+)\/terima$/)
    if (terimaMatch && method === 'POST') {
      const pid = decodeURIComponent(terimaMatch[1])
      const db = await getDb()
      const latestDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
      if (!latestDisp) return fail('Kasus belum didisposisi', 400)
      if (latestDisp.to_unit !== me.unit) return fail('Kasus ini bukan untuk unit Anda', 403)
      if (latestDisp.accepted_at) return fail('Kasus sudah diterima', 409)
      await db.collection('dispositions').updateOne(
        { id: latestDisp.id },
        { $set: { accepted_at: new Date(), accepted_by: { username: me.username, name: me.name, role: me.role, unit: me.unit } } }
      )
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Diterima oleh ${me.unit}`,
        description: `Kasus diterima oleh ${me.name} (${me.unit})`,
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      await logAudit(me, 'terima', pid, { unit: me.unit })
      return ok({ data: { prepetrator_id: pid, accepted: true } })
    }

    // ---------- STATUS TRANSITION ----------
    const statusMatch = route.match(/^\/cases\/([^/]+)\/status$/)
    if (statusMatch && method === 'POST') {
      const pid = decodeURIComponent(statusMatch[1])
      const { status: newStatus, note } = await request.json()
      if (!newStatus || !Object.values(STATUS).includes(newStatus)) return fail('Status tidak valid', 400)
      const db = await getDb()
      const localCase = await db.collection('local_cases').findOne({ prepetrator_id: pid })
      const currentStatus = localCase?.status || STATUS.SURAT_MASUK_POLDA_JABAR
      if (!canTransition(currentStatus, newStatus)) return fail(`Transisi dari "${currentStatus}" ke "${newStatus}" tidak diizinkan`, 400)
      if (BUCKET.SELESAI.includes(newStatus)) {
        const lc = localCase || {}
        if (!lc.resolusi) return fail('Status SELESAI memerlukan resolusi', 400)
      }
      await db.collection('local_cases').updateOne(
        { prepetrator_id: pid },
        { $set: { status: newStatus, updated_at: new Date() }, $setOnInsert: { prepetrator_id: pid, created_at: new Date() } },
        { upsert: true }
      )
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Status diubah: ${currentStatus} → ${newStatus}`,
        description: note || `Status diperbarui oleh ${me.name}`,
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      await logAudit(me, 'status_transition', pid, { from: currentStatus, to: newStatus })
      return ok({ data: { prepetrator_id: pid, status: newStatus } })
    }

    // ---------- RESOLUSI ----------
    const resolusiMatch = route.match(/^\/cases\/([^/]+)\/resolusi$/)
    if (resolusiMatch && method === 'POST') {
      const pid = decodeURIComponent(resolusiMatch[1])
      const { resolusi: newResolusi, note } = await request.json()
      if (!newResolusi || !Object.values(RESOLUSI).includes(newResolusi)) return fail('Resolusi tidak valid', 400)
      const db = await getDb()
      const localCase = await db.collection('local_cases').findOne({ prepetrator_id: pid })
      const currentStatus = localCase?.status || STATUS.SURAT_MASUK_POLDA_JABAR
      if (!canResolve(currentStatus, newResolusi)) return fail(`Resolusi "${newResolusi}" tidak diizinkan untuk status "${currentStatus}"`, 400)
      const set = { resolusi: newResolusi, updated_at: new Date() }
      if (!BUCKET.SELESAI.includes(currentStatus)) {
        set.status = STATUS.SELESAI
      }
      await db.collection('local_cases').updateOne(
        { prepetrator_id: pid },
        { $set: set, $setOnInsert: { prepetrator_id: pid, created_at: new Date() } },
        { upsert: true }
      )
      await db.collection('timelines').insertOne({
        id: uuidv4(), prepetrator_id: pid,
        title: `Resolusi: ${newResolusi}`,
        description: note || `Resolusi ditetapkan oleh ${me.name}`,
        by: { username: me.username, name: me.name, role: me.role },
        created_at: new Date(),
      })
      await logAudit(me, 'resolusi', pid, { resolusi: newResolusi })
      return ok({ data: { prepetrator_id: pid, resolusi: newResolusi } })
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
      const opts = { page: 1, size: 500 }
      if (me.role === 'unit') {
        opts.units = [me.unit]
      } else {
        opts.units = undefined
      }
      const result = await gajamada.listCases(opts).catch((e) => {
        if (e.code === 'GAJAMADA_DISABLED') return { data: [], total: 0, meta: { disabled: true } }
        throw e
      })
      const cases = result.data
      const total = result.total
      const db = await getDb()
      const pids = cases.map((c) => c.prepetrator_id)
      const [dispRows, tlRows, compRows] = await Promise.all([
        db.collection('dispositions').find({ prepetrator_id: { $in: pids } }).sort({ created_at: -1 }).toArray(),
        db.collection('timelines').find({ prepetrator_id: { $in: pids } }).limit(2000).toArray(),
        db.collection('completions').find({ prepetrator_id: { $in: pids } }).toArray(),
      ])
      const dispBy = {}; const tlSet = new Set(); const compSet = new Set()
      for (const d of dispRows) if (!dispBy[d.prepetrator_id]) dispBy[d.prepetrator_id] = d
      for (const t of tlRows) tlSet.add(t.prepetrator_id)
      for (const c of compRows) compSet.add(c.prepetrator_id)
      const effective = cases.map((c) => {
        const d = dispBy[c.prepetrator_id]
        const eff_status = deriveStatus(c.status_label, {
          hasDisposisi: !!d,
          hasTimeline: tlSet.has(c.prepetrator_id),
          isCompleted: compSet.has(c.prepetrator_id),
        })
        return { ...c, eff_unit: d?.to_unit || c.disposisi_case_position, eff_status, is_atensi: !!d?.is_atensi }
      })
      const byStatus = {}, byCategory = {}, byUnit = {}
      let totalAtensi = 0
      for (const c of effective) {
        const s = c.eff_status || 'Tidak diketahui'
        byStatus[s] = (byStatus[s] || 0) + 1
        if (c.is_atensi) totalAtensi++
        const cat = c.category || 'Tidak dikategorikan'
        byCategory[cat] = (byCategory[cat] || 0) + 1
        const u = c.eff_unit || 'Belum didisposisi'
        byUnit[u] = (byUnit[u] || 0) + 1
      }
      const toArr = (o) => Object.entries(o).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
      return ok({
        total, sampled: cases.length,
        kpi: { totalAtensi },
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

    // ---------- CONNECTION STATUS ----------
    if (route === '/connection-status' && method === 'GET') {
      let gajamadaConnected = false
      try {
        await gajamada.listCases({ size: 1 })
        gajamadaConnected = true
      } catch (e) {
        gajamadaConnected = e.code !== 'GAJAMADA_DISABLED' && !/belum di-set/.test(e.message || '')
      }

      return ok({ gajamada: gajamadaConnected })
    }

    // ---------- SETTINGS ----------
    if (route === '/settings' && method === 'GET') {
      return ok({
        gajamada: {
          base_url: process.env.GAJAMADA_BASE_URL || 'https://gajamada-propam.polri.go.id',
          connected: true,
        },
      })
    }

    // ---------- USERS CRUD (Admin only) ----------
    if (route === '/users' && method === 'GET') {
      if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
      return ok({ data: getAllUsers() })
    }
    if (route === '/users/reload' && method === 'POST') {
      if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
      try {
        const db = await getDb()
        const rows = await db.collection('users').find({}).toArray()
        setDbUsers(rows)
        return ok({ count: rows.length })
      } catch (_) {
        return ok({ count: 0 })
      }
    }
    if (route === '/users' && method === 'POST') {
      if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
      const { username, password, name, role, unit, active } = await request.json().catch(() => ({}))
      if (!username || !password || !name || !role) return fail('username, password, name, role wajib')
      const db = await getDb()
      const exist = await db.collection('users').findOne({ username })
      if (exist) return fail('Username sudah ada', 409)
      await db.collection('users').insertOne({
        username, password, name, role, unit: unit || null,
        active: active !== false, created_at: new Date(), updated_at: new Date(),
      })
      setDbUsers(await db.collection('users').find({}).toArray())
      await logAudit(me, 'user_create', username)
      return ok({ message: 'User ditambahkan' })
    }
    {
      const m = route.match(/^\/users\/([^/]+)$/)
      if (m && method === 'PUT') {
        if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
        const { password, name, role, unit, active } = await request.json().catch(() => ({}))
        if (!name || !role) return fail('name, role wajib')
        const db = await getDb()
        const set = { name, role, unit: unit || null, active: active !== false, updated_at: new Date() }
        if (password) set.password = password
        const result = await db.collection('users').updateOne({ username: m[1] }, { $set: set })
        if (result.matchedCount === 0) return fail('User tidak ditemukan', 404)
        setDbUsers(await db.collection('users').find({}).toArray())
        await logAudit(me, 'user_update', m[1])
        return ok({ message: 'User diperbarui' })
      }
      if (m && method === 'DELETE') {
        if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
        const db = await getDb()
        await db.collection('users').deleteOne({ username: m[1] })
        setDbUsers(await db.collection('users').find({}).toArray())
        await logAudit(me, 'user_delete', m[1])
        return ok({ message: 'User dihapus' })
      }
    }

    // ---------- ADMIN: DATA MIGRATION ----------
    if (route === '/admin/migrate-data' && method === 'POST') {
      if (!isAdminRole(me.role)) return fail('Hanya Admin/Super Admin', 403)
      const result = await migrateLocalCasesStatus()
      return ok({ data: result })
    }

    // ---------- LOCAL CASES (non-Gajamada: manual) ----------
    if (route === '/local-cases' && method === 'GET') {
      try {
        const db = await getDb()
        const source = url.searchParams.get('source') || undefined
        const caseType = url.searchParams.get('case_type') || undefined
        const search = url.searchParams.get('search') || ''
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
        const size = Math.min(100, Math.max(1, parseInt(url.searchParams.get('size') || '50', 10)))

        // Build combined AND filter (single find with all conditions)
        const filter = {}
        if (source) filter.source = source
        if (caseType) filter.case_type = caseType

        let q = db.collection('local_cases').find(filter)
        q = q.sort({ created_at: -1 })
        let rows = await q.toArray()

        if (search) {
          const s = search.toLowerCase()
          rows = rows.filter((r) => (r.pengirim || '').toLowerCase().includes(s) || (r.perihal || '').toLowerCase().includes(s) || (r.prepator_name || r.prepetrator_name || '').toLowerCase().includes(s))
        }

        const total = rows.length
        const paged = rows.slice((page - 1) * size, page * size)

        return ok({ data: paged.map(({ _id, ...r }) => r), total, page, size })
      } catch (e) {
        if (e.message && e.message.includes('does not exist')) return ok({ data: [], total: 0, page: 1, size: 50 })
        throw e
      }
    }
    if (route === '/local-cases' && method === 'POST') {
      const body = await request.json()
      // Role restriction: admin = all types, unit = laporan_informasi only
      if (me.role === 'unit' && body.case_type && body.case_type !== 'laporan_informasi') return fail('Unit hanya bisa input Laporan Informasi', 403)
      if (!body.perihal && !body.pengirim) return fail('Perihal atau pengirim wajib')

      // Input sanitization: trim & limit field lengths
      const MAX_FIELD = 10000
      const sane = (v, max = MAX_FIELD) => typeof v === 'string' ? v.trim().substring(0, max) : ''
      const dt = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d }

      const source = sane(body.source) || 'manual'
      const perihal = sane(body.perihal)
      const caseType = sane(body.case_type) || 'pengaduan'

      const db = await getDb()
      const now = new Date()
      const day = String(now.getDate()).padStart(2, '0')
      const month = String(now.getMonth() + 1).padStart(2, '0')

      let pid = sane(body.prepator_id || body.prepetrator_id)
      if (!pid) {
        const existCount = await db.collection('local_cases').countDocuments({ source })
        pid = `SIM-${now.getFullYear()}${month}${day}-${String(existCount + 1).padStart(5, '0')}`
      }

      const doc = {
        prepetrator_id: pid,
        source,
        case_type: caseType,
        perihal,
        nomor_surat: sane(body.nomor_surat, 500),
        tgl_surat: dt(body.tgl_surat),
        jenis_surat: sane(body.jenis_surat, 200),
        pengirim: sane(body.pengirim, 500),
        reporter_nik: sane(body.reporter_nik, 100),
        phone_no: sane(body.phone_no, 50),
        email: sane(body.email, 200),
        prepetrator_name: sane(body.prepator_name || body.prepetrator_name, 500),
        summary: sane(body.summary),
        content: sane(body.content),
        category: sane(body.category, 200),
        status: STATUS.SURAT_MASUK_POLDA_JABAR,
        source_alias: sane(body.source_alias) || 'Manual',
        pdf_url: sane(body.pdf_url, 2000),
        raw_data: body.raw_data || {},
        created_at: now,
        updated_at: now,
      }

      // Upsert: use prepetrator_id as unique key
      const existing = await db.collection('local_cases').findOne({ prepetrator_id: pid }).catch(() => null)
      if (existing) {
        await db.collection('local_cases').updateOne({ prepetrator_id: pid }, { $set: { ...doc, id: existing.id, created_at: existing.created_at } })
        await logAudit(me, 'local_case_update', existing.id, { pid, source })
        const row = await db.collection('local_cases').findOne({ prepetrator_id: pid })
        const { _id, ...clean } = row
        return ok({ data: clean, updated: true })
      }

      const newDoc = { id: uuidv4(), ...doc }
      await db.collection('local_cases').insertOne(newDoc)
      await logAudit(me, 'local_case_create', newDoc.id, { pid, source })
      const { _id, ...clean } = newDoc
      return ok({ data: clean, created: true })
    }
    {
      const m = route.match(/^\/local-cases\/([^/]+)$/)
      if (m && method === 'PUT') {
        const id = m[1]
        const patch = await request.json()
        const db = await getDb()
        const existing = await db.collection('local_cases').findOne({ id })
        if (!existing) return fail('Kasus tidak ditemukan', 404)
        // Unit hanya bisa edit laporan_informasi miliknya
        if (me.role === 'unit' && existing.case_type !== 'laporan_informasi') return fail('Unit hanya bisa edit Laporan Informasi', 403)
        const sane = (v, max = 10000) => typeof v === 'string' ? v.trim().substring(0, max) : v
        const cleaned = {}
        for (const [k, v] of Object.entries(patch)) {
          if (['prepetrator_name', 'prepator_name', 'pengirim', 'perihal', 'nomor_surat', 'tgl_surat', 'category', 'summary', 'case_type', 'jenis_surat', 'content', 'source_alias'].includes(k)) {
            cleaned[k === 'prepator_name' ? 'prepetrator_name' : k] = sane(v, k === 'nomor_surat' ? 500 : 10000)
          }
        }
        await db.collection('local_cases').updateOne({ id }, { $set: { ...cleaned, updated_at: new Date() } })
        await logAudit(me, 'local_case_edit', id, { fields: Object.keys(cleaned) })
        const row = await db.collection('local_cases').findOne({ id })
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
        return !/\.(js|css|png|jpg|svg|woff|ico|map|gif)$/.test(url)
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
      if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
      const { external_name, internal_unit } = await request.json()
      if (!external_name || !internal_unit) return fail('Nama eksternal dan internal wajib')
      const db = await getDb()
      const existing = await db.collection('unit_mapping').findOne({ external_name })
      if (existing) {
        await db.collection('unit_mapping').updateOne({ external_name }, { $set: { internal_unit, updated_at: new Date() } })
        const row = await db.collection('unit_mapping').findOne({ external_name })
        const { _id, ...clean } = row
        return ok({ data: clean })
      }
      const doc = { id: uuidv4(), external_name, internal_unit, created_at: new Date(), updated_at: new Date() }
      await db.collection('unit_mapping').insertOne(doc)
      const { _id, ...clean } = doc
      return ok({ data: clean })
    }
    {
      const m = route.match(/^\/unit-mapping\/([^/]+)$/)
      if (m && method === 'DELETE') {
        if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
        await (await getDb()).collection('unit_mapping').deleteOne({ id: m[1] })
        return ok({})
      }
    }
    {
      const m = route.match(/^\/unit-mapping\/([^/]+)$/)
      if (m && method === 'PUT') {
        if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
        const { external_name, internal_unit } = await request.json()
        if (!external_name || !internal_unit) return fail('Nama eksternal dan internal wajib')
        const db = await getDb()
        await db.collection('unit_mapping').updateOne({ id: m[1] }, { $set: { external_name, internal_unit, updated_at: new Date() } })
        await logAudit(me, 'unit_mapping_update', m[1], { external_name, internal_unit })
        return ok({})
      }
    }

    if (route === '/unit-mapping/sync' && method === 'POST') {
      if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
      const db = await getDb()
      const [mappings, catalogUnits, gajamadaCases, positions] = await Promise.all([
        db.collection('unit_mapping').find({}).toArray(),
        gajamada.getPoldaJabarUnits().catch(() => []),
        gajamada.listCases({ size: 2000 }).catch(() => ({ data: [] })),
        getAllPositions().catch(() => []),
      ])
      const mappedExternalNames = new Set(mappings.map((m) => m.external_name.toUpperCase()))
      const caseNames = (gajamadaCases.data || []).map((c) => c.disposisi_case_position).filter(Boolean)
      const catalogNames = catalogUnits.map((u) => u.name).filter(Boolean)
      const allExternalNames = [...new Set([...catalogNames, ...caseNames, ...positions])]
      const unmapped = allExternalNames.filter((name) => !mappedExternalNames.has(name.toUpperCase())).sort()
      const mapped = allExternalNames.filter((name) => mappedExternalNames.has(name.toUpperCase())).sort()
      return ok({ unmapped, mapped, total: allExternalNames.length })
    }

    // ---------- FORCE SYNC ----------
    if (route === '/force-sync' && method === 'POST') {
      if (!isDisposisiRole(me.role)) return fail('Hanya Kasubbid/Admin/Kabid Propam/Kasubbag Yanduan', 403)
      const { pid, reason } = await request.json()
      if (!pid) return fail('pid wajib')
      try {
        const db = await getDb()
        const originalGj = await gajamada.getCase(pid).catch(() => null)
        const latestDisp = await db.collection('dispositions').findOne({ prepetrator_id: pid }, { sort: { created_at: -1 } })
        if (!originalGj) return fail('Gajamada getCase returned null')
        const params = {
          report_id: pid,
          status: toGajamadaStatus(STATUS.SURAT_MASUK_POLDA_JABAR),
          case_position: latestDisp?.to_unit || originalGj.disposisi_case_position || '',
          note: latestDisp?.note || '',
          createdBy: me.name,
        }
        const pushResult = await gajamada.pushUpdate(params)
        return ok({ getCase: !!originalGj, dispTo: latestDisp?.to_unit, pushResult })
      } catch (e) {
        return fail('Sync error: ' + e.message)
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

// Retry failed Gajamada sync logs every 5 minutes (max 3 attempts per log)
if (typeof globalThis !== 'undefined' && !globalThis.__syncRetryScheduled) {
  globalThis.__syncRetryScheduled = true
  const SYNC_RETRY_MS = 5 * 60 * 1000
  const SYNC_MAX_RETRIES = 3
  const retryFailedSyncs = async () => {
    try {
      const db = await getDb()
      const failed = await db.collection('sync_logs').find({
        status: 'failed',

        retry_count: { $lt: SYNC_MAX_RETRIES },
      }).sort({ request_at: -1 }).limit(20).toArray()
      for (const log of failed) {
        if (!log.payload) continue
        try {
          const { status, body } = await gajamada.pushUpdate(log.payload)
          await db.collection('sync_logs').updateOne(
            { id: log.id },
            { $set: {
              status: (status >= 200 && status < 300 && body?.metaData?.status !== false) ? 'success' : 'failed',
              response: body, http_status: status, completed_at: new Date(),
              retry_count: (log.retry_count || 0) + 1,
            }}
          )
        } catch (e) {
          await db.collection('sync_logs').updateOne(
            { id: log.id },
            { $set: { error: e.message, completed_at: new Date(), retry_count: (log.retry_count || 0) + 1 } }
          ).catch(() => {})
        }
      }
    } catch (_) { /* retry worker is best-effort */ }
  }
  setTimeout(retryFailedSyncs, 30_000)
  setInterval(retryFailedSyncs, SYNC_RETRY_MS)
}

// One-time idempotent migration of legacy local_cases.status on first process boot.
if (typeof globalThis !== 'undefined' && !globalThis.__localCaseMigrationRun) {
  globalThis.__localCaseMigrationRun = true
  setTimeout(() => {
    migrateLocalCasesStatus().catch((e) => console.error('[migrate-local-cases] startup fatal', e.message))
  }, 10_000)
}
