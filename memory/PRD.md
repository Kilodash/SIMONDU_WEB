# SIMONDU_WEB — Antrian Disposisi (ASTINA + Gajamada + Zimbra)

## Kredensial
- ASTINA: 87041658@polri.go.id / Bidpropam18
- Zimbra: 87041658@polri.go.id / Candra8704
- Gajamada: kasubbid_paminal_jabar / rahasia2026
- Emergent LLM key: sudah di /app/frontend/.env

## Arsitektur
- Next.js 15 app port 3000; FastAPI proxy port 8001 → forward /api/* → Next.js
- MongoDB `simondu` DB, `astina_sessions` cache 6-jam
- Captcha: Gemini 2.5 Flash Vision via Emergent LLM
- OTP: Zimbra SOAP primary + IMAP fallback

## Status Implementasi

### Sudah selesai
- ✅ ASTINA one-click auto-login SOAP-first (~11s)
- ✅ ASTINA session cached di Mongo (restart-safe 6 jam)
- ✅ Attachment proxy `/api/astina/attachment/{fileId}` (streaming signed URL)
- ✅ Gajamada credentials + unit alias fix (`POLDA JABAR SUBBID PAMINAL`)
- ✅ Menu Antrian Disposisi: **layout 2-panel + list**
  - Kolom kiri: Daftar Surat (Gajamada + ASTINA)
  - Panel 1 (tengah): Info Surat → Preview PDF (ASTINA) / Kronologi singkat-lengkap (Gajamada) → Timeline
  - Panel 2 (kanan): Lembar Disposisi (DUMAS/NON-DUMAS, unit, tasks, ATENSI)

### ASTINA endpoints yang sudah di-reverse-engineer (dari HAR user)
- `GET /api/v1/suratmasuk/surat_baru_id/{id}` — detail surat + 16 catatan preset + tujuan
- `GET /api/v1/suratmasuk/tujuan_disposisi/tujuan/{id}` — list KANIT/KAUR valid + `code` (payload untuk POST)
- `GET /api/v1/suratmasuk/tujuan_disposisi/custom/{id}` — custom tujuan
- `GET /api/v1/suratmasuk/riwayat_disposisi/{id}` — riwayat (dipakai)
- ⚠️ POST disposisi endpoint — belum tertangkap di HAR (user hanya buka form, tidak submit). Kemungkinan pattern: `POST /api/v1/suratmasuk/disposisi/{id}` dengan body berisi `code` list.

### Business logic (dikonfirmasi user)
- Antrian = surat baru dari Gajamada+ASTINA sebelum diklasifikasi
- Daftar Pengaduan tab GAJAMADA = kasus yang sudah diset DUMAS
- Tab NON-DUMAS = kasus yang sudah diset NON-DUMAS
- Tindak lanjut unit berbeda DUMAS vs NON-DUMAS
- ASTINA surat: perihal + PDF, jarang kronologis
- Gajamada surat: summary singkat + content lengkap
- **Unit ASTINA = per pejabat (KANIT/KAUR), bukan unit** — mapping saat sync balik nanti

### Backlog (belum)
- **Sync balik**:
  - Gajamada write-back via `pushUpdate` gateway (siap dipakai, tinggal wiring)
  - ASTINA write-back via HTTP — butuh HAR POST disposisi actual (user submit)
- Unit mapping table di Master Unit (SIMONDU ↔ Gajamada ↔ ASTINA/Kanit-Kaur)
- Sync Center dashboard + retry queue + log viewer
- Optimistic UI + confirmation modal + undo-30-detik
- Bulk disposisi
- AI ringkasan PDF via Gemini
- Two-way sync watcher (cron polling)

## Files utama
- `/app/frontend/app/page.js` — DisposisiPage 2-panel, timeline state, kronologi toggle
- `/app/frontend/lib/units.js` — KASUBBID_UNIT_ALIASES
- `/app/frontend/lib/astina-auth.js` — SOAP-first + Mongo cache
- `/app/frontend/lib/astina-client.js` — getFileLink, getSuratBaru, riwayat
- `/app/frontend/app/api/[[...path]]/route.js` — attachment proxy, disposisi-queue
- `/app/frontend/.env` — semua kredensial
