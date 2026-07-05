# SIMONDU_WEB — Progress Log

> Living document tracking implementation progress, architectural decisions, and roadmap.
> Last updated: **2026-02-05**

---

## 1. Ringkasan Proyek

**SIMONDU WEB** = aplikasi bantu Kasubbid Paminal Polda Jawa Barat untuk mengelola antrian disposisi surat masuk dari 2 sumber:
- **ASTINA** (`api-gw.polri.go.id/api-eoffice`) — sistem e-office resmi Polri
- **Gajamada** (`gajamada-propam.polri.go.id`) — sistem eBdesk Fusion untuk pengaduan masyarakat (Dumas)

Kasubbid me-review, mengklasifikasi (DUMAS vs NON-DUMAS), dan meneruskan (disposisi) ke unit di bawahnya (Unit 1/2/3, Ur Binpam, Ur Litpers, Ur Prodok). Perubahan wajib disinkronkan balik ke sistem sumber.

## 2. Arsitektur

```
                                            ┌──────────────────────────┐
                                            │   ASTINA (api-gw.polri)  │
                                            │  - captcha login         │
                                            │  - OTP via Zimbra        │
                                            └────────────▲─────────────┘
                                                         │ Bearer JWT
┌────────────────┐    ┌─────────────────┐    ┌───────────┴──────────────┐
│  Browser (UI)  │───▶│  Ingress /api/* │───▶│  FastAPI proxy :8001     │
│  Next.js 15    │    │  → :8001        │    │  reverse-proxy /api/*    │
└────────────────┘    └─────────────────┘    │  → localhost:3000/api/*  │
        ▲                                    └───────────▲──────────────┘
        │ /_next, /                                      │
        │                                    ┌───────────┴──────────────┐
┌───────┴────────┐                           │  Next.js API :3000       │
│  Frontend      │◀──────────────────────────│  /app/api/[[...path]]    │
│  React pages   │                           │  business logic          │
└────────────────┘                           └────┬──────────────┬──────┘
                                                  │              │
                                        ┌─────────▼────┐  ┌──────▼──────┐
                                        │  MongoDB     │  │  Gajamada   │
                                        │  simondu DB  │  │  eBdesk     │
                                        └──────────────┘  └─────────────┘
```

**Kenapa 2-layer proxy?** Ingress Kubernetes route `/api/*` ke port 8001 (FastAPI convention). Business logic ada di Next.js (single-app + shared components). FastAPI hanya forward + hot-reload friendly.

## 3. Kredensial (di `/app/frontend/.env`, verified valid 2026-02)

| Sistem   | Field              | Value                         |
|----------|--------------------|-------------------------------|
| ASTINA   | ASTINA_USERNAME    | `87041658@polri.go.id`        |
| ASTINA   | ASTINA_PASSWORD    | `Bidpropam18`                 |
| Zimbra   | ZIMBRA_EMAIL       | `87041658@polri.go.id`        |
| Zimbra   | ZIMBRA_PASSWORD    | `Candra8704` (⚠️ tanpa underscore) |
| Gajamada | GAJAMADA_USERNAME  | `kasubbid_paminal_jabar`      |
| Gajamada | GAJAMADA_PASSWORD  | `rahasia2026`                 |

Local SIMONDU JWT auth: `/app/memory/test_credentials.md` (kasubbid / kasubbid123, dll).

## 4. Feature Status (per 2026-02-05)

| # | Feature                                                | Status | Notes |
|---|--------------------------------------------------------|--------|-------|
| 1 | ASTINA one-click auto-login (captcha + password + OTP) | ✅ Done | ~11s end-to-end. Captcha via Gemini 2.5 Flash Vision. |
| 2 | Zimbra OTP fetch (SOAP primary + IMAP fallback)        | ✅ Done | SOAP-first setelah discover IMAP disabled per-account. |
| 3 | ASTINA session cache di MongoDB `astina_sessions`      | ✅ Done | TTL 6 jam, restart-safe. |
| 4 | Gajamada login + list cases                            | ✅ Done | Unit alias fix (Gajamada pakai `POLDA JABAR SUBBID PAMINAL`). |
| 5 | Antrian Disposisi merged view (ASTINA + Gajamada)      | ✅ Done | `/api/disposisi-queue` — 6 ASTINA + 5 Gajamada = 11 items. |
| 6 | Attachment download proxy (ASTINA signed URL)          | ✅ Done | `/api/astina/attachment/{fileId}` streaming. |
| 7 | Layout 2-panel Antrian Disposisi (list + detail + form)| ✅ Done | Info + PDF preview (ASTINA) / Kronologi (Gajamada) + Timeline. |
| 8 | Local disposisi (SIMONDU internal Mongo)               | ✅ Done | `/api/disposisi-bulk` POST → `dispositions` collection. |
| 9 | Sync balik Gajamada (via `pushUpdate` gateway)         | ✅ Done | Fire-and-forget via `backgroundSync()` di route.js. |
| 10| Sync balik ASTINA (POST `/proses_dispo`)               | 🚧 WIP | Endpoint + client sudah, tinggal wiring ke `submitAndNext`. |
| 11| List KANIT/KAUR ASTINA + note preset (16 catatan)     | ✅ Done | `/api/astina/surat/{id}/tujuan-disposisi` returns tujuan + note_preset. |
| 12| Sync log viewer / retry queue                          | ⛔ Belum | Backend `sync_logs` collection ada, UI belum. |
| 13| Layout: nav prev/next di bawah (hapus kolom list)      | 🚧 WIP | User request terakhir. |
| 14| Two-way sync watcher (cron polling)                    | ⛔ Belum | Untuk deteksi disposisi yang tidak via SIMONDU. |
| 15| Bulk disposisi (multi-select)                          | ⛔ Belum | |
| 16| Unit mapping table (SIMONDU ↔ Gajamada ↔ ASTINA)      | ⛔ Belum | Kolom `alias_gajamada`, `alias_astina` di units_master. |
| 17| AI ringkasan PDF via Gemini                            | ⛔ Belum | Untuk PDF ASTINA yang panjang. |

## 5. Endpoint Reference

### 5.1 Internal (SIMONDU)

| Method | Path                                       | Fungsi                                            |
|--------|--------------------------------------------|---------------------------------------------------|
| POST   | /api/auth/login                            | JWT session cookie                                |
| POST   | /api/auth/logout                           | Clear cookie                                      |
| GET    | /api/astina/status                         | ASTINA session state (dari Mongo cache)           |
| POST   | /api/astina/login                          | Auto-login ASTINA (captcha + Zimbra OTP)          |
| POST   | /api/astina/logout                         | Clear ASTINA cache                                |
| POST   | /api/astina/verify-otp                     | Manual OTP `{otp:"123456"}`                       |
| POST   | /api/astina/fetch-otp                      | Auto-fetch OTP (SOAP → IMAP fallback)             |
| GET    | /api/astina/surat-baru                     | Antrian disposisi ASTINA (unified)                |
| GET    | /api/astina/surat-masuk                    | Yang sudah didisposisi ASTINA                     |
| GET    | /api/astina/surat/{id}                     | Detail + riwayat                                  |
| GET    | /api/astina/surat/{id}/riwayat             | Riwayat disposisi                                 |
| GET    | /api/astina/surat/{id}/tujuan-disposisi    | List KANIT/KAUR + 16 note preset                  |
| POST   | /api/astina/surat/{id}/disposisi           | Kirim disposisi ASTINA `{notes[], tujuan[], custom[]}` |
| GET    | /api/astina/attachment/{fileId}?inline=1   | Proxy download lampiran                           |
| GET    | /api/disposisi-queue                       | Merged queue (Gajamada + ASTINA)                  |
| GET    | /api/disposisi-queue/count                 | Count untuk badge di sidebar                      |
| POST   | /api/disposisi-bulk                        | Local disposisi + fire backgroundSync             |
| GET    | /api/cases/{pid}                           | Case detail (Gajamada + internal)                 |
| GET    | /api/cases/{pid}/attachments               | Lampiran Gajamada                                 |
| GET    | /api/cases/{pid}/timeline-all              | Timeline merged (Gajamada + internal + sync log)  |

### 5.2 ASTINA upstream (verified dari HAR)

| Method | Path                                                  | Fungsi                                    |
|--------|-------------------------------------------------------|-------------------------------------------|
| POST   | /api/auth/login_web                                   | Login step 1 (email + password + captcha) |
| POST   | /api/auth/validasi_otp                                | OTP validation                            |
| GET    | /api/v1/user                                          | Profile user                              |
| GET    | /api/v1/suratmasuk/surat_baru                         | List antrian disposisi                    |
| GET    | /api/v1/suratmasuk/surat_baru_id/{id}                 | Detail + 16 note preset + tujuan          |
| GET    | /api/v1/suratmasuk/riwayat_disposisi/{id}             | Riwayat disposisi                         |
| GET    | /api/v1/suratmasuk/tujuan_disposisi/tujuan/{id}       | List KANIT/KAUR valid + `code` (payload)  |
| GET    | /api/v1/suratmasuk/tujuan_disposisi/custom/{id}       | Custom tujuan disposisi                   |
| GET    | /api/v1/suratmasuk/generate_link/{fileId}             | Signed URL untuk lampiran                 |
| **POST** | **/api/v1/suratmasuk/proses_dispo**                 | **Kirim disposisi** (payload di bawah)    |

**Payload POST `/proses_dispo`:**
```json
{
  "surat_id": "8ba8af44-485d-4b2f-962a-c0956116e95f",
  "note": ["CATAT/DATAKAN/FILE", "BAHAN ANEV"],
  "tujuan": ["18b81f2e-d0a8-4447-a2bb-cbf892954378"],
  "custom": []
}
```

**Response sukses**: `{"status":true,"code":200,"message":"Disposisi Berhasil","data":null}`

**Note preset ASTINA (16 opsi)**: WAKILI/HADIRI, ACC/MAKLUM, LAKUKAN LIDIK/SIDIK, TINDAKLANJUTI, HUB SAYA, PROSES SESUAI KETENTUAN, PELAJARI, KOORDINASIKAN, JAWABAN/TANGGAPAN, PROSES SEGERA, BAHAN ANEV, JAKORDIN, JAKORTAS, JAKORWAS, JAKUP, CATAT/DATAKAN/FILE.

### 5.3 Gajamada (via `lib/gajamada.js`)

| Method | Endpoint / Function             | Fungsi                             |
|--------|---------------------------------|------------------------------------|
| POST   | `login()`                       | Cookie session                     |
| POST   | `listCases({units, size})`      | List kasus + filter unit           |
| POST   | `getCase(pid)`                  | Detail 1 kasus                     |
| POST   | `getCaseAttachments(pid)`       | Lampiran (report_document)         |
| POST   | `getTimeline(pid)`              | report_officer_detail activities   |
| POST   | `pushUpdate(payload)`           | Write-back via gateway ID (env)    |
| POST   | `attachToReport(pid, files)`    | Upload dokumen                     |

## 6. Business Logic

### 6.1 Flow disposisi (yang sudah dikonfirmasi user)

```
                    ┌────────────────────────────┐
                    │  Sumber (Gajamada/ASTINA)  │
                    │   surat masuk baru         │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
              ┌──────────────────────────────────────┐
              │  ANTRIAN DISPOSISI  (di SIMONDU)     │
              │  posisi = KASUBBID PAMINAL JABAR     │
              └─────────────┬────────────────────────┘
                            │  Kasubbid review + klasifikasi
                            ├─── DUMAS ────┐
                            │              │
                            └─── NON-DUMAS ┤
                                           ▼
              ┌──────────────────────────────────────┐
              │  DISPOSISI KE UNIT (Kanit/Kaur/Ur…)  │
              │  1. Simpan lokal di Mongo            │
              │  2. Sync balik ke sumber:            │
              │     - Gajamada: pushUpdate gateway   │
              │     - ASTINA: POST proses_dispo      │
              │  3. Posisi surat pindah → unit       │
              └─────────────┬────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────────────┐
              │  DAFTAR PENGADUAN (per case_type)    │
              │  tab DUMAS / tab NON-DUMAS           │
              │  unit tindak lanjut sesuai jenis     │
              └──────────────────────────────────────┘
```

### 6.2 Mapping unit (penting untuk sync balik)

| SIMONDU (internal)                              | Gajamada                       | ASTINA (per pejabat)                                                |
|-------------------------------------------------|--------------------------------|---------------------------------------------------------------------|
| KASUBBID PAMINAL POLDA JAWA BARAT               | POLDA JABAR SUBBID PAMINAL     | KASUBBID SUBBIDPAMINAL BIDPROPAM POLDA JABAR                        |
| UNIT 1 SUBBID PAMINAL POLDA JAWA BARAT          | UNIT 1 SUBBID PAMINAL POLDA JAWA BARAT | KANIT 1 SUBBIDPAMINAL BIDPROPAM POLDA JABAR — {nama pejabat} |
| UNIT 2 SUBBID PAMINAL POLDA JAWA BARAT          | UNIT 2 SUBBID PAMINAL …        | KANIT 2 SUBBIDPAMINAL BIDPROPAM POLDA JABAR — {nama pejabat}        |
| UNIT 3 SUBBID PAMINAL POLDA JAWA BARAT          | UNIT 3 SUBBID PAMINAL …        | KANIT 3 SUBBIDPAMINAL BIDPROPAM POLDA JABAR — {nama pejabat}        |
| UR PRODOK SUBBID PAMINAL POLDA JAWA BARAT       | UR PRODOK …                    | KAUR PRODOK SUBBIDPAMINAL BIDPROPAM POLDA JABAR — {nama pejabat}    |
| UR BINPAM SUBBID PAMINAL POLDA JAWA BARAT       | UR BINPAM …                    | KAUR BINPAM SUBBIDPAMINAL BIDPROPAM POLDA JABAR — {nama pejabat}    |
| UR LITPERS SUBBID PAMINAL POLDA JAWA BARAT      | UR LITPERS …                   | KAUR LITPERS SUBBIDPAMINAL BIDPROPAM POLDA JABAR — {nama pejabat}   |

**Catatan**: nama pejabat ASTINA dinamis (LUKMAN HAKIM S.H., M.H., dst) — didapat runtime dari `/tujuan_disposisi/tujuan/{id}`. Payload POST pakai UUID (bukan nama). Jadi mapping harus:
1. SIMONDU pilih "UNIT 1" → cari di ASTINA tujuan list yang name-nya mengandung "KANIT 1" → ambil UUID → kirim POST.
2. Kalau ada beberapa pejabat KANIT 1 (tidak lazim), user pilih.

## 7. Roadmap (prioritas)

### 🔴 P0 — untuk melengkapi sync balik ASTINA
- Selesaikan wiring `submitAndNext` untuk source ASTINA (call `/api/astina/surat/{id}/disposisi`)
- Unit picker source-aware:
  - Gajamada → pakai `reference.units` (SIMONDU)
  - ASTINA → pakai response `tujuan_disposisi/tujuan` (list Kanit/Kaur dengan UUID)
- Note preset multi-select untuk ASTINA (16 opsi)
- Confirmation modal sebelum sync

### 🟠 P1 — UX improvements
- Hapus kolom list, prev/next di bawah (permintaan user terakhir)
- Sync Center dashboard: view `sync_logs` collection dengan filter status + retry
- Bulk disposisi (multi-select checkbox)
- Unit mapping table di Master Unit (`alias_gajamada`, `alias_astina_pattern`)
- Optimistic UI + undo-30-detik

### 🟡 P2 — Enhancement
- AI ringkasan PDF (Gemini) untuk surat ASTINA panjang
- Two-way sync watcher (cron 5 menit polling)
- Draft disposisi (approval workflow)
- Keyboard shortcuts (↑/↓/Enter/1-4)
- Sticky Lembar Disposisi form

### 🟢 P3 — Nice-to-have
- Statistik dashboard (jumlah disposisi per unit per hari)
- Export laporan bulanan
- Filter/search di daftar surat
- Dark mode
- Mobile responsive

## 8. Known Issues & Gotchas

1. **Zimbra password** = `Candra8704` (TANPA underscore). Versi `Candra_8704` gagal auth. Sudah di `.env`.
2. **Zimbra IMAP disabled per-account** untuk beberapa user. Auto-login SEKARANG pakai SOAP dulu (fixed).
3. **ASTINA `disposisi_case_position` di Gajamada** pakai `POLDA JABAR SUBBID PAMINAL` (bukan `KASUBBID PAMINAL POLDA JAWA BARAT`). Sudah di-handle via `KASUBBID_UNIT_ALIASES` di `lib/units.js`.
4. **ASTINA POST `/proses_dispo`** tidak return error kalau `tujuan` kosong — cek `body.status === true` untuk konfirmasi. `custom` bisa `[]`.
5. **Content-Security-Policy** untuk iframe PDF: sudah di-set `frame-ancestors *` di `next.config.js`.
6. **ASTINA session per-Node-process** — direstart, session di-load dari Mongo. Kalau Mongo down, harus login ulang (~11s).
7. **`astina-sync.js` (headless Playwright)** = jalur legacy fragile. Sudah di-supersede oleh POST `/proses_dispo`. Jangan dipakai lagi setelah wiring baru selesai.
8. **CAPTCHA cost** — tiap login pertama panggil Gemini 2.5 Flash Vision (~2¢/login). Session cache 6 jam mengurangi banyak.

## 9. File Structure (relevant)

```
/app/
├── backend/
│   ├── server.py          # FastAPI reverse-proxy
│   ├── requirements.txt
│   └── .env               # MONGO_URL, DB_NAME (simondu)
├── frontend/
│   ├── app/
│   │   ├── page.js        # Main SIMONDU app (2364 baris)
│   │   ├── astina/
│   │   │   └── page.js    # Dedicated ASTINA dashboard
│   │   └── api/
│   │       └── [[...path]]/route.js  # All business logic (1780 baris)
│   ├── lib/
│   │   ├── astina-auth.js       # Login + OTP + session cache
│   │   ├── astina-client.js     # ASTINA HTTP client (getSurat, postDisposisi, ...)
│   │   ├── astina-sync.js       # LEGACY headless playwright (deprecate)
│   │   ├── gajamada.js          # Gajamada eBdesk client
│   │   ├── db.js                # MongoDB helper
│   │   ├── auth.js              # SIMONDU JWT
│   │   └── units.js             # KASUBBID_UNIT_ALIASES, CHILD_UNITS
│   └── .env               # ASTINA/Zimbra/Gajamada creds + LLM key
└── memory/
    ├── PRD.md
    ├── PROGRESS.md        # this file
    └── test_credentials.md
```

## 10. Change Log

- **2026-02-05 (session 3)** — HAR ASTINA disposisi tertangkap. Endpoint `/proses_dispo` + client `postDisposisi()` ditambah. Backend `/api/astina/surat/{id}/disposisi` ready. UI wiring pending.
- **2026-02-05 (session 2)** — Layout 2-panel: list kiri + info+pdf/kronologi+timeline tengah + lembar disposisi kanan. Timeline source-aware.
- **2026-02-05 (session 2)** — Gajamada credentials ditambah, unit alias fix (`POLDA JABAR SUBBID PAMINAL`). 5 kasus Gajamada muncul di antrian.
- **2026-02-05 (session 1)** — P0 SOAP-first OTP, P1 Mongo session cache, P2 attachment proxy. First-time working end-to-end (~11s auto-login).
- **2026-02-05 (session 1)** — Repo `Kilodash/SIMONDU_WEB` di-pull ke `/app`. Next.js 15 + FastAPI proxy + MongoDB setup. Kredensial ASTINA/Zimbra/Gajamada di-populate.

## 11. Development Notes

### Menjalankan lokal
- Semua service via supervisor: `sudo supervisorctl status`
- Restart: `sudo supervisorctl restart frontend|backend`
- Logs: `tail -f /var/log/supervisor/frontend.err.log`
- Environment: modif `.env` → supervisor restart frontend/backend

### Testing manual
```bash
# Login SIMONDU + get session cookie
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"kasubbid","password":"kasubbid123"}' \
  -c /tmp/cookies.txt

# List antrian
curl -b /tmp/cookies.txt http://localhost:8001/api/disposisi-queue

# ASTINA disposisi (setelah ada wiring)
curl -b /tmp/cookies.txt -X POST \
  http://localhost:8001/api/astina/surat/{SURAT_ID}/disposisi \
  -H "Content-Type: application/json" \
  -d '{"notes":["CATAT/DATAKAN/FILE"],"tujuan":["{UUID_KANIT}"],"custom":[]}'
```

### Reverse-engineering endpoint baru
Kalau butuh endpoint baru dari ASTINA:
1. Login ke webmail ASTINA di browser
2. Buka DevTools → Network → clear
3. Lakukan aksi (mis. disposisi surat)
4. Right-click di request → Save all as HAR
5. Kirim ke agent → parse untuk dapat URL + payload + response shape

### LLM budget monitoring
- Emergent LLM key di `EMERGENT_LLM_KEY`. Cek balance di Emergent profile.
- Captcha solving konsumsi ±1 request Gemini 2.5 Flash per login pertama (cache 6 jam).
- Kalau habis, user diarahkan ke Emergent Profile → Universal Key → Add Balance.

---

*Update file ini setelah setiap feature/bugfix. Tulis apa yang berubah, kenapa, dan next step.*
