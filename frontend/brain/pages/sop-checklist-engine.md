---
id: sop-checklist-engine
title: SOP-based document checklist engine
category: decision
status: active
created: "2026-07-04T19:08:12"
updated: "2026-07-04T19:09:06"
---

## compiled_truth

## What was decided

Implemented a **document checklist engine** following SOP LIDIK PAMINAL (Perkadiv Nomor 1 Tahun 2015) and Bidpropam letter-numbering conventions. The engine defines required documents per investigation stage and tracks completion status per case.

## How it works

### 5 stages (defined in \lib/checklist.js\)

| Stage | When active | Documents |
|---|---|---|
| \perencanaan\ | Always | SP2HP2 Awal, UUK, Sprin Lidik, Rencana Anggaran |
| \pelaksanaan\ | Always | Gelar Perkara, LHP, Nota Dinas Hasil Lidik |
| \	indak_lanjut\ | Always | SP2HP2 Akhir, Pemberitahuan ke Ankum, Surat ke Mabes (ops), ST Arahan (ops) |
| \cabang_terbukti\ | If \hasil_lidik === 'terbukti'\ | Nota Dinas Pelimpahan, Surat Pelimpahan (ops) |
| \cabang_tidak_terbukti\ | If \hasil_lidik === 'tidak_terbukti'\ | Sprin Henti Lidik |

### Key behaviors

- **Active stages** computed dynamically from \case_outcomes.hasil_lidik\ via \ctiveStagesFor()\
- **Auto-numbering** ? templates like \B/{seq}/{month_roman}/WAS.2.1./{year}/Bidpropam\ rendered with sequence + Roman month + year
- **Tidak Berlaku toggle** ? users can mark a checklist item as not applicable (then reactivate later)
- **Settlement auto-complete** ? when a settlement is active (\perdamaian\/\estorative_justice\/\pencabutan\), all pending required items are auto-set to \
ot_applicable\
- **Completion gate** ? \canComplete\ is true only when all required items are \completed\ or \
ot_applicable\ (or settlement active)
- **Progress tracking** ? both total progress and required-only progress tracked separately

## Data model

\ollowup_checklist\ table: \(prepetrator_id, document_type)\ unique pair with \status\, \document_number\, \document_date\, \
ote\. Documents uploaded to \ollowup_documents\ table match via \document_type\.

## Rationale

- Enforces SOP compliance ? cannot mark case complete without required documents
- Conditional stages prevent irrelevant document requirements
- Auto-numbering removes manual number generation errors
- The settlement auto-N/A behavior means settlement cases don't need all investigation docs

## Related

- [[perdamaian-module]]
- [[gajamada-source-of-truth]]


## timeline

- time: 2026-07-04T19:08:12
  kind: decision
  summary: "Created this page: SOP-based document checklist engine"
  source: code analysis
  affects: [sop-checklist-engine]

- time: 2026-07-04T19:09:06
  kind: decision
  summary: Initial capture from code analysis
  source: code analysis
  affects: [sop-checklist-engine]
