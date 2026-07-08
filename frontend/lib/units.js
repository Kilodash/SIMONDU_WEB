import { getUnitType, getCaseTypeForUnit } from './checklist.js'

export function shortUnit(u) {
  if (!u) return '-'
  return u
    .replace(' SUBBID PAMINAL POLDA JAWA BARAT', ' PAMINAL')
    .replace(' POLDA JAWA BARAT', '')
}

export const FILTER_UNITS = [
  { label: 'KABID PROPAM', value: 'KABID PROPAM', desc: 'Belum didisposisi Kabid' },
  { label: 'SUBBAG YANDUAN', value: 'SUBBAG YANDUAN', desc: 'Belum diterima / diberi saran' },
  { label: 'SUBBID PAMINAL', value: 'SUBBID PAMINAL', desc: 'Penyelidikan (Laporan Informasi)' },
  { label: 'SUBBID PROVOS', value: 'SUBBID PROVOS', desc: 'GARPLIN / Sidang Disiplin' },
  { label: 'SUBBID WABPROF', value: 'SUBBID WABPROF', desc: 'GAR KEPP / Sidang KKE' },
  { label: 'POLRES', value: 'POLRES', desc: 'Lidik / GARPLIN / Sidang Disiplin' },
  { label: 'WASSIDIK', value: 'WASSIDIK', desc: 'Dilimpahkan (Selesai, monitor)' },
]

export { getUnitType, getCaseTypeForUnit }

export function resolveFilterUnit(filterValue) {
  const nameMap = {}
  for (const f of FILTER_UNITS) {
    nameMap[f.value] = f.label
  }
  return nameMap[filterValue] || filterValue
}

// Category list - full set discovered from live Paminal cases
export const CATEGORY_OPTIONS = [
  'Penanganan Perkara Pidana',
  'Pelayanan Kepolisian',
  'PERILAKU & INTEGRITAS PERSONAL',
  'Pelanggaran Hukum / Tindak Pidana',
  'PERSELINGKUHAN / HUBUNGAN TERLARANG',
  'DISKRIMINASI DALAM PELAYANAN KEPOLISIAN',
  'ASUSILA',
  'PENYALAHGUNAAN WEWENANG',
  'PENYALAHGUNAAN WEWENANG DALAM KEGIATAN OPERASIONAL',
  'AROGANSI SOSIAL / SIKAP MERENDAHKAN ORANG LAIN',
  'INTIMIDASI VERBAL',
  'WANPRESTASI DALAM PERJANJIAN PRIBADI',
  'PENGGELAPAN',
  'PENIPUAN / FRAUD',
  'PENYITAAN TANPA SURAT ATAU PROSEDUR SAH',
  'MEMINTA ATAU MENERIMA IMBALAN DI LUAR KETENTUAN PELAYANAN PUBLIK',
]
