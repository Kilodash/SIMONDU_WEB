import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = {}
for (const line of envFile.split('\n')) { const m = line.match(/^([^=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim() }

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const polresList = [
  { name: 'POLRES BANJAR KOTA', type: 'POLRES' },
  { name: 'POLRES BOGOR', type: 'POLRES' },
  { name: 'POLRES CIAMIS', type: 'POLRES' },
  { name: 'POLRES CIANJUR', type: 'POLRES' },
  { name: 'POLRES CIMAHI', type: 'POLRES' },
  { name: 'POLRES CIREBON KOTA', type: 'POLRES' },
  { name: 'POLRES GARUT', type: 'POLRES' },
  { name: 'POLRES INDRAMAYU', type: 'POLRES' },
  { name: 'POLRES KARAWANG', type: 'POLRES' },
  { name: 'POLRES KUNINGAN', type: 'POLRES' },
  { name: 'POLRES MAJALENGKA', type: 'POLRES' },
  { name: 'POLRES PANGANDARAN', type: 'POLRES' },
  { name: 'POLRES PURWAKARTA', type: 'POLRES' },
  { name: 'POLRES SUBANG', type: 'POLRES' },
  { name: 'POLRES SUKABUMI', type: 'POLRES' },
  { name: 'POLRES SUKABUMI KOTA', type: 'POLRES' },
  { name: 'POLRES SUMEDANG', type: 'POLRES' },
  { name: 'POLRES TASIKMALAYA', type: 'POLRES' },
  { name: 'POLRES TASIKMALAYA KOTA', type: 'POLRES' },
  { name: 'POLRESTA BANDUNG', type: 'POLRESTA' },
  { name: 'POLRESTA BOGOR KOTA', type: 'POLRESTA' },
  { name: 'POLRESTA CIREBON', type: 'POLRESTA' },
  { name: 'POLRESTABES BANDUNG', type: 'POLRESTABES' },
]

const subUnits = ['KASIPROPAM', 'KAUR YANDUAN', 'KANIT PAMINAL', 'KANIT PROVOS', 'KANIT WABPROF']

const rows = []
for (const polres of polresList) {
  for (const sub of subUnits) {
    const gajamadaName = `${sub} ${polres.name} POLDA JAWA BARAT`
    rows.push({
      id: uuidv4(),
      external_name: gajamadaName,
      internal_unit: polres.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
}

console.log(`Upserting ${rows.length} entries...`)
let added = 0, dup = 0
for (const row of rows) {
  const { error } = await supabase.from('unit_mapping').upsert(row, { onConflict: 'external_name' })
  if (error) {
    if (error.code === '23505') { dup++; continue }
    console.error(`FAIL ${row.external_name}:`, error.message)
  } else { added++ }
}

console.log(`Added: ${added}, Duplicate skipped: ${dup}`)

const { count } = await supabase.from('unit_mapping').select('*', { count: 'exact', head: true })
console.log(`Total in DB: ${count}`)
