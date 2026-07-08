---
slug: roadmap
title: Roadmap
role: milestones
updated: "2026-07-08T10:00:00"
---

# Roadmap

## Milestone Terkini

```mermaid
gantt
    title Roadmap SIMONDU WEB
    dateFormat  YYYY-MM
    section MVP (Done)
    Auth JWT + 7 User Hardcoded      :done, mvp1, 2025-06, 2025-07
    Daftar Surat + Filter            :done, mvp2, 2025-06, 2025-07
    Antrian Disposisi Gajamada       :done, mvp3, 2025-07, 2025-08
    Dashboard ANEV                   :done, mvp4, 2025-07, 2025-08
    Checklist SOP + Settlement       :done, mvp5, 2025-08, 2025-09
    Background Sync                  :done, mvp7, 2025-10, 2025-11
    section Simplification (Done)
    Remove ASTINA Auto-Sync          :done, sim1, 2026-05, 2026-06
    Remove AI / Gemini               :done, sim2, 2026-05, 2026-06
    Remove Document Register         :done, sim3, 2026-05, 2026-06
    Add Status Kontekstual           :done, sim4, 2026-06, 2026-07
    Add Unit Mapping                 :done, sim5, 2026-06, 2026-07
    Add 3-Bucket Dashboard           :done, sim6, 2026-06, 2026-07
    Role Hierarchy (3 roles)         :done, sim7, 2026-06, 2026-07
    section Current (In Progress)
    Kredensial Per-User              :active, cur1, 2026-06, 2026-07
    Master Unit + Satker CRUD        :done, cur2, 2025-11, 2025-12
    section Near-term
    Dekomposisi Monolith             :next1, 2026-07, 2026-09
    Auth Database (hash password)    :next3, 2026-08, 2026-09
    section Future
    Multi-Polda Support              :fut1, 2026-10, 2026-12
    CI/CD + Integration Tests        :fut2, 2026-09, 2026-11
    Monitoring + Alerting            :fut3, 2026-11, 2027-01
```

## Rencana Dekat

- **Dekomposisi Monolith** ??? Pecah `page.js` (~2500 lines) dan `route.js` (~2000 lines) ke modul terpisah
- **Auth Database** ??? Pindahkan kredensial dari hardcoded ke database dengan bcrypt

## Rencana Jauh

- **Multi-Polda** ??? Dukungan deployment untuk Polda selain Jawa Barat
- **CI/CD Pipeline** ??? Automated testing + deployment
- **Monitoring** ??? Health check + alert untuk koneksi Gajamada
