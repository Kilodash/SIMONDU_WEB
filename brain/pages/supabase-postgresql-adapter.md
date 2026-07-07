---
id: supabase-postgresql-adapter
title: Supabase PostgreSQL via MongoDB-style adapter
category: decision
status: active
created: "2026-07-06T14:33:55"
updated: "2026-07-06T14:34:25"
updated: "2026-07-07T20:22:22"
---


## compiled_truth

# Keputusan: Supabase PostgreSQL via MongoDB Adapter

Database Supabase PostgreSQL diakses via adapter `lib/db.js` yang menerjemahkan MongoDB-style API (`find`, `findOne`, `insertOne`, `updateOne`, `deleteOne`) ke PostgREST filters. Operator MongoDB (`$in`, `$ne`, `$gt`) di-translate ke query string PostgREST.

**Alasan**: Migrasi dari MongoDB tanpa rewrite seluruh codebase. Supabase managed PostgreSQL gratis.

**Konsekuensi**: Query kompleks terbatas, tidak bisa aggregation pipeline, terjemahan tidak 100% akurat.


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

- time: 2026-07-07T20:22:22
  kind: decision
  summary: Supabase PostgreSQL adapter details
  source: code analysis
  affects: [supabase-postgresql-adapter]
