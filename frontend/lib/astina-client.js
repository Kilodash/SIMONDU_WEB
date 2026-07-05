// ASTINA API client using auto-login + Bearer token session from lib/astina-auth
const { astinaFetch } = require('./astina-auth')

// GET /api/v1/suratmasuk/surat_baru — Surat masuk BELUM disposisi (antrian disposisi)
async function getSuratBaru({ per_page = 30, page = 1, q = '' } = {}) {
  const qs = new URLSearchParams({ per_page: String(per_page), page: String(page), q }).toString()
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/surat_baru?${qs}`)
  if (!body?.status) return { status: false, message: body?.message || `HTTP ${status}`, data: [], info: {} }
  return { status: true, data: body.data || [], info: body.info || {}, message: body.message }
}

// GET /api/v1/suratmasuk — Surat masuk SUDAH disposisi
async function getSuratMasuk({ per_page = 30, page = 1, q = '' } = {}) {
  const qs = new URLSearchParams({ per_page: String(per_page), page: String(page), q }).toString()
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk?${qs}`)
  if (!body?.status) return { status: false, message: body?.message || `HTTP ${status}`, data: [], info: {} }
  return { status: true, data: body.data || [], info: body.info || {}, message: body.message }
}

// GET /api/v1/suratmasuk/{id} — detail 1 surat (+ riwayat disposisi)
async function getSuratDetail(id) {
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/${encodeURIComponent(id)}`)
  if (!body?.status) return { status: false, message: body?.message || `HTTP ${status}`, data: null }
  return { status: true, data: body.data, message: body.message }
}

// GET /api/v1/suratmasuk/riwayat/{id} — riwayat disposisi (fallback)
async function getRiwayatDisposisi(id) {
  // Try a few known-safe patterns; first that returns status:true wins.
  const candidates = [
    `/api/v1/suratmasuk/riwayat/${encodeURIComponent(id)}`,
    `/api/v1/suratmasuk/riwayat_disposisi/${encodeURIComponent(id)}`,
    `/api/v1/disposisi/riwayat/${encodeURIComponent(id)}`,
    `/api/v1/disposisi/${encodeURIComponent(id)}`,
  ]
  for (const path of candidates) {
    try {
      const { body } = await astinaFetch(path)
      if (body?.status && (Array.isArray(body.data) || body.data)) {
        return { status: true, data: body.data, source_path: path }
      }
    } catch (_) { /* try next */ }
  }
  return { status: false, data: [], message: 'Endpoint riwayat disposisi tidak ditemukan' }
}

// GET /api/v1/user — profil user yang login
async function getUserInfo() {
  const { body } = await astinaFetch('/api/v1/user')
  return body
}

// GET /api/v1/suratmasuk/generate_link/{fileId} — dapatkan signed URL untuk lampiran
async function getFileLink(fileId) {
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/generate_link/${encodeURIComponent(fileId)}`)
  if (!body?.status || !body?.data?.path) {
    return { ok: false, message: body?.message || `HTTP ${status}` }
  }
  return { ok: true, url: body.data.path, expires_at: body.data.hmac_public?.Timeexpired || null }
}

module.exports = { getSuratBaru, getSuratMasuk, getSuratDetail, getRiwayatDisposisi, getUserInfo, getFileLink }
