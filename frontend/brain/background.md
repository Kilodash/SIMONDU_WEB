---
slug: background
title: Project background
role: project background
updated: "2026-07-04T19:02:15"
---

# Project background

## Why this project exists

SIMONDU WEB (Sistem Monitoring Pengaduan) is the internal case-management application for **Kasubbid Paminal Polda Jawa Barat** ? the Subdivision of Internal Affairs of the West Java Regional Police.

The application consolidates public complaint data ingested from **Gajamada** (eBdesk Fusion, the national police complaints platform) and adds internal operational layers on top: disposition routing, document checklist tracking (SOP-based), settlement workflows (Perdamaian/Restorative Justice/Pencabutan), and bidirectional sync back to Gajamada.

## Target users

- **Kasubbid Paminal** ? the subdivision head; reviews incoming complaints, dispositions them to subordinate units, monitors compliance
- **Admin/Operator** ? day-to-day operator with similar privileges
- **Unit officers** (Kanit 1/2/3, Ur Binpam, Ur Litpers, Ur Prodok) ? receive dispositions, upload followup documents, mark completion

## Core goals

- Provide a single dashboard (ANEV ? Analisis dan Evaluasi) aggregating all Paminal-scope complaints
- Streamline the disposition workflow from intake to case closure
- Enforce SOP document completeness via checklist stages (Perencanaan ? Pelaksanaan ? Tindak Lanjut ? Cabang)
- Synchronize internal actions (dispositions, document uploads, status changes) back to Gajamada
- Track all actions through audit logs

## Non-goals

- Public-facing complaint submission (that remains in Gajamada)
- Multi-Polda deployment (hardcoded to Polda Jabar)
- Real-time sync (fire-and-forget background sync, not transactional)
- Mobile client

## Project status

**MVP deployed** ? the app is usable by actual Paminal personnel. Hardcoded credentials, single-file SPA architecture, Supabase backend. Production hardening (proper auth, multi-tenant, deployment pipeline) remains future work.
