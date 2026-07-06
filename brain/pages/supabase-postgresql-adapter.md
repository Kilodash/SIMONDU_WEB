---
id: supabase-postgresql-adapter
title: Supabase PostgreSQL via MongoDB-style adapter
category: decision
status: active
created: "2026-07-06T14:33:55"
updated: "2026-07-06T14:34:25"
---

## compiled_truth

## Keputusan

Simpan semua data overlay operasional di **Supabase PostgreSQL**, diakses melalui `lib/db.js` adapter yang meniru API collection ala MongoDB (`find`, `findOne`, `insertOne`, `updateOne`, `countDocuments`). Tidak menggunakan MongoDB native driver untuk data operasional.

## Sejarah

Sempat mencoba MongoDB (`[[mongodb-over-supabase]]`), lalu dikembalikan ke Supabase. Migrasi terakhir dicatat di commit `fbfcd6e`.

## Alasan

- **Supabase managed**: Tidak perlu maintain MongoDB instance sendiri. Supabase menyediakan PostgreSQL terkelola + Storage + Row Level Security.
- **Adapter pattern**: `lib/db.js` mentranslasikan sintaks MongoDB-style ke PostgREST calls. Route handler (`route.js`) tidak perlu diubah ??? cukup ganti driver layer.
- **Schema enforced**: Tabel PostgreSQL lebih mudah di-query dan di-migrasi dibanding dokumen MongoDB yang schema-less.
- **Single vendor**: Supabase Storage sudah dipakai untuk upload file. Satu project Supabase untuk data + storage = lebih sederhana.

## Alternatif

- MongoDB Atlas (tried ??? reversed, documented in `[[mongodb-over-supabase]]`)
- Supabase + Prisma ORM (overkill untuk ~20 tabel sederhana)
- Raw PostgREST tanpa adapter (breaking change di route.js)

## Adapter Design

`db.js` mengekspos:
- `getDb()` ??? `{ collection(name): SupabaseCollection }`
- `SupabaseCollection.find(filter, opts)` ??? `SupabaseQuery` (lazy, chainable `.sort()`, `.limit()`, `.toArray()`)
- `SupabaseCollection.findOne(filter, opts)` ??? single row atau null
- `SupabaseCollection.insertOne(doc)` / `insertMany(docs)`
- `SupabaseCollection.updateOne(filter, update, { upsert })` ??? read-then-write untuk upsert karena PostgREST tidak mendukung native upsert
- `SupabaseCollection.countDocuments(filter)` ??? pakai `select('*', { count: 'exact', head: true })`

## Blast Radius

- **Upsert non-atomic**: `updateOne` dengan `upsert: true` pakai pattern read-then-write (bukan `INSERT ON CONFLICT`), rentan race condition
- **Dual dependency**: `@supabase/supabase-js` untuk data, Supabase Storage untuk file. Kalau Supabase project down ??? keduanya mati
- **mongodb driver masih ter-install**: `npm ls mongodb` menunjukkan v7.4 masih ada di `package.json`, tapi tidak dipakai di `db.js`


## timeline

- time: 2026-07-06T14:33:55
  kind: decision
  summary: "Created this page: Supabase PostgreSQL via MongoDB-style adapter"
  source: "code review: db.js"
  affects: [supabase-postgresql-adapter]

- time: 2026-07-06T14:34:25
  kind: decision
  summary: "Captured from code review: Supabase PostgreSQL via MongoDB-style adapter in db.js"
  source: "code review: db.js, git log"
  affects: [supabase-postgresql-adapter]
