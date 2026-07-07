---
id: gajamada-source-of-truth
title: "Gajamada sebagai source of truth, SIMONDU overlay operasional"
category: decision
status: active
created: "2026-07-06T10:27:29"
updated: "2026-07-06T10:28:02"
updated: "2026-07-07T20:22:02"
---


## compiled_truth

# Keputusan: Gajamada sebagai Source of Truth

Gajamada (eBdesk Fusion) adalah sumber utama data kasus pengaduan. Semua operasi CRUD kasus mengacu ke Gajamada API. Sync logs tracking push/pull.

**Alasan**: Sistem resmi Bid Propam, data terintegrasi workflow kepolisian, local cases hanya untuk input manual/non-dumas.

**Konsekuensi**: Ketergantungan tinggi pada API Gajamada, session cookie perlu auto-refresh, sync dua arah kompleks.


## timeline

- time: 2026-07-06T10:27:29
  kind: decision
  summary: "Created this page: Gajamada sebagai source of truth, SIMONDU overlay operasional"
  source: code review
  affects: [gajamada-source-of-truth]

- time: 2026-07-06T10:28:02
  kind: decision
  summary: "Captured from code: Gajamada as source of truth, SIMONDU as operational overlay"
  source: code review
  affects: [gajamada-source-of-truth]

- time: 2026-07-07T20:21:52
  kind: decision
  summary: Update decision details
  source: code analysis
  affects: [gajamada-source-of-truth]

- time: 2026-07-07T20:22:02
  kind: decision
  summary: Update decision details
  source: code analysis
  affects: [gajamada-source-of-truth]
