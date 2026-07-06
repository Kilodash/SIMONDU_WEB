---
id: hardcoded-mvp-auth
title: Hardcoded user credentials for MVP
category: decision
status: active
created: "2026-07-06T10:27:30"
updated: "2026-07-06T10:28:04"
---

## compiled_truth

## Keputusan

7 user didefinisikan sebagai konstanta di `lib/auth.js`: kasubbid, admin, unit1-3, urbinpam, urlitters, urprodok. Kredensial plaintext, password disimpan di source code. Tidak ada database user, tidak ada password hashing.

## Alasan

MVP dengan <10 user internal, semua personel Subbid Paminal. Setup cepat tanpa overhead manajemen user. JWT HS256 dengan `APP_JWT_SECRET` env var.

## Blast Radius

- **Keamanan**: Password di source code + git history ??? risiko tinggi
- **Tidak bisa ganti password**: Harus edit source + redeploy
- **Tidak bisa tambah user**: Harus edit source + redeploy
- **Unit hardcoded**: Mapping username-ke-unit tidak fleksibel

## Upgrade Path

Ponytail: migrasi ke database user saat kebutuhan multi-Polda atau penambahan user dinamis. Implementasi: tabel `users` dengan bcrypt hash, provisioning UI untuk Kasubbid, hapus `USERS` array dari `auth.js`.


## timeline

- time: 2026-07-06T10:27:30
  kind: decision
  summary: "Created this page: Hardcoded user credentials for MVP"
  source: code review
  affects: [hardcoded-mvp-auth]

- time: 2026-07-06T10:28:04
  kind: decision
  summary: "Captured from code: hardcoded users in auth.js for MVP"
  source: code review
  affects: [hardcoded-mvp-auth]
