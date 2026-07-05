---
id: hardcoded-mvp-auth
title: Hardcoded user credentials for MVP auth
category: decision
status: active
created: "2026-07-04T19:08:11"
updated: "2026-07-04T19:08:39"
---

## compiled_truth

## What was decided

User authentication uses **hardcoded credentials** stored in \lib/auth.js\ with JWT session cookies (signed via \jose\ HS256). No database user table exists. Passwords are plaintext in the source code.

## Current users

8 hardcoded MVP accounts covering the Paminal hierarchy:
- \kasubbid\ / \dmin\ ? full access (unit CRUD, disposisi, all views)
- \unit1\ through \unit3\ ? Kanit 1/2/3 (restricted to own unit's cases)
- \urbinpam\ / \urlitpers\ / \urprodok\ ? Ur Binpam/Litpers/Prodok (restricted to own unit)

## Role-based access control

| Role | Permissions |
|---|---|
| \kasubbid\ / \dmin\ | Full access: all views, unit CRUD, disposisi, master data, sync |
| \unit\ | Dashboard (filtered to own unit), case list (own unit only), case detail with checklist/document management |

## Rationale

- **MVP speed** ? zero setup; no registration flow, no password hashing, no user management UI
- **Internal tool** ? deployed within police intranet; physical access control is the primary security layer
- **<10 users** ? all known, all internal personnel

## Known risks (explicitly deferred)

- Passwords in source code ? exposed in git history, any developer can read them
- No password rotation / expiration
- No session revocation (JWT valid for 7 days)
- No brute-force protection on login endpoint
- \APP_JWT_SECRET\ defaults to hardcoded dev value if env var missing

## Migration path

When production hardening is needed: replace \USERS\ array with a \users\ table in Supabase, add bcrypt/argon2 hashing, implement password reset flow, and add a user management page to the app.

## Related

- [[gajamada-source-of-truth]]
- [[single-file-spa-architecture]]


## timeline

- time: 2026-07-04T19:08:11
  kind: decision
  summary: "Created this page: Hardcoded user credentials for MVP auth"
  source: code analysis
  affects: [hardcoded-mvp-auth]

- time: 2026-07-04T19:08:39
  kind: decision
  summary: Initial capture from code analysis
  source: code analysis
  affects: [hardcoded-mvp-auth]
