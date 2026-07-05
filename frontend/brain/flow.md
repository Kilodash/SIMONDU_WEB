---
slug: flow
title: Key flows
role: key flows
updated: "2026-07-04T19:03:03"
---

# Key flows

## End-to-end complaint lifecycle

`mermaid
sequenceDiagram
    participant G as Gajamada
    participant S as SIMONDU API
    participant DB as Supabase
    participant U as User (Kasubbid/Unit)

    Note over G: Public complaint arrives in Gajamada

    U->>S: GET /cases (list)
    S->>G: listCases (filtered to Paminal scope)
    G-->>S: case list (status, category, etc.)
    S->>DB: batch query internal data (dispositions, timelines, docs)
    DB-->>S: enrichment data
    S-->>U: enriched case list with derived_status

    Note over U: Kasubbid reviews, opens Disposisi queue

    U->>S: GET /disposisi-queue
    S->>G: listCases (units = [KASUBBID PAMINAL])
    S->>DB: filter out already-disposisied
    S-->>U: queue of undisposisied cases

    U->>S: POST /disposisi-bulk
    S->>DB: insert dispositions
    S-->>U: success
    S-->>G: backgroundSync (fire-and-forget pushUpdate)

    Note over U: Unit officer opens case, works checklist

    U->>S: POST /cases/:pid/checklist/:docType
    S->>DB: upsert followup_checklist row
    S-->>U: updated checklist status

    U->>S: POST /cases/:pid/documents (multipart)
    S->>DB: insert followup_documents
    S->>DB: upload to Supabase Storage
    S->>G: uploadFile + attachToReport (Gajamada storage)
    S-->>U: document URL

    Note over U: Unit selects outcome (hasil_lidik + settlement)

    U->>S: POST /cases/:pid/outcome
    S->>DB: upsert case_outcomes
    S-->>U: updated outcome
    S-->>G: backgroundSync

    Note over U: All checklist items complete ? mark Selesai

    U->>S: POST /cases/:pid/complete
    S->>DB: insert completions
    S-->>U: success
    S-->>G: backgroundSync (pushes final status)
`

## Key flows

1. **Case listing** ? Gajamada is always queried first (source of truth); results batch-enriched with Supabase overlay
2. **Disposisi** ? Kasubbid routes undisposisied cases to child units; disposition creates internal record + triggers background Gajamada sync
3. **Checklist workflow** ? 5 stages (perencanaan, pelaksanaan, tindak_lanjut, cabang_terbukti, cabang_tidak_terbukti) with conditional branches based on hasil_lidik outcome
4. **Perdamaian** ? special settlement path with 10-item checklist (material/prinsip/formil) before status change
5. **Background sync** ? every mutation (disposition, document upload, outcome, completion) fires fire-and-forget setTimeout ? backgroundSync that pushes current state to Gajamada via gateway API; results logged in sync_logs
6. **Document dual-upload** ? files uploaded to both Supabase Storage (internal access) and Gajamada (compliance)
