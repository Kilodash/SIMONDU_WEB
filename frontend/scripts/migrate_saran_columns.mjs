import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = {}
for (const line of envFile.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/)
  if (m) env[m[1].trim()] = line.split('=').slice(1).join('=').trim()
}

console.log('URL:', env.SUPABASE_URL ? 'OK' : 'MISSING')
console.log('KEY:', env.SUPABASE_SERVICE_ROLE_KEY ? 'OK (length ' + env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'MISSING')

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const alts = [
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS saran_catatan TEXT`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS saran_checklist JSONB`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS saran_unit TEXT`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS saran_oleh TEXT`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS saran_at TIMESTAMPTZ`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS returned_to_divpropam BOOLEAN`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS returned_divpropam_at TIMESTAMPTZ`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS returned_divpropam_note TEXT`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS wassidik_surat_manual BOOLEAN`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS wassidik_surat_manual_at TIMESTAMPTZ`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS wassidik_surat_manual_oleh TEXT`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS wassidik_limpah_at TIMESTAMPTZ`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS wassidik_limpah_oleh TEXT`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS rekomendasi_rehabpers TEXT`,
  `ALTER TABLE local_cases ADD COLUMN IF NOT EXISTS disposisi_case_position TEXT`,
]

for (const stmt of alts) {
  try {
    const { error } = await supabase.rpc('exec_sql', { query: stmt })
    if (error) throw error
    console.log('OK:', stmt.substring(0, 60) + '...')
  } catch (e) {
    console.log('ERR:', e.message?.substring?.(0, 80) || e.code || String(e).substring(0, 80))
  }
}

// Verify
const { data: v, error: ve } = await supabase.from('local_cases').select('id,saran_at').limit(1)
if (ve) {
  console.log('\nVERIFY: column saran_at still missing. Run SQL manually in Supabase SQL Editor:')
  console.log(alts.map(s => s + ';').join('\n'))
} else {
  console.log('\nVERIFY OK - saran_at column exists. Migration successful.')
}
