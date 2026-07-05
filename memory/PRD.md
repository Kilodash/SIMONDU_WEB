# SIMONDU_WEB — Antrian Disposisi (ASTINA + Gajamada + Zimbra)

## Kredensial (dikonfirmasi user, 2026-02-05)
- ASTINA: 87041658@polri.go.id / Bidpropam18
- Zimbra: 87041658@polri.go.id / Candra8704
- Gajamada: kasubbid_paminal_jabar / rahasia2026

## Arsitektur
- Frontend: Next.js 15 App Router, port 3000
- Backend: FastAPI reverse-proxy port 8001 → forward `/api/*` → Next.js
- DB: MongoDB (`simondu` database); `astina_sessions` cache 6-jam
- LLM (captcha): Gemini 2.5 Flash Vision via Emergent LLM
- OTP: Zimbra SOAP primary + IMAP fallback

## Status Implementasi (session terakhir)

### Sudah selesai
- ✅ P0 SOAP-first OTP fetch (~11s one-click login)
- ✅ P1 Session ASTINA cached di MongoDB (restart-safe 6 jam)
- ✅ P2 Attachment download proxy (/api/astina/attachment/{fileId})
- ✅ Gajamada login + credentials terisi (5 kasus di antrian)
- ✅ Unit filter alias: `POLDA JABAR SUBBID PAMINAL` + `KASUBBID PAMINAL POLDA JAWA BARAT` (Gajamada pakai nama pertama)
- ✅ **Redesign menu Antrian Disposisi** — split-view kiri list surat, kanan tabs dinamis per sumber:
  - ASTINA: **Info Surat | Timeline | Preview PDF | Lembar Disposisi**
  - Gajamada: **Info Surat | Timeline | Kronologi (singkat/lengkap toggle) | Lembar Disposisi**
- ✅ Timeline fetch source-aware: ASTINA via `/api/astina/surat/{id}/riwayat`, Gajamada via `/api/cases/{pid}/timeline-all`
- ✅ Lembar Disposisi tab: toggle DUMAS/NON-DUMAS + unit tujuan + tasks + note + ATENSI
- ✅ Verified end-to-end via 5 screenshots (Gajamada timeline 8 entries; ASTINA PDF preview; kronologi singkat/lengkap toggle)

### Backlog (belum)
- **P1** rewrite `app/page.js` lain (bagian di luar DisposisiPage masih Gajamada-centric)
- **P2** POST disposisi balik ke ASTINA (butuh HAR user dari webmail ASTINA)
- **P3** Bulk-disposisi UI, filter/search di daftar surat
- **P3** Ringkasan AI per surat (Gemini analisa PDF lampiran → saran unit + kategori)

## Business logic (dikonfirmasi user)
- **Antrian** = surat baru dari Gajamada + ASTINA sebelum diklasifikasi
- **Daftar Pengaduan tab GAJAMADA** = kasus yang sudah diset DUMAS via Lembar Disposisi
- **Daftar Pengaduan tab NON-DUMAS** = kasus yang sudah diset NON-DUMAS
- **Tindak lanjut unit berbeda** antara DUMAS vs NON-DUMAS (case_type di POST /disposisi-bulk)
- ASTINA surat biasanya tanpa kronologis, hanya perihal + PDF lampiran
- Gajamada surat biasanya ada kronologi (summary singkat + content lengkap)

## Files utama yang diubah
- `/app/frontend/app/page.js` — DisposisiPage: split-view + tabs dinamis + timeline state
- `/app/frontend/lib/units.js` — `KASUBBID_UNIT_ALIASES` (Gajamada nama beda)
- `/app/frontend/lib/astina-auth.js` — SOAP-first + Mongo cache
- `/app/frontend/lib/astina-client.js` — `getFileLink(fileId)`
- `/app/frontend/app/api/[[...path]]/route.js` — attachment proxy, KASUBBID_UNIT_ALIASES usage
- `/app/frontend/.env` — semua kredensial + Emergent LLM key
