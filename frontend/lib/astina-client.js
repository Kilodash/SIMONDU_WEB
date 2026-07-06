// ASTINA API client using auto-login + Bearer token session from lib/astina-auth
const { astinaFetch } = require('./astina-auth')

// GET /api/v1/suratmasuk/surat_baru — Surat masuk BELUM disposisi (antrian disposisi)
async function getSuratBaru({ per_page = 30, page = 1, q = '', username = null } = {}) {
  const qs = new URLSearchParams({ per_page: String(per_page), page: String(page), q }).toString()
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/surat_baru?${qs}`, {}, username)
  if (!body?.status) return { status: false, message: body?.message || `HTTP ${status}`, data: [], info: {} }
  return { status: true, data: body.data || [], info: body.info || {}, message: body.message }
}

// GET /api/v1/suratmasuk — Surat masuk SUDAH disposisi
async function getSuratMasuk({ per_page = 30, page = 1, q = '', username = null } = {}) {
  const qs = new URLSearchParams({ per_page: String(per_page), page: String(page), q }).toString()
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk?${qs}`, {}, username)
  if (!body?.status) return { status: false, message: body?.message || `HTTP ${status}`, data: [], info: {} }
  return { status: true, data: body.data || [], info: body.info || {}, message: body.message }
}

// GET /api/v1/suratmasuk/{id} — detail 1 surat (+ riwayat disposisi)
async function getSuratDetail(id, username = null) {
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/${encodeURIComponent(id)}`, {}, username)
  if (!body?.status) return { status: false, message: body?.message || `HTTP ${status}`, data: null }
  return { status: true, data: body.data, message: body.message }
}

// GET /api/v1/suratmasuk/riwayat/{id} — riwayat disposisi (fallback)
async function getRiwayatDisposisi(id, username = null) {
  const candidates = [
    `/api/v1/suratmasuk/riwayat/${encodeURIComponent(id)}`,
    `/api/v1/suratmasuk/riwayat_disposisi/${encodeURIComponent(id)}`,
    `/api/v1/disposisi/riwayat/${encodeURIComponent(id)}`,
    `/api/v1/disposisi/${encodeURIComponent(id)}`,
  ]
  for (const path of candidates) {
    try {
      const { body } = await astinaFetch(path, {}, username)
      if (body?.status && (Array.isArray(body.data) || body.data)) {
        return { status: true, data: body.data, source_path: path }
      }
    } catch (_) { /* try next */ }
  }
  return { status: false, data: [], message: 'Endpoint riwayat disposisi tidak ditemukan' }
}

// GET /api/v1/user — profil user yang login
async function getUserInfo(username = null) {
  const { body } = await astinaFetch('/api/v1/user', {}, username)
  return body
}

// GET /api/v1/suratmasuk/generate_link/{fileId} — dapatkan signed URL untuk lampiran
async function getFileLink(fileId, username = null) {
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/generate_link/${encodeURIComponent(fileId)}`, {}, username)
  if (!body?.status || !body?.data?.path) {
    return { ok: false, message: body?.message || `HTTP ${status}` }
  }
  return { ok: true, url: body.data.path, expires_at: body.data.hmac_public?.Timeexpired || null }
}

// GET /api/v1/suratmasuk/surat_baru_id/{id} — detail lengkap surat baru + 16 note preset
async function getSuratBaruDetail(id, username = null) {
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/surat_baru_id/${encodeURIComponent(id)}`, {}, username)
  if (!body?.status) return { ok: false, message: body?.message || `HTTP ${status}` }
  return { ok: true, data: body.data }
}

// GET /api/v1/suratmasuk/tujuan_disposisi/tujuan/{id} — list KANIT/KAUR valid untuk disposisi
async function getTujuanDisposisi(id, username = null) {
  const { status, body } = await astinaFetch(`/api/v1/suratmasuk/tujuan_disposisi/tujuan/${encodeURIComponent(id)}`, {}, username)
  if (!body?.status) return { ok: false, message: body?.message || `HTTP ${status}`, data: [] }
  return { ok: true, data: body.data || [] }
}

// POST /api/v1/suratmasuk/proses_dispo — kirim disposisi ASTINA
// payload: { surat_id, note: string[] (preset labels), tujuan: uuid[], custom: string[] }
async function postDisposisi({ suratId, notes = [], tujuan = [], custom = [], username = null }) {
  const payload = {
    surat_id: suratId,
    note: Array.isArray(notes) ? notes : [],
    tujuan: Array.isArray(tujuan) ? tujuan : [],
    custom: Array.isArray(custom) ? custom : [],
  }
  const { status, body } = await astinaFetch('/api/v1/suratmasuk/proses_dispo', {
    method: 'POST', body: payload,
  }, username)
  if (!body?.status) return { ok: false, message: body?.message || `HTTP ${status}` }
  return { ok: true, message: body.message }
}

module.exports = {
  getSuratBaru, getSuratMasuk, getSuratDetail, getRiwayatDisposisi, getUserInfo,
  getFileLink, getSuratBaruDetail, getTujuanDisposisi, postDisposisi,
}
