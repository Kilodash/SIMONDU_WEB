---
id: single-file-spa
title: Single-file SPA pattern
category: decision
status: active
created: "2026-07-06T10:27:07"
updated: "2026-07-06T10:27:24"
---

## compiled_truth

## Keputusan

Semua komponen React UI berada dalam satu file `app/page.js` (~2500 lines). Semua API endpoint bisnis dalam satu file `app/api/[[...path]]/route.js` (~2000 lines). Navigasi internal via React `tab` state, bukan Next.js routing.

## Alternatif

- Multi-file component tree dengan Next.js route-based navigation
- Split API ke multiple route handlers

## Alasan

Dipilih untuk **kecepatan MVP**. Dengan <10 user internal, monolith sederhana mempercepat iterasi tanpa overhead struktur folder kompleks. Next.js App Router tetap digunakan untuk SSR/layout, tapi semua view bisnis di-render client-side dalam satu shell.

## Blast Radius

- **Keterbacaan**: Sulit navigasi di file >2000 lines
- **Reusability**: Komponen tidak bisa di-share ke halaman lain (karena semua di satu file)
- **Testing**: Sulit unit-test komponen individual

## Upgrade Path

Ponytail: dekomposisi saat melewati ~3000 lines. Strategy: ekstrak komponen besar (Dashboard, CasesList, DisposisiPage) ke file terpisah di `app/components/`. API split ke `app/api/cases/route.js`, `app/api/disposisi/route.js`, etc. Setelah dekomposisi, enable Next.js route-based navigation untuk deep linking.


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
