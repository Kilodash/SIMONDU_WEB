// Native MongoDB adapter — mimics the tiny subset used by app/api/[[...path]]/route.js
// (findOne, find().sort().limit().toArray(), insertOne/Many, updateOne(upsert), deleteOne,
// countDocuments). Kept intentionally small; not a general-purpose ORM.
import { MongoClient } from 'mongodb'
import { KASUBBID_UNIT, CHILD_UNITS } from './units'

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const DB_NAME = process.env.DB_NAME || 'simondu'

let _client = null
let _mongoDb = null
let _seeded = false

async function connect() {
  if (_mongoDb) return _mongoDb
  _client = new MongoClient(MONGO_URL, { maxPoolSize: 20 })
  await _client.connect()
  _mongoDb = _client.db(DB_NAME)
  return _mongoDb
}

export async function getDb() {
  const mongo = await connect()
  const wrapper = { collection: (name) => mongo.collection(name) }
  if (!_seeded) {
    _seeded = true
    try {
      const c = mongo.collection('units_master')
      const count = await c.countDocuments({})
      if (count === 0) {
        await c.insertMany([
          { id: 'kasubbid', name: KASUBBID_UNIT, parent: null, is_kasubbid: true, active: true, order: 0, created_at: new Date().toISOString() },
          ...CHILD_UNITS.map((u, i) => ({
            id: `unit-${i + 1}`, name: u, parent: KASUBBID_UNIT, is_kasubbid: false, active: true, order: i + 1, created_at: new Date().toISOString(),
          })),
        ])
      }
    } catch (e) { /* seeding is best-effort */ }
  }
  return wrapper
}

export async function getActiveUnits() {
  const db = await getDb()
  const rows = await db.collection('units_master').find({ active: true, is_kasubbid: false }).sort({ order: 1 }).toArray()
  return rows.map((r) => r.name)
}
