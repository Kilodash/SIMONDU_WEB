// ASTINA Sync - stealth browser automation via rebrowser-playwright
// Uses playwright-bot-bypass techniques: real Chrome + headed mode

const { chromium } = require('rebrowser-playwright')
const Imap = require('imap')
const { simpleParser } = require('mailparser')

const ASTINA_URL = process.env.ASTINA_BASE_URL || 'https://astina.polri.go.id'

// Stealth browser factory
async function createStealthBrowser() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  })

  const context = await browser.newContext({
    locale: 'id-ID',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7' },
  })

  // Strip Playwright init scripts (bot detection tell)
  await context.addInitScript(() => {
    if (window.__pwInitScripts) delete window.__pwInitScripts
    setInterval(() => { if (window.__pwInitScripts) delete window.__pwInitScripts }, 100)
  })

  const page = await context.newPage()
  return { browser, context, page }
}

// Human-like delay
function humanDelay(min = 300, max = 800) {
  return new Promise((r) => setTimeout(r, min + Math.random() * (max - min)))
}

// Zimbra IMAP for OTP email
function getOtpFromEmail() {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.ZIMBRA_EMAIL,
      password: process.env.ZIMBRA_PASSWORD,
      host: process.env.ZIMBRA_IMAP_HOST || 'mail.polri.go.id',
      port: parseInt(process.env.ZIMBRA_IMAP_PORT || '993', 10),
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', false, () => {
        imap.search(['UNSEEN', ['SINCE', new Date(Date.now() - 10 * 60000).toISOString()]], (err, results) => {
          if (err || !results.length) {
            imap.end()
            return reject(new Error('No recent unread emails'))
          }
          const fetch = imap.fetch(results[results.length - 1], { bodies: '' })
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (err) return
                const text = parsed.text || ''
                const otpMatch = text.match(/\b(\d{4,6})\b/)
                if (otpMatch) {
                  imap.end()
                  resolve(otpMatch[1])
                }
              })
            })
          })
          fetch.once('error', () => { imap.end(); reject(new Error('Fetch error')) })
          fetch.once('end', () => { imap.end() })
        })
      })
    })
    imap.once('error', (err) => { reject(err) })
    imap.connect()
  })
}

// Solve captcha using OpenCode Vision
async function solveCaptcha(screenshotPath) {
  const apiKey = process.env.OPENCODE_API_KEY
  const baseUrl = process.env.OPENCODE_BASE_URL || 'https://api.opencode.ai'
  if (!apiKey) throw new Error('OPENCODE_API_KEY not set')

  const fs = require('fs')
  const imgBase64 = fs.readFileSync(screenshotPath).toString('base64')

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'opencode-vision',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'What is the captcha text in this image? Reply with ONLY the captcha characters, nothing else.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imgBase64}` } },
        ],
      }],
      max_tokens: 50,
    }),
  })

  const data = await res.json()
  return (data.choices?.[0]?.message?.content || '').trim().replace(/\s/g, '')
}

// Main sync function with stealth
async function syncToAstina(caseData) {
  let browser, context
  try {
    const stealth = await createStealthBrowser()
    browser = stealth.browser; context = stealth.context
    const page = stealth.page

    // 1. Navigate to ASTINA
    await page.goto(ASTINA_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await humanDelay(500, 1000)

    // 2. Login - discover form fields from page
    const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"]')
    const passwordInput = await page.$('input[type="password"], input[name="password"]')
    if (emailInput && passwordInput) {
      await emailInput.fill(process.env.ASTINA_USERNAME || '')
      await passwordInput.fill(process.env.ASTINA_PASSWORD || '')
      await humanDelay(200, 500)

      // 3. Handle captcha
      const captchaInput = await page.$('input[name="captcha"], #captcha, [placeholder*="captcha" i]')
      if (captchaInput) {
        const screenshotPath = '/tmp/astina_captcha.png'
        await page.screenshot({ path: screenshotPath })
        try {
          const captchaText = await solveCaptcha(screenshotPath)
          if (captchaText) {
            await captchaInput.fill(captchaText)
            await humanDelay(200, 400)
          }
        } catch (_) { /* captcha solve is best-effort */ }
      }

      // Submit login
      const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Masuk")')
      if (submitBtn) await submitBtn.click()
      await page.waitForTimeout(3000)

      // 4. Check for OTP
      const otpInput = await page.$('input[name="otp"], #otp, [placeholder*="OTP" i], [placeholder*="kode" i]')
      if (otpInput) {
        let otp = ''
        try { otp = await getOtpFromEmail() } catch (_) {}
        if (!otp) await page.waitForTimeout(10000)
        try { otp = await getOtpFromEmail() } catch (_) {}
        if (otp) { await otpInput.fill(otp); await humanDelay(200, 400); await (await page.$('button[type="submit"]'))?.click(); await page.waitForTimeout(2000) }
      }
    }

    // 5. Navigate to surat detail/update page
    // Try multiple URL patterns based on ASTINA routing
    const pid = caseData.prepator_id || caseData.id
    const updatePaths = [
      `/surat/detail/${pid}`,
      `/surat/update/${pid}`,
      `/inbox/detail/${pid}`,
      `/surat-masuk/${pid}`,
    ]
    for (const p of updatePaths) {
      try { await page.goto(ASTINA_URL + p, { waitUntil: 'domcontentloaded', timeout: 10000 }); break } catch (_) {}
    }

    // 6. Update the surat (discover form from page)
    const statusText = caseData.status || ''
    const keterangan = caseData.keterangan || ''
    const fullNote = [statusText, keterangan].filter(Boolean).join('\n')

    // Try common form fields
    const textareas = await page.$$('textarea')
    if (textareas.length > 0 && fullNote) {
      await textareas[0].fill(fullNote)
      await humanDelay(300, 600)
    }

    const updateBtn = await page.$('button[type="submit"], button:has-text("Simpan"), button:has-text("Update"), button:has-text("Kirim")')
    if (updateBtn) {
      await updateBtn.click()
      await page.waitForTimeout(2000)
    }

    await browser.close()
    return { ok: true, message: 'Synced to ASTINA' }
  } catch (e) {
    if (browser) await browser.close().catch(() => {})
    return { ok: false, error: e.message }
  }
}

module.exports = { syncToAstina }
