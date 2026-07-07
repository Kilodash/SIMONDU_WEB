// Checklist tindak lanjut simplified — status-only, no document upload.

// ponytail: FOLLOWUP_DOC_TYPES removed; add when document tracking re-enabled.
// ponytail: NON_DUMAS_DOC_TYPES removed; add when non-dumas document tracking re-enabled.

export const STAGE_LABELS = {
  informations_awal: 'Informasi Awal',
  perencanaan: 'Perencanaan',
  pelaksanaan: 'Pelaksanaan',
  tindak_lanjut: 'Tindak Lanjut',
  cabang_terbukti: 'Terbukti',
  cabang_tidak_terbukti: 'Tidak Terbukti',
}

export const NON_DUMAS_STAGE_LABELS = {
  tindak_lanjut: 'Tindak Lanjut',
}

const STAGE_ORDER = ['informasi_awal', 'perencanaan', 'pelaksanaan', 'tindak_lanjut', 'cabang_terbukti', 'cabang_tidak_terbukti']
const NON_DUMAS_STAGE_ORDER = ['tindak_lanjut']

export function getStageOrder(caseType) {
  if (caseType === 'non_dumas' || caseType === 'non_pengaduan') return NON_DUMAS_STAGE_ORDER
  return STAGE_ORDER
}

export function getStageLabels(caseType) {
  if (caseType === 'non_dumas' || caseType === 'non_pengaduan') return NON_DUMAS_STAGE_LABELS
  return STAGE_LABELS
}

// Mini checklist items — status only. Falls back to default list if no followup_checklist rows.
export const MINI_CHECKLIST = [
  { key: 'laporan_diterima', label: 'Laporan Diterima', stage: 'informasi_awal', required: true },
  { key: 'catat_data', label: 'Catat / Data', stage: 'informasi_awal', required: true },
  { key: 'telaah', label: 'Telaah', stage: 'perencanaan', required: true },
  { key: 'lidik', label: 'Lidik / Pulbaket', stage: 'pelaksanaan', required: true },
  { key: 'gelar_perkara', label: 'Gelar Perkara', stage: 'pelaksanaan', required: true },
  { key: 'lhp', label: 'Laporan Hasil', stage: 'tindak_lanjut', required: true },
  { key: 'sp2hp2', label: 'SP2HP2', stage: 'tindak_lanjut', required: true },
  { key: 'pelimpahan', label: 'Pelimpahan', stage: 'cabang_terbukti', required: true },
  { key: 'henti_lidik', label: 'Henti Lidik', stage: 'cabang_tidak_terbukti', required: true },
]

export const HASIL_LIDIK_OPTIONS = [
  { value: 'terbukti', label: 'Terbukti' },
  { value: 'tidak_terbukti', label: 'Tidak Terbukti' },
]

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

export function activeStagesFor(outcome) {
  const stages = ['informasi_awal', 'perencanaan', 'pelaksanaan', 'tindak_lanjut']
  if (outcome?.hasil_lidik === 'terbukti') stages.push('cabang_terbukti')
  if (outcome?.hasil_lidik === 'tidak_terbukti') stages.push('cabang_tidak_terbukti')
  return stages
}

export function docTypesForOutcome(outcome) {
  const stages = activeStagesFor(outcome)
  return MINI_CHECKLIST.filter((d) => stages.includes(d.stage))
}

export function computeChecklist(outcome, checklistRows) {
  const applicable = docTypesForOutcome(outcome)
  const settlementActive = !!outcome?.settlement
  const byType = {}
  for (const c of checklistRows || []) byType[c.document_type] = c
  const items = applicable.map((def) => {
    const row = byType[def.key]
    let status = row?.status || 'pending'
    if (settlementActive && status === 'pending') status = 'not_applicable'
    return {
      ...def,
      status,
      note: row?.note || '',
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
