---
id: mongodb-over-supabase
title: MongoDB menggantikan Supabase PostgreSQL
category: decision
status: archived
created: "2026-07-06T10:27:31"
updated: "2026-07-06T14:33:51"
---

## compiled_truth

## Keputusan

Database diganti dari Supabase (PostgreSQL) ke MongoDB native driver. Schema migration file `supabase_migration.sql` (13 tabel) masih ada di repo, tapi tidak digunakan. Kode membaca `process.env.MONGO_URL` untuk koneksi MongoDB.

## Alasan

Dokumen semi-structured (disposisi, checklist, timelines) lebih natural di MongoDB. Tidak perlu migration schema setiap ada field baru. Setup lebih sederhana (tidak perlu Supabase project + API key). Thin wrapper di `lib/db.js` meniru pattern `collection().find().sort().toArray()` yang familiar.

## Blast Radius

- **No transactions**: Operasi multi-dokumen tidak atomik
- **No migrations**: Schema evolves organically, tidak ada versioning
- **Supabase lib masih ter-install**: `@supabase/supabase-js` di dependencies tapi hanya digunakan untuk Storage upload
- **Dual storage**: Supabase Storage untuk file, MongoDB untuk data ??? dua sistem berbeda


## timeline

- time: 2026-07-06T10:27:31
  kind: decision
  summary: "Created this page: MongoDB menggantikan Supabase PostgreSQL"
  source: code review
  affects: [mongodb-over-supabase]

- time: 2026-07-06T10:28:05
  kind: decision
  summary: "Captured from code: MongoDB replaced Supabase PostgreSQL"
  source: code review
  affects: [mongodb-over-supabase]

- time: 2026-07-06T14:33:51
  kind: reversal
  summary: "Migration reversed: MongoDB was replaced back by Supabase PostgreSQL via db.js adapter. Latest commit 'fbfcd6e feat: migrasi MongoDB ke Supabase' confirms the reversal."
  source: brain archive-page
  affects: [mongodb-over-supabase]
