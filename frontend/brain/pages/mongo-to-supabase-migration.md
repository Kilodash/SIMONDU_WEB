---
id: mongo-to-supabase-migration
title: Migrate from MongoDB to Supabase
category: decision
status: active
created: "2026-07-04T19:06:02"
updated: "2026-07-04T19:06:15"
---

## compiled_truth

## What was decided

Migrate the database backend from MongoDB (self-hosted or Atlas) to **Supabase PostgreSQL**. The migration preserved the MongoDB collection-like query API through a thin compatibility layer in \lib/db.js\ (\SupabaseCollection\, \SupabaseQuery\).

## Alternatives considered

- **Stay on MongoDB** ? simpler query model but required separate hosting; no managed storage for file uploads
- **Migrate to raw Supabase SDK** ? would have required rewriting every query across the codebase; the compatibility layer was a pragmatic middle ground

## Rationale

- Supabase provides managed PostgreSQL + Storage (file uploads) in one platform
- Free tier sufficient for internal tool scale (~7 users, <10K records)
- The compatibility layer (\SupabaseCollection\ mimicking \ind\/\indOne\/\insertOne\/\updateOne\/\deleteOne\) minimized code churn ? the rest of the codebase was already written against a MongoDB-style API
- RLS (Row Level Security) enabled for future multi-tenant use

## Blast radius

- All 13 tables migrated ? the SQL schema lives in \supabase_migration.sql\
- File storage moved from wherever MongoDB stored files to Supabase Storage bucket \case-followup-documents\
- The \getDb()\ singleton in \lib/db.js\ auto-seeds \units_master\ on first call
- The MongoDB-style \$in\ operator is supported via Supabase \.in()\ method
- \upsert\ with \$setOnInsert\ implemented as read-then-write pattern

## Related pages

- [[single-file-spa-architecture]]
- [[gajamada-source-of-truth]]


## timeline

- time: 2026-07-04T19:06:02
  kind: decision
  summary: "Created this page: Migrate from MongoDB to Supabase"
  source: git log / code analysis
  affects: [mongo-to-supabase-migration]

- time: 2026-07-04T19:06:15
  kind: decision
  summary: Initial capture from project analysis
  source: "code + git log"
  affects: [mongo-to-supabase-migration]
