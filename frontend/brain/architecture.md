---
slug: architecture
title: System architecture
role: system architecture
updated: "2026-07-04T19:02:33"
---

# System architecture

## High-level architecture

`mermaid
graph TD
    subgraph "Browser (SPA)"
        A[LoginPage]
        B[AppShell]
        C[Dashboard ANEV]
        D[CasesList]
        E[DisposisiPage]
        F[CaseDetail Sheet]
        G[MasterUnit / SatkerSatwil / NumberingSettings]
    end

    subgraph "Next.js 15 App Router"
        H[catch-all API route<br/>app/api/[`...path`]/route.js]
        I[auth.js ? JWT session]
        J[db.js ? Supabase abstraction layer]
        K[gajamada.js ? external API client]
        L[checklist.js ? SOP document logic]
        M[units.js ? master unit constants]
    end

    subgraph "External"
        N[Gajamada eBdesk Fusion<br/>gajamada-propam.polri.go.id]
    end

    subgraph "Supabase"
        O[(PostgreSQL)]
        P[Storage bucket<br/>case-followup-documents]
    end

    A --> B
    B --> C
    B --> D
    B --> E
    B --> F
    B --> G
    B --> H
    H --> I
    H --> J
    H --> K
    H --> L
    H --> M
    J --> O
    H --> P
    K --> N
`

## Module boundaries

| Module | Location | Responsibility |
|---|---|---|
| Client SPA | pp/page.js (1657 lines) | All UI: login, dashboard, CasesList, disposisi queue, case detail sheet, master data CRUD |
| API handler | pp/api/[...path]/route.js (892 lines) | Catch-all HTTP endpoint: auth, CRUD, Gajamada proxy, sync |
| Auth | lib/auth.js | JWT session via jose, hardcoded MVP user list, cookie management |
| Database abstraction | lib/db.js | MongoDB-style collection API (find/findOne/insertOne/updateOne/deleteOne) over Supabase PostgreSQL |
| Supabase admin | lib/supabase-admin.js | Service-role client initialization, storage bucket management |
| Gajamada client | lib/gajamada.js | Session-managed REST client for eBdesk Fusion: login, listCases, getCase, upload, pushUpdate, timeline |
| Checklist engine | lib/checklist.js | SOP-based document type definitions, active-stage computation, progress/readiness checks |
| Unit constants | lib/units.js | Paminal hierarchy: Kasubbid parent + 7 child units, derived status labels, category options |
| UI components | components/ui/ | shadcn/ui (Radix primitives + Tailwind) ? 48 component files |
| Hooks | hooks/ | use-mobile, use-toast |

## Data flow pattern

All server interactions go through a single fetch helper (pi() in page.js) ? catch-all API route ? Supabase (via db.js) or Gajamada (via gajamada.js). The API route enriches Gajamada case data with internal Supabase records (dispositions, timelines, documents, checklist) in enrichCase(). Background sync to Gajamada is fire-and-forget via setTimeout.

## Key architectural decisions

- **Single-file SPA** ? all React components in pp/page.js; no Next.js page routing (uses internal tab state). Chosen for rapid MVP delivery.
- **Catch-all API route** ? all backend logic in one file (oute.js). Simplifies deployment; acceptable for internal tool with <10 users.
- **MongoDB-to-Supabase migration** ? the initial version used MongoDB (Mongoose-style); migrated to Supabase PostgreSQL with a thin compatibility layer (SupabaseCollection / SupabaseQuery) that mimics MongoDB collection methods. See [[mongo-to-supabase-migration]].
- **Hardcoded auth** ? no database user table; credentials stored in uth.js constants. Explicitly marked as MVP limitation.
- **Gajamada as source of truth** ? complaint data lives in Gajamada; SIMONDU only stores operational overlay (dispositions, documents, checklist, sync logs). No case data duplication.
