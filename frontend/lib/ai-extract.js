const GEMINI_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const PROMPT = `Ekstrak data berikut dari teks surat/dokumen ini. Hanya kembalikan JSON valid tanpa markdown:
{
  "prepator_name": "nama terlapor/terduga",
  "pengirim": "pengirim/pelapor",
  "perihal": "perihal surat",
  "nomor_surat": "nomor surat",
  "tanggal_surat": "YYYY-MM-DD",
  "summary": "ringkasan isi 1-3 kalimat",
  "category": "kategori"
}
Jika field tidak ditemukan, isi string kosong.`

async function extractWithGemini(text) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set')
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${PROMPT}\n\nTEKS:\n${text.slice(0, 8000)}` }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
    }),
  })
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  try {
    return JSON.parse(raw.replace(/```json\n?|```/g, '').trim())
  } catch {
    return { prepator_name: '', pengirim: '', perihal: '', nomor_surat: '', tanggal_surat: '', summary: raw.slice(0, 300), category: '' }
  }
}

async function extractPdfContent(pdfBuffer) {
  // Try pdf-parse first
  try {
    const pdfParse = require('pdf-parse')
    const parsed = await pdfParse(pdfBuffer)
    const text = parsed.text || ''
    if (text.length > 50) return await extractWithGemini(text)
  } catch (_) { /* fallback to vision */ }

  // Fallback: Gemini Vision on PDF screenshot
  const pdfBase64 = Buffer.from(pdfBuffer).toString('base64')
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: PROMPT },
        { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
      ] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
    }),
  })
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  try {
    return JSON.parse(raw.replace(/```json\n?|```/g, '').trim())
  } catch {
    return { prepator_name: '', pengirim: '', perihal: '', nomor_surat: '', tanggal_surat: '', summary: raw.slice(0, 300), category: '' }
  }
}

module.exports = { extractPdfContent, extractWithGemini }
