export function simplifyStatus(statusLabel) {
  if (!statusLabel) return '-'
  const s = statusLabel.toLowerCase()

  if (/diterima|dikirim|surat masuk/.test(s)) return 'DITERIMA'

  if (/tidak terbukti/.test(s)) return 'TIDAK TERBUKTI'
  if (/henti lidik|tolak|pencabutan/.test(s)) return 'TIDAK TERBUKTI'

  if (/sidang|putusan sidang/.test(s)) return 'PROSES SIDANG'

  if (/perdamaian|restorative justice|restorative/.test(s)) return 'PERDAMAIAN'
  if (/selesai|terbukti/.test(s)) return 'TERBUKTI'

  return 'DALAM PROSES'
}

export function simplifyUnit(position) {
  if (!position) return '-'
  const up = position.toUpperCase()

  if (up.includes('BRIMOB')) return 'SAT BRIMOB'
  if (up.includes('WASSIDIK')) return 'WASSIDIK'

  const polresMatch = position.match(/(POLRES\s.*)/i)
  if (polresMatch) return polresMatch[1].toUpperCase()
  const polrestaMatch = position.match(/(POLRESTA\s.*)/i)
  if (polrestaMatch) return polrestaMatch[1].toUpperCase()
  const polrestabesMatch = position.match(/(POLRESTABES\s.*)/i)
  if (polrestabesMatch) return polrestabesMatch[1].toUpperCase()

  const stripped = position.replace(/\s*POLDA JAWA BARAT\s*/i, '').trim()
  let cleaned = stripped || position
  if (/yanduan/i.test(cleaned)) {
    cleaned = cleaned.replace(/\bSUBBAG\b\s*/gi, '').trim()
  }
  return cleaned.toUpperCase()
}
