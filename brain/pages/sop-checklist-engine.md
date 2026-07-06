---
id: sop-checklist-engine
title: "SOP checklist engine design (lib/checklist.js)"
category: decision
status: active
created: "2026-07-06T14:35:23"
updated: "2026-07-06T14:35:29"
---

## compiled_truth

## Keputusan

Dokumen SOP penyelesaian perkara diatur oleh **checklist engine** di `lib/checklist.js`. Engine ini mendefinisikan stage-based checklist yang berubah berdasarkan tipe kasus (DUMAS/NON-DUMAS) dan outcome (terbukti/tidak terbukti). Setiap stage memiliki template dokumen dengan auto-numbering.

## Alasan

Perkadiv 1/2015 mengharuskan dokumen-dokumen SOP tertentu untuk setiap tahap penyelesaian perkara. Checklist engine memastikan unit tidak melewatkan dokumen wajib. Stage-based branching berarti checklist beradaptasi dengan path investigasi ??? tidak semua dokumen relevan untuk semua kasus.

## Struktur Stage

```
DUMAS:
  informasi_awal ??? perencanaan ??? pelaksanaan ??? tindak_lanjut ???
    ????????? cabang_terbukti  (jika terbukti)
    ????????? cabang_tidak_terbukti

NON-DUMAS:
  perencanaan ??? pelaksanaan ??? tindak_lanjut
```

Setiap stage memiliki daftar dokumen dengan:
- `id` ??? identifier unik
- `label` ??? nama dokumen
- `template` ??? prefix untuk auto-numbering (mis. `R/LIDIK/` ??? `R/LIDIK/001/I/2026`)

## Auto-Numbering

`generateNumber(template)` menghasilkan nomor dengan format `{template}{seq}/ROMAN/{year}`. Sequence diambil dari `numbering_settings` collection di database (`supabase-postgresql-adapter`). Number booking atomik via read-increment-write untuk mencegah duplikasi.

## Stage Filtering by Outcome

- Jika outcome = `terbukti` ??? tampilkan `cabang_terbukti` setelah `tindak_lanjut`
- Jika outcome = `tidak_terbukti` ??? tampilkan `cabang_tidak_terbukti`
- Jika outcome belum diset ??? checklist berhenti di `tindak_lanjut`

## Blast Radius

- **Rigid structure**: Menambah stage baru perlu edit kode `lib/checklist.js`
- **No reordering**: Urutan stage hardcoded, tidak bisa dikustomisasi per kasus
- **Number booking race**: Sequence counter di `numbering_settings` menggunakan read-increment-write yang bisa race condition jika dua user generate nomor bersamaan. Mitigated karena user count <10.

## Upgrade Path

Ponytail: konfigurasi checklist lewat UI (Pengaturan) sehingga Kasubbid bisa menambah/mengubah stage dan dokumen tanpa edit kode. Number booking bisa pakai PostgreSQL `SEQUENCE` untuk atomicity.


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
