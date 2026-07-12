import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = {}
for (const line of envFile.split('\n')) { const m = line.match(/^([^=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim() }

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Find all BANJAR KOTA entries
const { data: banjarKota } = await supabase.from('unit_mapping').select('*').ilike('internal_unit', '%BANJAR KOTA%')
console.log(`Found ${banjarKota?.length || 0} BANJAR KOTA entries`)

// Also find any BANJAR (without KOTA) entries
const { data: banjar } = await supabase.from('unit_mapping').select('*').ilike('internal_unit', '%POLRES BANJAR%')
console.log(`Found ${banjar?.length || 0} POLRES BANJAR entries`)

if (banjarKota?.length) {
  // Update all BANJAR KOTA to BANJAR
  for (const m of banjarKota) {
    const newName = m.internal_unit.replace('BANJAR KOTA', 'BANJAR')
    if (newName !== m.internal_unit) {
      const { error } = await supabase.from('unit_mapping').update({ internal_unit: newName, updated_at: new Date().toISOString() }).eq('id', m.id)
      if (error) {
        console.error(`FAIL ${m.internal_unit}: ${error.message}`)
      } else {
        console.log(`  ${m.internal_unit} -> ${newName}`)
      }
    }
  }
}

// Final count
const { count } = await supabase.from('unit_mapping').select('*', { count: 'exact', head: true }).ilike('internal_unit', '%BANJAR%')
console.log(`\nBANJAR entries after: ${count}`)
