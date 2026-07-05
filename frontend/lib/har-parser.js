// HAR Parser - extract PDFs from ASTINA/Dumas Presisi HAR files
export function parseHar(harJson) {
  const entries = (harJson.log?.entries || []).filter((e) => {
    const url = e.request?.url || ''
    return url.includes('astina.polri.go.id') && !/\.(js|css|png|jpg|svg|woff|ico|map|gif|ttf)$/.test(url)
  })

  const pdfs = []
  for (const entry of entries) {
    const content = entry.response?.content
    if (!content) continue

    const isPdf = content.mimeType && (content.mimeType.includes('pdf') || content.mimeType.includes('octet-stream'))
    const text = content.text || ''
    if (!text || text.length < 100) continue

    const isBase64 = content.encoding === 'base64'
    pdfs.push({
      url: entry.request?.url || '',
      method: entry.request?.method || '',
      mimeType: content.mimeType,
      size: content.size || text.length,
      encoding: content.encoding || 'text',
      isBase64,
      base64: isBase64 ? text : null,
      textPreview: (isBase64 ? '[PDF base64 ' + text.length + ' chars]' : text.substring(0, 500)),
    })
  }

  return {
    totalEntries: entries.length,
    pdfCount: pdfs.length,
    pdfs,
  }
}

// Convert HAR base64 PDF to a Supabase-uploadable buffer
export function base64ToBuffer(base64) {
  const clean = base64.replace(/^data:.*?;base64,/, '').replace(/\s/g, '')
  return Buffer.from(clean, 'base64')
}
