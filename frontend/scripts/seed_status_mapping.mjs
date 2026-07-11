import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = {}
for (const line of envFile.split('\n')) { const m = line.match(/^([^=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim() }

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const mappingFile = readFileSync(new URL('status_mapping.txt', import.meta.url), 'utf8')
const rows = []
for (const line of mappingFile.split('\n')) {
  const m = line.match(/^(.+?)\|(.+)$/)
  if (!m) continue
  rows.push({ id: uuidv4(), gajamada_status: m[1].trim(), simondu_status: m[2].trim() })
}

console.log(`Saving ${rows.length} status mappings...`)

// Delete old and insert new
await supabase.from('status_mapping').delete().neq('id', '')

for (const row of rows) {
  const { error } = await supabase.from('status_mapping').upsert(row, { onConflict: 'id' })
  if (error) console.error(`FAIL ${row.gajamada_status}:`, error.message)
}

const { count } = await supabase.from('status_mapping').select('*', { count: 'exact', head: true })
console.log(`Total in DB: ${count}`)
