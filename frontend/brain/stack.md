---
slug: stack
title: Tech stack & architecture
role: tech-stack choices
updated: "2026-07-11"
---

# Tech stack

## Technology stack

| Domain | Choice | Rationale |
|---|---|---|
| Runtime / Framework | Next.js 15.5 (App Router) | React SSR framework; standalone output mode for easy deployment |
| UI library | React 18.3 | Component model; large ecosystem |
| Styling | Tailwind CSS 3.4 + tailwindcss-animate | Utility-first CSS; component consistency via shadcn/ui |
| Component primitives | Radix UI (20+ packages) | Unstyled, accessible headless components; shadcn/ui foundation |
| Icons | Lucide React | Consistent icon set; tree-shakeable |
| Charts | Recharts | Declarative React charting for ANEV dashboard (Bar, Pie) |
| Forms | react-hook-form 7 + zod 3 (validation) | Performant form management; schema validation |
| Data fetching | SWR 2 + TanStack React Query 5 | Caching and revalidation (though mostly manual fetch in current code) |
| Tables | TanStack React Table 8 | Headless table for CasesList |
| Database | Supabase (PostgreSQL) | Managed Postgres with storage, RLS; free tier sufficient for MVP |
| Auth (server) | jose 5 (JWT signing/verification) | Zero-dependency JWT library; HS256 symmetric signing |
| HTTP client (server) | Native fetch | No external HTTP client needed; Gajamada calls use raw fetch |
| Date handling | date-fns 4 + dayjs 1 | Server and client date formatting |
| Motion | Framer Motion 11 | Carousel animations (embla-carousel-react) |
| Toast notifications | Sonner 2 | Lightweight toast library |
| Package manager | Yarn 1.22 | Locked via packageManager field |
| Deployment | Standalone Node.js output | output: 'standalone' in next.config.js |

## Environment variables

| Variable | Purpose |
|---|---|
| GAJAMADA_BASE_URL | eBdesk Fusion API base (default: gajamada-propam.polri.go.id) |
| GAJAMADA_USERNAME / GAJAMADA_PASSWORD | Service account for Gajamada login (env vars + DB override) |
| GAJAMADA_APP_ID / GAJAMADA_CONNECTION_ID / GAJAMADA_DATABASE | Gajamada dashboard/connection identifiers |
| GAJAMADA_UPDATE_GATEWAY_ID / GAJAMADA_ATTACH_GATEWAY_ID | Gajamada gateway endpoints for push updates and file attachments |
| SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY | Supabase project URL and admin key |
| APP_JWT_SECRET | JWT signing secret (defaults to dev placeholder) |

## Database schema

Tables in Supabase PostgreSQL (see supabase_migration.sql):

| Table | Purpose |
|---|---|
| dispositions | Distribusi kasus dari Kabid/Yanduan ke unit |
| status_history | Perubahan status dari Gajamada |
| timelines | Catatan tindak lanjut internal |
| sync_logs | Log sinkronisasi ke Gajamada (success/failed) |
| audit_logs | Audit trail semua aksi user |
| units_master | Katalog unit dari Gajamada + manual |
| completions | Kasus yang ditandai selesai |
| followup_checklist | Checklist dokumen wajib per kasus |
| case_outcomes | Hasil lidik, pelimpahan, resolusi |
| satker_satwil | DEPRECATED - digantikan unit_mapping |
| local_cases | Kasus input manual/laporan informasi |
| unit_mapping | Mapping Gajamada external_name → SIMONDU internal_unit |
| saran_yanduan | Saran/masukan dari Yanduan ke Kabid |
| status_mapping | Mapping eksplisit Gajamada status → SIMONDU display |
| app_settings | Key-value runtime config (Gajamada credentials, etc.) |
| users | Akun pengguna (username, password plaintext, role) |

## Architecture

### Status Flow

#### Pull (Gajamada → SIMONDU)
`deriveStatus()` — lookup `STATUS_LOOKUP` (17 exact matches) + fallback substring matching for dynamic statuses.

| Gajamada Label | SIMONDU Display |
|---|---|
| Laporan Diterima / Laporan Masuk | Diterima |
| Laporan Diterima Kasubbid Paminal | Proses Subbid Paminal |
| Laporan Dikirim ke Polres | Dilimpahkan ke Polres |
| Gelar Perkara | Gelar Perkara Paminal |
| Hasil Sidang Disiplin | Hasil Sidang Disiplin |
| Selesai / Terbukti / Tidak Terbukti | Selesai |
| Perdamaian / Restorative Justice | Perdamaian |
| Lidik | Dalam Proses |

#### Push (SIMONDU → Gajamada)
`toGajamadaStatus(internalStatus, casePosition)` — maps internal status + case_position to Gajamada label dynamically.

Contoh: `PENYELIDIKAN_PAMINAL` + `KASIPROPAM POLRES KARAWANG...` → `Laporan Diterima KASIPROPAM POLRES KARAWANG POLDA JAWA BARAT`

### Unit Mapping

`unit_mapping` collection (150 entries): Gajamada `external_name` → SIMONDU `internal_unit`.

| Grup | Entries |
|---|---|
| SUBBID PAMINAL | 7 (KASUBBID, UNIT 1-3, UR BINPAM/PRODOK/LITPERS) |
| SUBBID PROVOS | 2 (KASUBBID, UNIT 2) |
| SUBBID WABPROF | 1 (KASUBBID) |
| SUBBAG YANDUAN | 2 (KASUBBAG, OPERATOR) |
| SUBBAG REHABPERS | 1 (KASUBBAG) |
| SAT BRIMOB | 3 (KASIPROVOS, OPERATOR SIPROVOS, SATBRIMOB POLDA) |
| WASSIDIK | 5 (DITRESKRIM UM/SUS, DITRESNARKOBA, DITRESSIBER, DITRES PPA/PPO) |
| DIVPROPAM | 1 |
| SATKER LAIN | 1 (DITLANTAS) |
| 23 Polres | 5 sub-unit each (KASIPROPAM, KANIT PAMINAL/PROVOS/WABPROF, KAUR YANDUAN) |

**Resolve priority (push):** KASUBBID/KASUBBAG > KASIPROPAM > first mapping

**Normalization:** KAUR BINPAM/PRODOK/LITPERS → UR equivalents (common PAMINAL naming variants in Gajamada)

### Disposisi Flow (Sync-First)

1. User pilih unit + isi catatan → confirm dialog (tampil case_position + fallback alternatif)
2. Klik "Ya" → backend push ke Gajamada dulu
3. Sukses → save ke local DB (dispositions, timelines, local_cases, sync_logs)
4. Gagal → return fallback list → frontend tampil retry dialog
5. DB tidak tersentuh sampai sync sukses

### Role-Based Menu

| Role | Menu |
|---|---|
| ADMIN | Dashboard, Daftar Surat, Riwayat, Master Unit, Log Sync, Audit Log, Pengaturan |
| SUBBAG YANDUAN | Dashboard, Daftar Surat, Saran/Masukan, Input Manual, Riwayat, Ubah Password |
| KABID PROPAM | Dashboard, Daftar Surat, Disposisi, Riwayat, Ubah Password |
| KASUBBID (PAMINAL/PROVOS/WABPROF) | Dashboard, Daftar Surat, Disposisi, Riwayat, Ubah Password |
| SUBBAG REHABPERS | Dashboard, Daftar Surat, Riwayat, Ubah Password |
| POLRES/BRIMOB/WASSIDIK | Dashboard, Daftar Surat, Riwayat, Ubah Password |

**Notes:**
- Tab Tindak Lanjut dihapus untuk KABID PROPAM (akan di-rebuild dari awal)
- KABID disposisi ke WASSIDIK via combobox reguler (bukan tombol khusus)
- Istilah "Limpa(s)" sudah dikoreksi menjadi "Limpah" di seluruh kode
- KABID melihat semua surat Polda Jabar di Daftar Surat
- KABID disposisi queue hanya tampil local cases (SURAT_MASUK + DISPOSISI_PIMPINAN)

### Attachment/Download

- **Thumbnail**: `mode=redirect` → redirect ke Gajamada CDN (0 RAM server)
- **Preview**: server fetch-and-stream dengan embed/iframe
- **Unduh per file**: `inline=0` → attachment disposition
- **Download semua**: open per-file via hidden link (300ms stagger)
- Session validation throttle: 30 detik cache

### Gajamada Settings

- `app_settings` table (Supabase) — runtime override untuk GAJAMADA_USERNAME/PASSWORD
- Admin bisa set via Pengaturan → Koneksi
- Fallback: environment variables
- `getBaseUrl()` — konsisten untuk semua Gajamada endpoints
