---
slug: flow
title: Key flows
role: key flows
updated: "2026-07-08T10:00:00"
---

# Key flows

## Alur Disposisi (End-to-End)

Simplified flow: Yanduan terima -> Kabid disposisi -> Unit proses -> Selesai.

```mermaid
sequenceDiagram
    actor KasubbagYanduan
    actor KabidPropam
    actor Unit
    participant SIMONDU as SIMONDU Web
    participant Gajamada as Gajamada API
    participant DB as Supabase PostgreSQL

    KasubbagYanduan->>SIMONDU: Login (username/password)
    SIMONDU->>SIMONDU: JWT session cookie

    KasubbagYanduan->>SIMONDU: Buka Antrian Disposisi
    SIMONDU->>Gajamada: listCases()
    Gajamada-->>SIMONDU: Kasus dari Gajamada
    SIMONDU->>DB: Cek dispositions (sudah didisposisi?)
    SIMONDU-->>KasubbagYanduan: Queue kasus

    Note over KasubbagYanduan,SIMONDU: Yanduan terima kasus (Gajamada atau ASTINA manual input)

    KasubbagYanduan->>SIMONDU: Terima kasus
    SIMONDU->>DB: Update status via /terima (internal only, no Gajamada push)
    SIMONDU-->>KasubbagYanduan: Kasus diterima

    KasubbagYanduan->>SIMONDU: Pilih kasus + isi form disposisi ke Kabid
    SIMONDU->>DB: Insert disposition record
    SIMONDU-->>KasubbagYanduan: Disposisi tersimpan

    Note over KasubbagYanduan,SIMONDU: Kabid menerima dan mendisposisi ke Unit

    KabidPropam->>SIMONDU: Buka Antrian Disposisi
    SIMONDU->>Gajamada: listCases()
    Gajamada-->>SIMONDU: Kasus di posisi KABID_PROPAM
    SIMONDU->>DB: Cek dispositions
    SIMONDU-->>KabidPropam: Queue kasus

    KabidPropam->>SIMONDU: Pilih kasus + isi form disposisi ke Unit
    SIMONDU->>DB: Insert disposition record
    SIMONDU-->>KabidPropam: Disposisi tersimpan

    Note over KabidPropam,SIMONDU: Unit menerima dan mengerjakan

    Unit->>SIMONDU: Buka Daftar Surat (filter unit)
    SIMONDU->>Gajamada: listCases(unit)
    SIMONDU->>DB: Enrich dengan data internal
    SIMONDU-->>Unit: Daftar kasus unit

    Unit->>SIMONDU: Terima kasus (internal)
    SIMONDU->>DB: Update status via /terima (internal only, no Gajamada push)
    SIMONDU-->>Unit: Kasus diterima

    Unit->>SIMONDU: Upload dokumen follow-up
    SIMONDU->>Supabase: Upload file
    SIMONDU->>DB: Insert followup_document

    Unit->>SIMONDU: Update checklist + hasil lidik
    SIMONDU->>DB: Update followup_checklist + case_outcomes

    Unit->>SIMONDU: Update status/resolusi
    SIMONDU->>DB: Update via /status atau /resolusi

    Unit->>SIMONDU: Mark Complete / Perdamaian / RJ
    SIMONDU->>DB: Insert completion / settlement
```

## Alur Status Transitions

```mermaid
sequenceDiagram
    actor Unit
    participant SIMONDU as SIMONDU Web
    participant DB as Supabase PostgreSQL
    participant Status as lib/status.js

    Unit->>SIMONDU: Request status change
    SIMONDU->>Status: validateTransition(current, next, role)
    Status-->>SIMONDU: Allowed / Denied

    alt Transition Allowed
        SIMONDU->>DB: Update case status
        SIMONDU->>DB: Insert timeline entry
        SIMONDU-->>Unit: Status updated
    else Transition Denied
        SIMONDU-->>Unit: Error: invalid transition
    end
```

## Alur Perdamaian / RJ

Perdamaian dan RJ dapat diajukan di **tahap mana pun** kecuali SIDANG_DISIPLIN.

```mermaid
sequenceDiagram
    actor User
    participant SIMONDU as SIMONDU Web
    participant DB as Supabase PostgreSQL

    User->>SIMONDU: Ajukan Perdamaian / RJ
    SIMONDU->>SIMONDU: Check current stage != SIDANG_DISIPLIN
    SIMONDU->>DB: Insert settlement record
    SIMONDU->>DB: Update case_outcomes
    SIMONDU->>DB: Insert timeline entry
    SIMONDU-->>User: Perdamaian/RJ tercatat
```

## Alur Sinkronisasi Background

Fire-and-forget sync ke Gajamada untuk mutasi tertentu. **Terima kasus internal only** tidak memicu sync ke Gajamada.

```mermaid
sequenceDiagram
    participant Route as API Handler
    participant Sync as backgroundSync()
    participant Gajamada
    participant DB

    Route->>DB: Mutasi data (disposisi/dokumen/checklist/status/resolusi)
    Route->>Route: scheduleSync(pid, actor, reason)
    Note over Route: setTimeout 100ms (kecuali terima kasus)

    Sync->>Gajamada: getCase(pid) - data terkini
    Sync->>DB: get dispositions, timelines, completions, statuses
    Sync->>Sync: deriveStatus() - status efektif
    Sync->>Gajamada: pushUpdate(status, position, timeline)
    Sync->>DB: Insert sync_log
```
