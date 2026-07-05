// Stubbed out: SIMONDU no longer requires Supabase. We keep this module so
// existing imports don't break, but calls to getSupabaseAdmin() throw a
// clear message if any legacy code path tries to reach Supabase Storage
// (attachments are now uploaded straight to Gajamada / stored locally).

export function getSupabaseAdmin() {
  throw new Error('Supabase disabled in this build — data lives in MongoDB (lib/db.js)')
}

export const STORAGE_BUCKET = 'case-followup-documents'

export async function ensureBucket() {
  // no-op
}
