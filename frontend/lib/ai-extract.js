// AI PDF extraction via OpenCode Vision + Claude Vision fallback
export async function extractPdfContent(pdfBase64) {
  const apiKey = process.env.OPENCODE_API_KEY
  const baseUrl = process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai'

  const prompt = 'Ekstrak data berikut dari surat/dokumen ini dalam format JSON. Hanya kembalikan JSON yang valid, tanpa teks lain, tanpa markdown code block:\n{\n  "perihal": "...",\n  "pengirim": "...",\n  "nomor_surat": "...",\n  "tanggal_surat": "...",\n  "isi_ringkas": "..."\n}\nJika field tidak ditemukan, isi dengan string kosong.'

  // Try OpenCode Vision first
  if (apiKey) {
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'opencode-vision',
          messages: [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
          ]}],
          max_tokens: 1000,
        }),
      })
      const data = await res.json()
      if (res.ok && data.choices?.[0]?.message?.content) {
        return parseAiResponse(data.choices[0].message.content)
      }
    } catch (_) { /* fallback to Claude */ }
  }

  // Fallback: Claude Vision via OpenCode proxy
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } },
        ]}],
        max_tokens: 1000,
      }),
    })
    const data = await res.json()
    if (res.ok && data.choices?.[0]?.message?.content) {
      return parseAiResponse(data.choices[0].message.content)
    }
  } catch (_) {}

  throw new Error('AI extraction failed - no API key configured')
}

function parseAiResponse(text) {
  try {
    const cleaned = text.replace(/```json\n?|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return {
      perihal: text.substring(0, 200),
      pengirim: '',
      nomor_surat: '',
      tanggal_surat: '',
      isi_ringkas: text.substring(0, 500),
    }
  }
}
