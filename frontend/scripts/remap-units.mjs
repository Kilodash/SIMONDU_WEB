import 'dotenv/config'
import { getDb } from '../lib/db.js'
import * as gajamada from '../lib/gajamada.js'
import { v4 as uuidv4 } from 'uuid'
import { FILTER_UNITS, shortUnit } from '../lib/units.js'
import { simplifyUnit } from '../lib/mapping.js'

async function main() {
  console.log('=== REMAP UNIT MAPPING ===\n')

  // 1. Delete existing mappings
  const db = await getDb()
  const { deletedCount } = await db.collection('unit_mapping').deleteMany({})
  console.log(`Deleted ${deletedCount} existing unit_mapping rows.\n`)

  // 2. Login to Gajamada
  console.log('Logging into Gajamada...')
  await gajamada.initGajamadaSession()
  console.log('Logged in.\n')

  // 3. Fetch Polda Jabar positions from Gajamada
  console.log('Fetching Polda Jabar units from Gajamada...')
  const jabarUnits = await gajamada.getPoldaJabarUnits()
  const cases = await gajamada.listCases({ size: 500 })
  const positionsFromCases = [...new Set((cases.data || []).map((c) => c.disposisi_case_position).filter(Boolean))]

  const allNames = new Set()
  for (const u of jabarUnits) allNames.add(u.name)
  for (const p of positionsFromCases) allNames.add(p)

  const sorted = [...allNames].sort()
  console.log(`Found ${sorted.length} unique Polda Jabar unit names.\n`)

  // 4. Smart pattern matching
  function guessLabel(name) {
    const up = name.toUpperCase()
    if (up.includes('KABID PROPAM')) return 'KABID PROPAM'
    if (up.includes('YANDUAN')) return 'SUBBAG YANDUAN'
    if (up.includes('PAMINAL')) return 'SUBBID PAMINAL'
    if (up.includes('PROVOS')) return 'SUBBID PROVOS'
    if (up.includes('WABPROF')) return 'SUBBID WABPROF'
    if (up.includes('REHABPERS')) return 'SUBBAG REHABPERS'
    if (up.includes('WASSIDIK')) return 'WASSIDIK'
    if (up.includes('BRIMOB')) return 'SAT BRIMOB'
    if (up.includes('POLRES') || up.includes('POLRESTA') || up.includes('POLRESTABES')) return 'POLRES'
    return 'SATKER LAIN'
  }

  const mapped = {}
  let count = 0
  for (const name of sorted) {
    const label = guessLabel(name)
    await db.collection('unit_mapping').insertOne({
      id: uuidv4(),
      external_name: name,
      internal_unit: label,
      created_at: new Date(),
      updated_at: new Date(),
    })
    mapped[label] = (mapped[label] || 0) + 1
    count++
  }

  console.log(`Mapped ${count} units by pattern: `)
  for (const [label, c] of Object.entries(mapped)) {
    console.log(`  ${label}: ${c}`)
  }

  // 5. Show ambiguous ones (if any) for manual review
  const ambiguous = sorted.filter((n) => guessLabel(n) === 'SATKER LAIN')
  if (ambiguous.length > 0) {
    console.log(`\nAmbiguous (auto-mapped to SATKER LAIN, review needed): `)
    for (const a of ambiguous) {
      console.log(`  ${a} → SATKER LAIN`)
    }
  }

  console.log('\nDone!')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
