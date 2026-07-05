// Checklist dokumen tindak lanjut Lidik Paminal, sesuai SOP LIDIK PAMINAL
// (Perkadiv Nomor 1 Tahun 2015) + kebiasaan penomoran surat Bidpropam.
//
// stage:
//   perencanaan        -> selalu wajib
//   pelaksanaan         -> selalu wajib
//   tindak_lanjut        -> selalu wajib (berlaku utk semua hasil Lidik)
//   cabang_terbukti      -> wajib HANYA jika hasil_lidik === 'terbukti'
//   cabang_tidak_terbukti -> wajib HANYA jika hasil_lidik === 'tidak_terbukti'

export const FOLLOWUP_DOC_TYPES = [
  { key: 'li', label: 'Laporan Informasi', stage: 'informasi_awal', required: true, numbering: true, defaultTemplate: 'R/LI-{seq}/{month_roman}/HUK.12.10./{year}/Bidpropam' },
  { key: 'notdin_permohonan_lidik', label: 'Nota Dinas Permohonan Lidik', stage: 'informasi_awal', required: true, numbering: true, defaultTemplate: 'R/ND-{seq}/{month_roman}/HUK.12.10./{year}/Bidpropam' },
  { key: 'sp2hp2_awal', label: 'SP2HP2 Awal ke Pelapor', stage: 'perencanaan', required: true, numbering: true, defaultTemplate: 'B/{seq}/{month_roman}/WAS.2.1./{year}/Bidpropam' },
  { key: 'uuk', label: 'UUK (Rencana Penyelidikan)', stage: 'perencanaan', required: true, numbering: false },
  { key: 'sprin_lidik', label: 'Sprin Lidik (Surat Perintah Penyelidikan)', stage: 'perencanaan', required: true, numbering: true, defaultTemplate: 'Sprin/{seq}/{month_roman}/HUK.6.6./{year}' },
  { key: 'rencana_anggaran', label: 'Rencana Kebutuhan Anggaran', stage: 'perencanaan', required: true, numbering: false },

  { key: 'gelar_perkara', label: 'Gelar Perkara (Notulen)', stage: 'pelaksanaan', required: true, numbering: false },
  { key: 'lhp', label: 'Laporan Hasil Penyelidikan (LHP)', stage: 'pelaksanaan', required: true, numbering: true, defaultTemplate: 'R/LHP-{seq}/{month_roman}/HUK.12.10./{year}/Bidpropam' },
  { key: 'nota_dinas_hasil_lidik', label: 'Nota Dinas Hasil Lidik', stage: 'pelaksanaan', required: true, numbering: true, defaultTemplate: 'R/ND-{seq}/{month_roman}/HUK.12.10./{year}/Bidpropam' },

  { key: 'sp2hp2_akhir', label: 'SP2HP2 Akhir ke Pelapor', stage: 'tindak_lanjut', required: true, numbering: true, defaultTemplate: 'B/{seq}/{month_roman}/WAS.2.1./{year}/Bidpropam' },
  { key: 'pemberitahuan_ankum', label: 'Pemberitahuan ke Ankum (Surat/Nodin)', stage: 'tindak_lanjut', required: true, numbering: true, defaultTemplate: 'B/{seq}/{month_roman}/WAS.2.4./{year}/Bidpropam' },
  { key: 'surat_mabes', label: 'Surat ke Mabes (Opsional)', stage: 'tindak_lanjut', required: false, numbering: true, defaultTemplate: 'B/{seq}/{month_roman}/WAS.2.4./{year}/Bidpropam' },
  { key: 'st_arahan', label: 'ST Arahan (Opsional)', stage: 'tindak_lanjut', required: false, numbering: true, defaultTemplate: 'ST/{seq}/{month_roman}/HUK.6.6./{year}' },

  { key: 'nota_dinas_pelimpahan', label: 'Nota Dinas Pelimpahan Hasil Lidik (ke Subbidprovos/Subbidwabprof)', stage: 'cabang_terbukti', required: true, numbering: true, defaultTemplate: 'R/ND-{seq}/{month_roman}/HUK.12.10./{year}/Paminal' },
  { key: 'surat_pelimpahan', label: 'Surat Pelimpahan (ke Polres)', stage: 'cabang_terbukti', required: false, numbering: true, defaultTemplate: 'R/{seq}/{month_roman}/HUK.12.10./{year}/Bidpropam' },

  { key: 'sprin_henti_lidik', label: 'Sprin Penghentian Penyelidikan (Sprin Henti Lidik)', stage: 'cabang_tidak_terbukti', required: true, numbering: true, defaultTemplate: 'Sprin/{seq}/{month_roman}/HUK.6.6./{year}' },
]

export const STAGE_ORDER = ['informasi_awal', 'perencanaan', 'pelaksanaan', 'tindak_lanjut', 'cabang_terbukti', 'cabang_tidak_terbukti']

export const STAGE_LABELS = {
  informasi_awal: 'Tahap 0 · Laporan Informasi',
  perencanaan: 'Tahap 1 · Perencanaan',
  pelaksanaan: 'Tahap 2 · Pelaksanaan',
  tindak_lanjut: 'Tahap 3 · Tindak Lanjut (berlaku semua hasil)',
  cabang_terbukti: 'Cabang · Hasil TERBUKTI',
  cabang_tidak_terbukti: 'Cabang · Hasil TIDAK TERBUKTI',
}

export const HASIL_LIDIK_OPTIONS = [
  { value: 'terbukti', label: 'Terbukti' },
  { value: 'tidak_terbukti', label: 'Tidak Terbukti' },
]

// Penyebutan disamakan persis dengan istilah/status yang dipakai di Gajamada
// (hasil penelusuran source code widget Gajamada: PENCABUTAN_SEBELUM_SPRIN_LIDIK,
// PENCABUTAN_SETELAH_SPRIN_LIDIK, RESTORATIVE_JUSTICE).
export const SETTLEMENT_OPTIONS = [
  { value: 'pencabutan_sebelum_sprin_lidik', label: 'Pencabutan Sebelum Sprin Lidik', gajamada_status: 'Pencabutan' },
  { value: 'pencabutan_setelah_sprin_lidik', label: 'Pencabutan Setelah Sprin Lidik', gajamada_status: 'Henti Lidik' },
  { value: 'restorative_justice', label: 'Restorative Justice', gajamada_status: 'Restorative Justice' },
  { value: 'perdamaian', label: 'Perdamaian', gajamada_status: 'Perdamaian' },
]

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
export function monthRoman(date = new Date()) {
  return ROMAN_MONTHS[date.getMonth()]
}

export function renderNumberTemplate(template, { seq, date = new Date() }) {
  const year = date.getFullYear()
  const roman = monthRoman(date)
  return String(template)
    .split('{seq}').join(String(seq))
    .split('{month_roman}').join(roman)
    .split('{year}').join(String(year))
}

// Given the current outcome (hasil_lidik + settlement), return which stages are "active" / required.
export function activeStagesFor(outcome) {
  const stages = ['perencanaan', 'pelaksanaan', 'tindak_lanjut']
  if (outcome?.hasil_lidik === 'terbukti') stages.push('cabang_terbukti')
  if (outcome?.hasil_lidik === 'tidak_terbukti') stages.push('cabang_tidak_terbukti')
  return stages
}

export function docTypesForOutcome(outcome) {
  const stages = activeStagesFor(outcome)
  return FOLLOWUP_DOC_TYPES.filter((d) => stages.includes(d.stage))
}

// Compute per-item effective status + overall progress.
// checklistRows: array from `followup_checklist` collection (status/document_number/note)
// documents: array from `followup_documents` collection (has document_type)
export function computeChecklist(outcome, checklistRows, documents) {
  const settlementActive = !!outcome?.settlement
  const applicable = docTypesForOutcome(outcome)
  const byType = {}
  for (const c of checklistRows || []) byType[c.document_type] = c
  const docsByType = {}
  for (const d of documents || []) {
    if (!docsByType[d.document_type]) docsByType[d.document_type] = []
    docsByType[d.document_type].push(d)
  }
  const items = applicable.map((def) => {
    const row = byType[def.key]
    const docs = docsByType[def.key] || []
    let status = row?.status || 'pending'
    if (status === 'pending' && docs.length > 0) status = 'completed'
    if (settlementActive && status === 'pending') status = 'not_applicable'
    return {
      ...def,
      status,
      document_number: row?.document_number || null,
      document_date: row?.document_date || null,
      note: row?.note || '',
      documents: docs,
    }
  })
  const requiredItems = items.filter((i) => i.required)
  const requiredCompleted = requiredItems.filter((i) => i.status === 'completed' || i.status === 'not_applicable').length
  return {
    items,
    progress: { total: items.length, completed: items.filter((i) => i.status === 'completed').length },
    requiredProgress: { total: requiredItems.length, completed: requiredCompleted },
    canComplete: settlementActive || (requiredItems.length > 0 ? requiredCompleted === requiredItems.length : true),
  }
}
