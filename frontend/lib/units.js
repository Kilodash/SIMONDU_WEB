// Master units list for Polda Jabar - Subbid Paminal
// The parent (Kasubbid) can disposisi to any of the child units below.
// Discovered from Gajamada dimension.catalog_unit_v2 (case_position_after = KASUBBID PAMINAL POLDA JAWA BARAT)

export const KASUBBID_UNIT = 'KASUBBID PAMINAL POLDA JAWA BARAT'

export const CHILD_UNITS = [
  'UNIT 1 SUBBID PAMINAL POLDA JAWA BARAT',
  'UNIT 2 SUBBID PAMINAL POLDA JAWA BARAT',
  'UNIT 3 SUBBID PAMINAL POLDA JAWA BARAT',
  'UR BINPAM SUBBID PAMINAL POLDA JAWA BARAT',
  'UR LITPERS SUBBID PAMINAL POLDA JAWA BARAT',
  'UR PRODOK SUBBID PAMINAL POLDA JAWA BARAT',
  'KAUR BINPAM SUBBID PAMINAL POLDA JAWA BARAT',
]

// All Paminal-scope units (Kasubbid + child) - default scope for Simondu
export const PAMINAL_SCOPE_UNITS = [KASUBBID_UNIT, ...CHILD_UNITS]

// Short label for display in badges
export function shortUnit(u) {
  if (!u) return '-'
  return u
    .replace(' SUBBID PAMINAL POLDA JAWA BARAT', ' PAMINAL')
    .replace(' POLDA JAWA BARAT', '')
}

// Internal derived-status labels used across the app
export const DERIVED_STATUS = {
  DITERIMA: 'Laporan Diterima',
  DIDISTRIBUSI: 'Didistribusi',
  PROSES_LIDIK: 'Proses Lidik',
  SELESAI: 'Selesai',
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
