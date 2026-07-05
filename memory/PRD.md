# SIMONDU_WEB — Antrian Disposisi (ASTINA integration)

**Original problem statement (verbatim, session 2):**
> pull github.com/Kilodash/SIMONDU_WEB.git
> lanjutkan project

Kredensial (user konfirmasi masih berlaku, 2026-02):
- ASTINA: 87041658@polri.go.id / Bidpropam18
- Zimbra: 87041658@polri.go.id / Candra8704 (⚠️ tanpa underscore — versi dengan `_` gagal auth)

## Arsitektur

- **Frontend**: Next.js 15 (App Router) di port 3000 (`yarn start` → `next dev`)
- **Backend**: FastAPI di port 8001 sebagai reverse-proxy ke `http://localhost:3000/api/*` (karena ingress Kubernetes route `/api/*` → 8001, sedangkan business logic ada di route Next.js).
- **DB**: MongoDB (`mongodb://localhost:27017/simondu`) — Supabase yang lama sudah di-stub.
- **Captcha solver**: Gemini 2.5 Flash Vision via Emergent LLM proxy.
- **OTP retrieval**: Zimbra SOAP (primary) + IMAP (fallback).
- **Session persistence**: `astina_sessions` collection di MongoDB, TTL 6 jam.

## Endpoint `/api/*` (via FastAPI proxy → Next.js catch-all)

| Method | Path                                | Fungsi                                                          |
|--------|-------------------------------------|-----------------------------------------------------------------|
| POST   | /api/auth/login                     | SIMONDU JWT session (hardcoded users)                           |
| POST   | /api/auth/logout                    | Clear SIMONDU cookie                                            |
| GET    | /api/astina/status                  | Session ASTINA saat ini (load dari Mongo bila proses baru start)|
| POST   | /api/astina/login                   | One-click auto-login (captcha + password + SOAP OTP)            |
| POST   | /api/astina/logout                  | Clear cached ASTINA session (Mongo + memory)                    |
| POST   | /api/astina/verify-otp              | Manual OTP: `{otp:"123456"}`                                    |
| POST   | /api/astina/fetch-otp               | Auto-fetch OTP (SOAP → IMAP fallback)                           |
| GET    | /api/astina/surat-baru              | Antrian disposisi (siap disposisi) live dari ASTINA             |
| GET    | /api/astina/surat-masuk             | Surat masuk yang sudah pernah didisposisi                       |
| GET    | /api/astina/surat/{id}              | Detail + riwayat 1 surat                                        |
| GET    | /api/astina/surat/{id}/riwayat      | Riwayat disposisi 1 surat                                       |
| GET    | /api/astina/attachment/{fileId}     | **NEW**: proxy download lampiran (streaming, signed URL)        |

## UI

- `/astina` — dedicated page: SIMONDU login → one-click auto-login ASTINA → surat masuk otomatis muncul → expand untuk lihat detail + riwayat + **download lampiran (Lihat/Unduh)**.
- `/` — halaman existing SIMONDU (kompleks, tetap ada, belum di-refactor).

## Status implementasi (setelah lanjutan sesi 2, 2026-02-05)

- ✅ Auto-login ASTINA (captcha + password + Zimbra SOAP OTP) — one-click ~11 detik end-to-end
- ✅ **[BARU] P0 fix**: `autoLogin({waitOtp:true})` sekarang coba Zimbra SOAP dulu, baru IMAP fallback (sebelumnya IMAP-only → gagal karena IMAP disabled per-account)
- ✅ **[BARU] P1**: ASTINA token cached di MongoDB `astina_sessions` — restart proses Next.js/FastAPI tidak logout (TTL 6 jam)
- ✅ **[BARU] P2**: Attachment download proxy `/api/astina/attachment/{fileId}` — streaming langsung dari signed URL ASTINA (verified: 3.3 MB PDF)
- ✅ **[BARU]** UI attachment: link Lihat (inline) + Unduh (download) di setiap surat
- ✅ Captcha solving via Gemini 2.5 Flash Vision, verified >90% accuracy
- ✅ Validasi OTP → session `authenticated`
- ✅ `/api/astina/surat-baru` menampilkan 6 surat masuk live dari ASTINA
- ✅ `/api/astina/surat/{id}/riwayat` menampilkan riwayat disposisi lengkap
- ✅ MongoDB seeded dengan units_master (kasubbid + 6 unit anak)

## Kredensial (lihat /app/memory/test_credentials.md)

## Prioritas backlog (yang belum)

- **P1**: Rewrite `app/page.js` (127KB) untuk pakai ASTINA-based navigation (menu utama masih Gajamada-centric)
- **P2**: Sync balik ke ASTINA — POST disposisi (butuh HAR user dari flow disposisi manual di webmail ASTINA untuk konfirmasi endpoint + payload shape sebelum diimplementasikan, karena guess-endpoint berpotensi lock akun)
- **P2**: TTL cleanup untuk cache lampiran (saat ini tanpa cache)
- **P3**: Filter/search di halaman /astina, pagination surat-masuk (sudah, sudah didisposisi)
- **P3**: Bulk-select + bulk-disposisi UI

## Files diubah sesi ini

- `/app/frontend/lib/astina-auth.js` — SOAP-first di autoLogin, Mongo-persist session, `logoutSession()`
- `/app/frontend/lib/astina-client.js` — `getFileLink(fileId)`
- `/app/frontend/app/api/[[...path]]/route.js` — `/astina/logout`, `/astina/attachment/{fileId}`, `currentSession` await
- `/app/frontend/app/astina/page.js` — Lampiran UI dengan Lihat/Unduh
- `/app/frontend/.env` — kredensial + Emergent LLM key
- `/app/backend/.env` — DB_NAME=simondu
