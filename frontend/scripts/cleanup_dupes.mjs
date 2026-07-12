import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = {}
for (const line of envFile.split('\n')) { const m = line.match(/^([^=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim() }

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 1. Find duplicate Polres names (with and without POLDA JAWA BARAT suffix)
const { data: all, error } = await supabase.from('units_master').select('*')
if (error) { console.error(error); process.exit(1) }

const polres = all.filter(r => r.name && (r.name.includes('POLRES') || r.name.includes('POLRESTA')))
console.log(`Total Polres entries: ${polres.length}`)

// Group by normalized name (strip POLDA JAWA BARAT)
const groups = {}
for (const p of polres) {
  const norm = p.name.replace(/\s*POLDA JAWA BARAT\s*/i, '').trim()
  if (!groups[norm]) groups[norm] = []
  groups[norm].push(p)
}

// Delete entries that have "POLDA JAWA BARAT" suffix if a shorter version exists
let deleted = 0
for (const [norm, entries] of Object.entries(groups)) {
  if (entries.length > 1) {
    // Keep the shortest name, delete the ones with POLDA JAWA BARAT suffix
    for (const e of entries) {
      if (e.name.toUpperCase().includes('POLDA JAWA BARAT')) {
        await supabase.from('units_master').delete().eq('id', e.id)
        deleted++
        console.log(`  DEL: ${e.name}`)
      }
    }
  }
}

console.log(`Deleted: ${deleted}`)

// Also delete non-Jabar Polres entries
let nonJabarDeleted = 0
for (const p of all) {
  const up = (p.name || '').toUpperCase()
  const pup = (p.parent || '').toUpperCase()
  const isJabar = up.includes('JABAR') || up.includes('JAWA BARAT') || up.includes('BANDUNG')
    || pup.includes('JABAR') || pup.includes('JAWA BARAT') || pup.includes('BANDUNG')
    || /PAMINAL|PROVOS|WABPROF|YANDUAN|WASSIDIK|BRIMOB|REHABPERS|KABID PROPAM/i.test(up)
  if (!isJabar) {
    try { await supabase.from('units_master').delete().eq('id', p.id); nonJabarDeleted++ } catch (_) {}
  }
}
console.log(`Non-Jabar deleted: ${nonJabarDeleted}`)

// Final count
const { count } = await supabase.from('units_master').select('*', { count: 'exact', head: true })
console.log(`Final count: ${count}`)
