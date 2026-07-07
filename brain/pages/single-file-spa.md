---
id: single-file-spa
title: Single-file SPA pattern
category: decision
status: active
created: "2026-07-06T10:27:07"
updated: "2026-07-06T10:27:24"
updated: "2026-07-07T20:21:39"
---


## compiled_truth

# Keputusan: Single-File SPA

Semua halaman aplikasi dalam satu file `frontend/app/page.js` (2344 baris). Routing berbasis state `tab` tanpa Next.js file-system router.

**Alternatif**: Multi-route Next.js (`/dashboard`, `/cases`, dll)

**Keputusan**: Single-file SPA

**Alasan**:
- Development cepat, tidak perlu setup route per halaman
- State sharing sederhana tanpa context/provider
- Cocok untuk internal tool/admin panel
- Semua komponen dalam satu file memudahkan navigasi kode

**Konsekuensi**:
- File besar (2000+ baris), sulit di-split
- Tidak bisa code-split per halaman
- Hot reload Next.js lebih lambat
- Semua komponen re-render pada tab switch


## timeline

- time: 2026-07-06T10:27:07
  kind: decision
  summary: "Created this page: Single-file SPA pattern"
  source: "code + project review"
  affects: [single-file-spa]

- time: 2026-07-06T10:27:24
  kind: decision
  summary: "Captured from code review: why single-file SPA was chosen for MVP"
  source: code review
  affects: [single-file-spa]

- time: 2026-07-07T20:21:39
  kind: decision
  summary: "Initial decision: single-file SPA pattern"
  source: "code + git log"
  affects: [single-file-spa]
