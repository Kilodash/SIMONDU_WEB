// Supabase admin client (service_role) — used only for Storage operations.
// DB operations go through lib/db.js which also uses Supabase PostgreSQL.
import { createClient } from '@supabase/supabase-js'

let _admin = null

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getSupabaseAdmin() {
  if (!_admin) {
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set')
    _admin = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  }
  return _admin
}

export const STORAGE_BUCKET = 'case-followup-documents'

export async function ensureBucket() {
  const sb = getSupabaseAdmin()
  const { data: buckets, error: listErr } = await sb.storage.listBuckets()
  if (listErr) throw listErr
  const exists = (buckets || []).some((b) => b.name === STORAGE_BUCKET)
  if (!exists) {
    const { error } = await sb.storage.createBucket(STORAGE_BUCKET, { public: true })
    if (error) throw error
  }
}
