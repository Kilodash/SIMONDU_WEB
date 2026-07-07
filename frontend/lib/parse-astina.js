// Parse ASTINA surat raw data → pre-fill fields for edit form
// Pure JS, no AI/LLM, no network calls
export function parseAstinaSurat(rawSurat) {
  if (!rawSurat) return {}
  const perihal = rawSurat.perihal || ''

  return {
    prepetrator_name: extractTerlapor(perihal),
    pengirim: rawSurat.pengirim || rawSurat.dari_name || '',
    perihal,
    nomor_surat: rawSurat.no_surat || '',
    tgl_surat: rawSurat.tanggal_surat || rawSurat.tanggal || '',
    summary: perihal,
    category: 'NON-DUMAS',
  }
}

function extractTerlapor(perihal) {
  if (!perihal) return ''
  // "a.n. NAMA" / "an NAMA"
  let m = perihal.match(/\b(?:a\.?n\.?)\s+([A-Z][A-Z\s.,/-]+?)(?=\s+(?:PANGKAT|NRP|JABATAN|,|\.|$))/i)
  if (m) return m[1].trim()
  // Rank prefix: "Sdr." / "Briptu/Bripda/Aipda/Ipda/Kompol/AKBP NAMA"
  m = perihal.match(/\b(?:Sdr\.?\s+|Brip(?:tu|da)\s+|Bharada\s+|Aipd[at]\s+|Ip[dt][au]\s+|Kompol\s+|AKBP\s+|Brigadir\s+)([A-Z][A-Z\s.,/-]+?)(?=\s+(?:PANGKAT|NRP|,|\.|$))/i)
  if (m) return m[1].trim()
  // "terlapor NAMA" / "atas nama NAMA" / "terduga NAMA"
  m = perihal.match(/\b(?:terlapor|atas\s+nama|terduga)\s+([A-Z][A-Z\s.,/-]+?)(?=\s+(?:PANGKAT|NRP|,|\.|$))/i)
  if (m) return m[1].trim()
  // "dugaan pelanggaran oleh NAMA"
  m = perihal.match(/\b(?:oleh|dilakukan\s+oleh)\s+([A-Z][A-Z\s.,/-]+?)(?=\s+(?:PANGKAT|NRP|,|\.|$))/i)
  if (m) return m[1].trim()
  return ''
}
