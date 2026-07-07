---
id: sop-checklist-engine
title: "SOP checklist engine design (lib/checklist.js)"
category: decision
status: active
created: "2026-07-06T14:35:23"
updated: "2026-07-06T14:35:29"
updated: "2026-07-07T20:22:49"
---


## compiled_truth

# Keputusan: SOP Checklist Engine

Sistem disposisi menggunakan checklist tugas. Dua set terpisah: DUMAS (pengaduan masyarakat) dan NON-DUMAS (surat internal). Checklist dikonfigurasi di `resetForm()` ? default semua `checked: false`. Kasubbid mencentang tugas yang relevan sebelum submit disposisi.

**Alasan**: SOP pengaduan di Polda Jabar punya daftar tugas spesifik, checklist memastikan tidak ada yang terlewat.

**Konsekuensi**: Checklist hardcoded, tidak bisa custom per unit. DUMAS/NON-DUMAS differentiation manual.


## timeline

- time: 2026-07-06T14:35:23
  kind: decision
  summary: "Created this page: SOP checklist engine design (lib/checklist.js)"
  source: "code review: lib/checklist.js"
  affects: [sop-checklist-engine]

- time: 2026-07-06T14:35:29
  kind: decision
  summary: "Captured from code review: stage-based SOP checklist engine with auto-numbering"
  source: "code review: lib/checklist.js"
  affects: [sop-checklist-engine]

- time: 2026-07-07T20:22:49
  kind: decision
  summary: SOP checklist details
  source: code analysis
  affects: [sop-checklist-engine]
