---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-07-04T19:03:56"
---

# Roadmap

## Roadmap

```mermaid
gantt
    title SIMONDU WEB Development Timeline
    dateFormat  YYYY-MM-DD
    axisFormat  %b %Y

    section MVP (Done)
    MongoDB prototype              :done, m1, 2024-09-01, 2024-10-15
    Supabase migration             :done, m2, 2024-10-15, 2024-11-01
    Core features (dashboard, cases, disposisi) :done, m3, 2024-11-01, 2024-12-15
    Checklist engine + document upload :done, m4, 2024-12-15, 2025-01-15
    Perdamaian module              :done, m5, 2025-01-15, 2025-02-01
    UI cleanup                     :done, m6, 2025-02-01, 2025-02-15

    section Production Hardening (Planned)
    Proper auth (DB users, password hash) :p1, after m6, 30d
    Multi-tenant Polda support     :p2, after p1, 45d
    Real-time sync (webhook/queue) :p3, after p2, 30d
    Integration tests              :p4, after p1, 30d
    CI/CD pipeline                 :p5, after p1, 15d
```

## Current state

**MVP deployed and operational.** The application is in active use by Subbid Paminal Polda Jabar personnel for daily case management. All core workflows (listing, disposition, checklist, settlement, sync) are functional.

## Known limitations (low-confidence ??? confirm with team)

- **Hardcoded credentials** ??? user accounts in `auth.js`; no password change, no account provisioning UI
- **No integration tests** ??? only a Python smoke test (`backend_test.py`); manual testing only
- **Single Polda deployment** ??? filtered to `POLDA JAWA BARAT` in Gajamada queries; would need multi-tenancy for other regions
- **Fire-and-forget sync** ??? background sync has no retry queue; failures are only visible in sync_logs viewer
- **No monitoring/alerting** ??? no health checks, no error alerting, no uptime tracking
- **Single-file monolith** ??? `page.js` (1657 lines) and `route.js` (892 lines) would benefit from decomposition before adding features
