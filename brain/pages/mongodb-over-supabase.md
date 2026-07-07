---
id: mongodb-over-supabase
title: MongoDB menggantikan Supabase PostgreSQL
category: decision
status: archived
created: "2026-07-06T10:27:31"
updated: "2026-07-06T14:33:51"
updated: "2026-07-07T20:22:57"
---


## compiled_truth

# Keputusan: MongoDB ke Supabase

Migrasi dari MongoDB ke Supabase PostgreSQL menggunakan adapter `lib/db.js`. Keputusan dibuat untuk mengurangi biaya hosting (Supabase free tier vs MongoDB Atlas).

**Alternatif**: Tetap MongoDB Atlas, SQLite, PlanetScale.

**Keputusan**: Supabase PostgreSQL dengan adapter MongoDB-compatible.

**Dampak**: [[supabase-postgresql-adapter]] dibuat untuk mencegah rewrite seluruh codebase. Collection mapping: local_cases, dispositions, units_master, sync_logs, audit_logs, astina_sessions, user_credentials.


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

- time: 2026-07-07T20:22:57
  kind: decision
  summary: Migration rationale details
  source: "git log + code"
  affects: [mongodb-over-supabase]
