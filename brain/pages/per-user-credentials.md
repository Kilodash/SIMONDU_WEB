---
id: per-user-credentials
title: Migrasi kredensial global ke per-user
category: decision
status: active
created: "2026-07-06T10:27:32"
updated: "2026-07-06T10:28:06"
---

## compiled_truth

## Keputusan

Setiap SIMONDU user (kasubbid, unit) memiliki kredensial Gajamada dan ASTINA sendiri, disimpan di koleksi MongoDB `user_credentials`, bukan di environment variables global. Setiap API call ke Gajamada/ASTINA menggunakan kredensial user yang sedang login.

## Alternatif

- Tetap gunakan env vars global (satu akun untuk semua)
- OAuth/SSO dengan Gajamada/ASTINA (tidak mungkin ??? tidak ada OAuth endpoint)

## Status

**In Progress** ??? `lib/gajamada.js` dan `lib/astina-auth.js` sudah di-refactor untuk session per-user. API endpoint `GET/POST /api/user/credentials` sudah ditambahkan. UI Pengaturan sedang diubah jadi form login kredensial.

## Alasan

Unit berbeda memiliki akses ke subset data berbeda di Gajamada. Menggunakan satu akun bersama menghasilkan data yang tidak terfilter per unit. Per-user credentials memungkinkan setiap unit melihat hanya kasus yang relevan dengan unit mereka.

## Blast Radius

- **Kredensial di MongoDB**: Plaintext storage (untuk MVP, sama seperti env vars sebelumnya)
- **Session management**: Setiap user punya session Gajamada/ASTINA terpisah ??? memory usage naik
- **Compatibility**: Fallback ke env vars untuk endpoint yang berjalan tanpa user context (background sync)


## timeline

- time: 2026-07-06T10:27:32
  kind: decision
  summary: "Created this page: Migrasi kredensial global ke per-user"
  source: ongoing work
  affects: [per-user-credentials]

- time: 2026-07-06T10:28:06
  kind: decision
  summary: "Captured ongoing work: migrating from global env-var credentials to per-user credentials"
  source: ongoing work
  affects: [per-user-credentials]
