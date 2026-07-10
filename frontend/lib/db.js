// Supabase PostgreSQL adapter — mimics MongoDB collection API used by route.js.
// Translates find/findOne/insertOne/updateOne/deleteOne/countDocuments to PostgREST
// calls via @supabase/supabase-js. Uses service_role key for full table access.
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

let _client = null
let _seeded = false

function getClient() {
  if (!_client) {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars not set')
    _client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  }
  return _client
}

// Build PostgREST filter chain for a query
function applyFilter(q, filter) {
  if (!filter || !Object.keys(filter).length) return q
  for (const [key, value] of Object.entries(filter)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('$in' in value) { q = q.in(key, value.$in); continue }
      if ('$ne' in value) { q = q.neq(key, value.$ne); continue }
      if ('$gt' in value) { q = q.gt(key, value.$gt); continue }
      if ('$gte' in value) { q = q.gte(key, value.$gte); continue }
      if ('$lt' in value) { q = q.lt(key, value.$lt); continue }
      if ('$lte' in value) { q = q.lte(key, value.$lte); continue }
    }
    q = q.eq(key, value)
  }
  return q
}

class SupabaseQuery {
  constructor(table, filter, opts = {}) {
    this._table = table
    this._filter = filter || {}
    this._sort = opts.sort || null
    this._limitVal = opts.limit || null
    this._single = opts.single || false
    this._count = opts.count || false
  }

  sort(sortObj) { this._sort = sortObj; return this }
  limit(n) { this._limitVal = n; return this }

  _build(select = '*') {
    const sb = getClient()
    let q = sb.from(this._table).select(select)
    q = applyFilter(q, this._filter)
    if (this._sort) {
      for (const [col, dir] of Object.entries(this._sort)) {
        q = q.order(col, { ascending: dir === 1 || dir === 'asc' })
      }
    }
    if (this._limitVal) q = q.limit(this._limitVal)
    return q
  }

  async toArray() {
    const q = this._build('*')
    if (this._count) return q // handle separately
    const { data, error } = await q
    if (error) throw error
    return data || []
  }

  catch(fn) { return this.toArray().catch(fn) }
  then(resolve, reject) { return this.toArray().then(resolve, reject) }
}

class SupabaseCollection {
  constructor(table) { this._table = table }

  find(filter = {}, opts = {}) {
    return new SupabaseQuery(this._table, filter, opts)
  }

  async findOne(filter = {}, opts = {}) {
    const sb = getClient()
    let q = sb.from(this._table).select('*')
    q = applyFilter(q, filter)
    if (opts.sort) {
      for (const [col, dir] of Object.entries(opts.sort)) {
        q = q.order(col, { ascending: dir === 1 || dir === 'asc' })
      }
    }
    q = q.limit(1).single()
    const { data, error } = await q
    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data || null
  }

  async insertOne(doc) {
    const sb = getClient()
    const { error } = await sb.from(this._table).insert(doc)
    if (error) throw error
  }

  async insertMany(docs) {
    const sb = getClient()
    const { error } = await sb.from(this._table).insert(docs)
    if (error) throw error
  }

  async updateOne(filter, update, opts = {}) {
    const sb = getClient()
    const setData = update.$set || update
    const setOnInsert = update.$setOnInsert || null

    if (opts.upsert) {
      // Read-then-write for upsert
      const existing = await this.findOne(filter).catch(() => null)
      if (existing) {
        let q = sb.from(this._table).update(setData)
        q = applyFilter(q, filter)
        const { error } = await q
        if (error) throw error
      } else {
        const insertDoc = { ...(setOnInsert || {}), ...setData }
        if (!Object.keys(filter).every((k) => k in insertDoc)) {
          // Include filter keys that aren't already in the doc
          for (const [k, v] of Object.entries(filter)) {
            if (!(k in insertDoc)) insertDoc[k] = v
          }
        }
        await this.insertOne(insertDoc)
      }
    } else {
      if (setOnInsert) {
        // Non-upsert with setOnInsert: only setOnInsert if row exists (merge into set)
        const merged = { ...setData }
        // For non-upsert, we only apply setData, ignore setOnInsert
      }
      let q = sb.from(this._table).update(setData)
      q = applyFilter(q, filter)
      const { error } = await q
      if (error) throw error
    }
  }

  async deleteOne(filter) {
    const sb = getClient()
    let q = sb.from(this._table).delete()
    q = applyFilter(q, filter)
    const { error } = await q
    if (error) throw error
  }

  async countDocuments(filter = {}) {
    const sb = getClient()
    let q = sb.from(this._table).select('*', { count: 'exact', head: true })
    q = applyFilter(q, filter)
    const { count, error } = await q
    if (error) throw error
    return count || 0
  }
}

export async function getDb() {
  const wrapper = { collection: (name) => new SupabaseCollection(name) }

  if (!_seeded) {
    _seeded = true
    // units_master is bootstrapped via POST /units-master/sync-gajamada.
    // No hardcoded seed here — kasubbid + child unit names are dynamic
    // and discovered from Gajamada (see /units-master/sync-gajamada route).
  }

  return wrapper
}

export async function getActiveUnits() {
  const db = await getDb()
  const rows = await db.collection('units_master').find({ active: true, is_kasubbid: false }).sort({ order: 1 }).toArray()
  return rows.map((r) => r.name)
}

// Look up the kasubbid unit name from units_master.
// Returns null if no kasubbid has been synced yet.
export async function getKasubbidName() {
  const db = await getDb()
  const row = await db.collection('units_master').findOne({ is_kasubbid: true, active: true })
  return row?.name || null
}

export async function getPolresUnits() {
  const db = await getDb()
  const rows = await db.collection('units_master').find({ active: true }).sort({ order: 1, name: 1 }).toArray()
  return rows
    .filter((r) => {
      if (!r.name) return false
      const up = r.name.toUpperCase()
      if (!up.includes('POLRES')) return false
      const parentUp = (r.parent || '').toUpperCase()
      return up.includes('JABAR') || up.includes('JAWA BARAT') || up.includes('BANDUNG')
        || parentUp.includes('JABAR') || parentUp.includes('JAWA BARAT') || parentUp.includes('BANDUNG')
    })
    .map((r) => r.name)
}

export async function getAllActiveUnitNames() {
  const db = await getDb()

  // Seed essential Polda Jabar units if missing
  const ESSENTIAL = [
    { name: 'KASUBBID WABPROF POLDA JAWA BARAT', parent: 'BIDPROPAM POLDA JAWA BARAT' },
    { name: 'UNIT WABPROF', parent: 'KASUBBID WABPROF POLDA JAWA BARAT' },
    { name: 'SUBBAG REHABPERS', parent: 'BIDPROPAM POLDA JAWA BARAT' },
    { name: 'SAT BRIMOB', parent: 'BIDPROPAM POLDA JAWA BARAT' },
    { name: 'WASSIDIK', parent: 'BIDPROPAM POLDA JAWA BARAT' },
    { name: 'BAG WASSIDIK DITRESKRIM UM', parent: 'WASSIDIK' },
    { name: 'BAG WASSIDIK DITRESKRIM SUS', parent: 'WASSIDIK' },
    { name: 'BAG WASSIDIK DITRESNARKOBA', parent: 'WASSIDIK' },
    { name: 'BAG WASSIDIK DITRESSIBER', parent: 'WASSIDIK' },
    { name: 'BAG WASSIDIK DITRES PPA/PPO', parent: 'WASSIDIK' },
  ]
  for (const eu of ESSENTIAL) {
    const exists = await db.collection('units_master').findOne({ name: eu.name })
    if (!exists) {
      await db.collection('units_master').insertOne({
        id: uuidv4(), name: eu.name, parent: eu.parent,
        is_kasubbid: false, active: true, order: 99, created_at: new Date(), source: 'seed',
      }).catch(() => {})
    }
  }

  const rows = await db.collection('units_master').find({ active: true }).sort({ order: 1, name: 1 }).toArray()

  const parentMap = {}
  for (const r of rows) parentMap[r.name] = r.parent || null

  const isJabar = (name, visited = new Set()) => {
    if (!name || visited.has(name)) return false
    visited.add(name)
    const up = name.toUpperCase()
    if (up.includes('JABAR') || up.includes('JAWA BARAT') || up.includes('BANDUNG')) return true
    const parent = parentMap[name]
    if (!parent) {
      return /PAMINAL|PROVOS|WABPROF|YANDUAN|WASSIDIK|BRIMOB|REHABPERS|KABID PROPAM/i.test(up)
    }
    return isJabar(parent, visited)
  }

  return rows.filter((r) => isJabar(r.name)).map((r) => r.name)
}

// Look up Gajamada external_name aliases for the kasubbid unit from unit_mapping.
// Returns [] if no mapping has been configured yet.
export async function getKasubbidAliases() {
  const db = await getDb()
  const kasubbid = await getKasubbidName()
  if (!kasubbid) return []
  const rows = await db.collection('unit_mapping').find({ internal_unit: kasubbid }).toArray()
  return rows.map((r) => r.external_name).filter(Boolean)
}
