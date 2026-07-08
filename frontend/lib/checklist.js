// Checklist tindak lanjut simplified — status-only, no document upload.

import { STATUS, RESOLUSI } from './status.js'

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
// Labels use the new status names from status.js (Wave 4 status model).
export const MINI_CHECKLIST = [
  { key: 'laporan_diterima', label: STATUS.SURAT_MASUK_POLDA_JABAR, stage: 'informasi_awal', required: true },
  { key: 'catat_data', label: STATUS.SURAT_MASUK_POLDA_JABAR, stage: 'informasi_awal', required: true },
  { key: 'telaah', label: STATUS.DISPOSISI_PIMPINAN, stage: 'perencanaan', required: true },
  { key: 'lidik', label: STATUS.PENYELIDIKAN_PAMINAL, stage: 'pelaksanaan', required: true },
  { key: 'gelar_perkara', label: STATUS.PENYELIDIKAN_PROVOS, stage: 'pelaksanaan', required: true },
  { key: 'lhp', label: STATUS.SIDANG_DISIPLIN, stage: 'tindak_lanjut', required: true },
  { key: 'sp2hp2', label: STATUS.LIMPAH_PAMINAL_PROVOS, stage: 'tindak_lanjut', required: true },
  { key: 'pelimpahan', label: STATUS.LIMPAH_PAMINAL_PROVOS, stage: 'cabang_terbukti', required: true },
  { key: 'henti_lidik', label: STATUS.SELESAI, stage: 'cabang_tidak_terbukti', required: true },
]

export const HASIL_LIDIK_OPTIONS = [
  { value: 'terbukti', label: 'Terbukti' },
  { value: 'tidak_terbukti', label: 'Tidak Terbukti' },
]

// Settlement options — PERDAMAIAN and RJ only (Wave 4).
// TERBUKTI / TIDAK_TERBUKTI moved to RESOLUSI (separate from settlement).
export const SETTLEMENT_OPTIONS = [
  { value: 'perdamaian', label: RESOLUSI.PERDAMAIAN, gajamada_status: RESOLUSI.PERDAMAIAN },
  { value: 'restorative_justice', label: RESOLUSI.RJ, gajamada_status: RESOLUSI.RJ },
]

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
