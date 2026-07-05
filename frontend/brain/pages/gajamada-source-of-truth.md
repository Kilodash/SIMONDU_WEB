---
id: gajamada-source-of-truth
title: Gajamada as source of truth for complaint data
category: decision
status: active
created: "2026-07-04T19:08:10"
updated: "2026-07-04T19:10:01"
---

## compiled_truth

## What was decided

**Gajamada (eBdesk Fusion) is the authoritative source for all complaint data.** SIMONDU does not duplicate case records ??? it only stores operational overlay data (dispositions, timelines, documents, checklist status, sync logs) in Supabase.

## How it works

- All case queries (listing, detail, attachments, timeline) go through `lib/gajamada.js` which calls the Gajamada REST API
- The API route's `enrichCase()` merges Gajamada case data with internal Supabase records to produce a unified view
- Mutations (dispositions, document uploads, outcomes, completions) are stored locally in Supabase and asynchronously pushed back to Gajamada via `backgroundSync()`
- Gajamada session management: login -> cookie -> validate -> re-login on 401 ??? handled transparently by `ensureSession()`

## Rationale

- Gajamada is the national police complaints platform ??? it is the system of record by policy, not technical choice
- Data duplication would create consistency risks (which system has the latest status?)
- SIMONDU's value-add is the operational workflow layer (disposition routing, SOP checklists, settlement management) that Gajamada does not provide
- Bidirectional sync ensures Gajamada stays current with internal actions

## Constraints

- Gajamada API is not publicly documented ??? endpoints and payload shapes were reverse-engineered from the Gajamada frontend
- The API requires a service account (GAJAMADA_USERNAME/PASSWORD) with session cookie auth
- Gajamada has no webhook ??? SIMONDU must poll for new cases and push updates
- Gajamada query filters are limited to `is`/`is one of`/`is not one of` operators
- Case queries always filter to `POLDA JAWA BARAT` (hardcoded in `listCases()`)

## Related

- [[mongo-to-supabase-migration]]


## timeline

- time: 2026-07-04T19:08:10
  kind: decision
  summary: "Created this page: Gajamada as source of truth for complaint data"
  source: code analysis
  affects: [gajamada-source-of-truth]

- time: 2026-07-04T19:08:25
  kind: decision
  summary: Initial capture from code analysis
  source: code analysis
  affects: [gajamada-source-of-truth]

- time: 2026-07-04T19:10:01
  kind: decision
  summary: Remove broken link to background-sync-pattern
  source: lint fix
  affects: [gajamada-source-of-truth]
