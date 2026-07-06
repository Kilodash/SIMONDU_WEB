---
id: gajamada-source-of-truth
title: "Gajamada sebagai source of truth, SIMONDU overlay operasional"
category: decision
status: active
created: "2026-07-06T10:27:29"
updated: "2026-07-06T10:28:02"
---

## compiled_truth

## Keputusan

Data pengaduan disimpan di Gajamada (eBdesk Fusion). SIMONDU hanya menyimpan **overlay operasional**: disposisi, timeline, follow-up documents, checklist, outcomes, sync logs. Tidak ada duplikasi data kasus (prepetrator_name, content, status_label, dsb).

## Alternatif

- Import semua data dari Gajamada ke database lokal (full mirror)
- Gunakan Gajamada sebagai backup, SIMONDU sebagai primary

## Alasan

Gajamada adalah sistem resmi Mabes Polri. Data pengaduan harus tetap di source resmi untuk kepatuhan. SIMONDU menambah lapisan workflow tanpa menggantikan source of truth. Pattern: write-back via `pushUpdate()` untuk menjaga status sinkron.

## Blast Radius

- **Ketergantungan API**: Gajamada down = SIMONDU tidak bisa fetch data baru
- **Reverse-engineered API**: Gajamada tidak punya API publik; endpoint ditemukan dari frontend bundle. Perubahan di sisi Gajamada bisa mematahkan integrasi kapan saja
- **Query latency**: Setiap list cases perlu round-trip ke Gajamada (cache 30 detik di-mitigasi)


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
