'use client'

// ASTINA — Antrian Disposisi (auto-login + surat masuk + riwayat disposisi)
// Two-step login: (1) captcha+password (auto, ~5s), (2) OTP from Zimbra mail.
// Once authenticated, fetches /api/astina/surat-baru and expands each row
// with the full detail + riwayat disposisi.

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, RefreshCw, LogIn, Mail, ChevronRight, FileText, Users, Clock, Building2, AlertCircle, CheckCircle2 } from 'lucide-react'

const API = ''  // relative path — hits Next.js /api/* which is proxied by FastAPI

function classNames(...c) { return c.filter(Boolean).join(' ') }

async function apiJson(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { credentials: 'include', ...opts })
  if (r.headers.get('content-type')?.includes('application/json')) {
    return { status: r.status, body: await r.json() }
  }
  const text = await r.text()
  return { status: r.status, body: { ok: false, error: text.slice(0, 400) } }
}

export default function AstinaPage() {
  const [me, setMe] = useState(null)
  const [loginForm, setLoginForm] = useState({ username: 'kasubbid', password: 'kasubbid123' })
  const [astina, setAstina] = useState({ authenticated: false, has_token: false, otp_verified: false, user: null })
  const [busy, setBusy] = useState({ appLogin: false, astinaLogin: false, otp: false, imap: false, list: false })
  const [otpInput, setOtpInput] = useState('')
  const [msg, setMsg] = useState(null) // { type: 'success'|'error'|'info', text }
  const [surat, setSurat] = useState([])
  const [suratInfo, setSuratInfo] = useState({})
  const [expandedId, setExpandedId] = useState(null)
  const [details, setDetails] = useState({}) // { [id]: { detail, riwayat } }

  const notify = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 6000) }

  const refreshStatus = useCallback(async () => {
    const { body } = await apiJson('/api/astina/status')
    if (body?.ok) {
      setAstina(body.session)
      return body.session
    }
    return null
  }, [])

  const checkMe = useCallback(async () => {
    const { body } = await apiJson('/api/auth/me')
    if (body?.ok) {
      setMe(body.user)
      await refreshStatus()
    } else setMe(null)
  }, [refreshStatus])

  useEffect(() => { checkMe() }, [checkMe])

  // Auto-load surat whenever ASTINA becomes authenticated (initial mount OR post-login)
  useEffect(() => {
    if (astina.authenticated && surat.length === 0 && !busy.list) {
      loadSurat()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [astina.authenticated])

  const doAppLogin = async () => {
    setBusy((b) => ({ ...b, appLogin: true }))
    const { body } = await apiJson('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    })
    setBusy((b) => ({ ...b, appLogin: false }))
    if (body?.ok) { notify('success', `Login sebagai ${body.user.name}`); setMe(body.user); refreshStatus() }
    else notify('error', body?.error || 'Login gagal')
  }

  const doAstinaLogin = async () => {
    setBusy((b) => ({ ...b, astinaLogin: true }))
    setMsg({ type: 'info', text: 'Auto-login ASTINA: solving captcha → mengambil OTP dari Zimbra → validasi… (biasanya ~10 detik)' })
    const { body } = await apiJson('/api/astina/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wait_otp: true }),
    })
    setBusy((b) => ({ ...b, astinaLogin: false }))
    if (body?.ok) {
      notify('success', body.step === 'authenticated'
        ? `ASTINA authenticated (captcha=${body.captcha_used}, otp=${body.otp_used}) — memuat surat...`
        : `Step 1 OK (captcha=${body.captcha_used}) tapi auto-OTP gagal (${body.imap_error || 'unknown'}). Isi OTP manual di bawah.`)
      await refreshStatus()
    } else notify('error', body?.error || 'ASTINA login gagal')
  }

  const doFetchOtpImap = async () => {
    setBusy((b) => ({ ...b, imap: true }))
    const { body } = await apiJson('/api/astina/fetch-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    setBusy((b) => ({ ...b, imap: false }))
    if (body?.ok) notify('success', `OTP di-fetch dari Zimbra (${body.source}) & tervalidasi.`)
    else notify('error', body?.error || 'Fetch OTP gagal')
    refreshStatus()
  }

  const doVerifyOtp = async () => {
    if (!otpInput || otpInput.length < 4) return notify('error', 'OTP minimal 4 digit')
    setBusy((b) => ({ ...b, otp: true }))
    const { body } = await apiJson('/api/astina/verify-otp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: otpInput }),
    })
    setBusy((b) => ({ ...b, otp: false }))
    if (body?.ok) { notify('success', 'OTP tervalidasi. ASTINA siap.'); setOtpInput(''); refreshStatus() }
    else notify('error', body?.error || 'Verifikasi OTP gagal')
  }

  const loadSurat = async () => {
    setBusy((b) => ({ ...b, list: true }))
    const { body } = await apiJson('/api/astina/surat-baru?per_page=30&page=1')
    setBusy((b) => ({ ...b, list: false }))
    if (body?.status) {
      setSurat(body.data || [])
      setSuratInfo(body.info || {})
      notify('success', `${(body.data || []).length} surat masuk diambil dari ASTINA`)
    } else if (body?.error) notify('error', body.error)
    else notify('error', body?.message || 'Gagal ambil surat')
  }

  const toggleExpand = async (id) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!details[id]) {
      const { body } = await apiJson(`/api/astina/surat/${encodeURIComponent(id)}/riwayat`)
      if (body?.ok) setDetails((d) => ({ ...d, [id]: { riwayat: body.riwayat_disposisi } }))
      else notify('error', body?.error || 'Gagal ambil riwayat')
    }
  }

  // -------------------- RENDER --------------------
  if (!me) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800" data-testid="app-login-card">
          <CardHeader>
            <CardTitle className="text-2xl">SIMONDU — Antrian Disposisi</CardTitle>
            <p className="text-sm text-slate-400">Masuk dulu ke SIMONDU sebelum akses ASTINA</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} placeholder="username" className="bg-slate-800 border-slate-700 text-slate-100" data-testid="app-login-username" />
            <Input value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="password" type="password" className="bg-slate-800 border-slate-700 text-slate-100" data-testid="app-login-password" />
            <Button onClick={doAppLogin} disabled={busy.appLogin} className="w-full" data-testid="app-login-submit">
              {busy.appLogin ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
              Masuk
            </Button>
            <p className="text-xs text-slate-500 mt-2">Default: kasubbid / kasubbid123</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">ANTRIAN DISPOSISI — ASTINA POLRI</h1>
            <p className="text-xs text-slate-400">Auto-fetch surat masuk dari api-gw.polri.go.id</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div>
              <div className="text-slate-500 text-xs">SIMONDU</div>
              <div className="font-medium">{me.name}</div>
            </div>
            <div className="w-px h-8 bg-slate-800" />
            <div>
              <div className="text-slate-500 text-xs">ASTINA</div>
              <div className="flex items-center gap-1.5">
                {astina.authenticated ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white" data-testid="astina-badge-authenticated">✓ {astina.user?.nrp}</Badge>
                ) : astina.has_token ? (
                  <Badge className="bg-amber-600 hover:bg-amber-600 text-white" data-testid="astina-badge-otp">Butuh OTP</Badge>
                ) : (
                  <Badge className="bg-slate-700 hover:bg-slate-700 text-white" data-testid="astina-badge-signedout">Belum login</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {msg && (
        <div className={classNames(
          'max-w-7xl mx-auto mt-4 px-4 py-3 rounded-md flex items-start gap-2 text-sm',
          msg.type === 'success' && 'bg-emerald-900/40 border border-emerald-700 text-emerald-100',
          msg.type === 'error' && 'bg-rose-900/40 border border-rose-700 text-rose-100',
          msg.type === 'info' && 'bg-sky-900/40 border border-sky-700 text-sky-100',
        )} data-testid="notification-banner">
          {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : msg.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5" /> : <Loader2 className="w-4 h-4 mt-0.5 animate-spin" />}
          <span>{msg.text}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* ASTINA connection panel */}
        {!astina.authenticated && (
          <Card className="bg-slate-900 border-slate-800" data-testid="astina-connect-panel">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><LogIn className="w-4 h-4" /> Sambungkan ke ASTINA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Langkah 1 — Login otomatis</div>
                  <p className="text-sm text-slate-300">Solve captcha via Gemini Vision → POST /auth/login_web dengan kredensial dari .env</p>
                  <Button onClick={doAstinaLogin} disabled={busy.astinaLogin} className="w-full" data-testid="astina-step1-btn">
                    {busy.astinaLogin ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
                    Auto-login ASTINA
                  </Button>
                  {astina.user && (
                    <div className="text-xs bg-slate-800/50 rounded p-2 mt-2">
                      <div className="text-slate-400">Session:</div>
                      <div>{astina.user.name}</div>
                      <div className="text-slate-500">{astina.user.jabatan_name}</div>
                    </div>
                  )}
                </div>
                <div className="rounded-lg border border-slate-800 p-4 space-y-2">
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Langkah 2 — Verifikasi OTP</div>
                  <p className="text-sm text-slate-300">OTP dikirim ke email <span className="text-slate-100 font-mono">{process.env.NEXT_PUBLIC_ZIMBRA_EMAIL || '87041658@polri.go.id'}</span>.</p>
                  <div className="flex gap-2">
                    <Input inputMode="numeric" maxLength={8} placeholder="6-digit OTP" value={otpInput} onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} disabled={!astina.has_token} className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-center tracking-widest" data-testid="astina-otp-input" />
                    <Button onClick={doVerifyOtp} disabled={busy.otp || !astina.has_token} data-testid="astina-otp-verify-btn">
                      {busy.otp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                    </Button>
                  </div>
                  <Button variant="secondary" onClick={doFetchOtpImap} disabled={busy.imap || !astina.has_token} className="w-full" data-testid="astina-fetch-otp-btn">
                    {busy.imap ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                    Ambil OTP otomatis dari Zimbra
                  </Button>
                  <details className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    <summary className="cursor-pointer hover:text-slate-400">
                      Auto-fetch gagal? Panduan aktifkan IMAP di Zimbra ▾
                    </summary>
                    <ol className="list-decimal ml-4 mt-2 space-y-1 text-slate-500">
                      <li>Login ke <a href="https://mail.polri.go.id" target="_blank" className="text-sky-400 underline">mail.polri.go.id</a> lewat browser.</li>
                      <li>Klik ikon <span className="text-slate-300">gear</span> (pojok kanan atas) → <span className="text-slate-300">Preferences</span> / <span className="text-slate-300">Settings</span>.</li>
                      <li>Buka tab <span className="text-slate-300">Mail</span> → scroll bagian <span className="text-slate-300">Access from Other Mail Clients</span>.</li>
                      <li>Centang <span className="text-slate-300">Enable IMAP access</span> dan (opsional) <span className="text-slate-300">POP3</span>.</li>
                      <li>Klik <span className="text-slate-300">Save</span> — tunggu 1–2 menit, lalu coba lagi tombol "Ambil OTP".</li>
                      <li>Jika tetap gagal, gunakan input manual di atas: buka webmail → catat OTP → tempel di kotak <em>6-digit OTP</em>.</li>
                    </ol>
                  </details>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Surat masuk */}
        {astina.authenticated && (
          <>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Surat Masuk (Siap Disposisi)</CardTitle>
                <Button size="sm" onClick={loadSurat} disabled={busy.list} data-testid="astina-refresh-surat-btn">
                  {busy.list ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Ambil Surat Terbaru
                </Button>
              </CardHeader>
              <CardContent>
                {surat.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-sm" data-testid="empty-surat">
                    Belum ada surat. Klik "Ambil Surat Terbaru".
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="surat-list">
                    {surat.map((s) => (
                      <div key={s.id} className="rounded-lg border border-slate-800 hover:border-slate-700 transition overflow-hidden" data-testid={`surat-row-${s.id}`}>
                        <button onClick={() => toggleExpand(s.id)} className="w-full text-left p-4 flex items-center gap-3">
                          <ChevronRight className={classNames('w-4 h-4 text-slate-500 transition', expandedId === s.id && 'rotate-90')} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">{s.klasifikasi || s.jenis_name || 'BIASA'}</Badge>
                              {s.tipe && <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">{s.tipe}</Badge>}
                              {s.kka_name && <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">{s.kka_name}</Badge>}
                              <span className="text-xs text-slate-500 ml-auto">{s.tanggal_surat} · {s.jam}</span>
                            </div>
                            <div className="text-sm font-medium text-slate-100 truncate">{s.perihal || '(tanpa perihal)'}</div>
                            <div className="text-xs text-slate-400 truncate flex items-center gap-2 mt-1">
                              <Users className="w-3 h-3" /> {s.dari_name || s.pengirim || '-'}
                              {s.no_surat && <span className="text-slate-500">· No: {s.no_surat}</span>}
                            </div>
                          </div>
                        </button>

                        {expandedId === s.id && (
                          <div className="border-t border-slate-800 bg-slate-900/50 p-4 space-y-4" data-testid={`surat-detail-${s.id}`}>
                            <div className="grid gap-4 md:grid-cols-2 text-sm">
                              <div>
                                <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Informasi Surat</div>
                                <dl className="space-y-1 text-slate-300">
                                  <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Nomor</dt><dd className="font-mono">{s.no_surat || '-'}</dd></div>
                                  <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Tgl Surat</dt><dd>{s.tanggal_surat || '-'}</dd></div>
                                  <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Diterima</dt><dd>{s.tanggal || s.created_at}</dd></div>
                                  <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Klasifikasi</dt><dd>{s.klasifikasi || '-'}</dd></div>
                                  <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Derajat</dt><dd>{s.derajat || '-'}</dd></div>
                                  <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Tipe</dt><dd>{s.tipe || '-'}</dd></div>
                                  <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Pembuat</dt><dd>{s.pembuat_surat || '-'}</dd></div>
                                  {s.note && <div className="flex"><dt className="w-32 text-slate-500 shrink-0">Catatan</dt><dd className="italic">{s.note}</dd></div>}
                                </dl>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide flex items-center gap-1.5"><Clock className="w-3 h-3" /> Riwayat Disposisi</div>
                                {details[s.id]?.riwayat && details[s.id].riwayat.length > 0 ? (
                                  <ol className="relative border-l-2 border-slate-800 pl-4 space-y-3">
                                    {details[s.id].riwayat.map((r, idx) => {
                                      const noteArr = Array.isArray(r.note) ? r.note : (r.note ? [r.note] : [])
                                      const tujuanArr = Array.isArray(r.tujuan) ? r.tujuan : (r.tujuan_name ? [r.tujuan_name] : [])
                                      return (
                                        <li key={r.id || idx} className="text-xs">
                                          <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-950" />
                                          <div className="flex items-baseline gap-2">
                                            <span className="text-slate-100 font-medium">{r.jenis || 'Disposisi'}</span>
                                            <span className="text-slate-500">{r.tanggal || (r.created_at || '').slice(0, 10)} {r.waktu || ''}</span>
                                          </div>
                                          <div className="text-slate-300 mt-0.5">
                                            <span className="text-slate-500">Dari:</span> {r.dari_name || '-'}
                                          </div>
                                          {tujuanArr.length > 0 && (
                                            <div className="text-slate-300">
                                              <span className="text-slate-500">Ke:</span> {tujuanArr.join(' · ')}
                                            </div>
                                          )}
                                          {(noteArr.length > 0 || r.custom_note) && (
                                            <div className="mt-1 rounded bg-slate-800/60 border border-slate-700 px-2 py-1 text-slate-200 italic">
                                              {noteArr.length > 0 ? noteArr.join(' · ') : r.custom_note}
                                            </div>
                                          )}
                                        </li>
                                      )
                                    })}
                                  </ol>
                                ) : details[s.id] ? (
                                  <div className="text-slate-500 text-xs italic">Belum ada disposisi tercatat di ASTINA</div>
                                ) : (
                                  <div className="text-slate-500 text-xs italic"><Loader2 className="w-3 h-3 inline animate-spin mr-1" /> Memuat...</div>
                                )}
                              </div>
                            </div>

                            {(() => {
                              const files = (s.file && s.file.length ? s.file : []).concat(s.lampiran || [])
                              if (files.length === 0) return null
                              return (
                                <div>
                                  <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Lampiran ({files.length})</div>
                                  <div className="space-y-1.5" data-testid={`surat-files-${s.id}`}>
                                    {files.map((f) => {
                                      const dl = `/api/astina/attachment/${encodeURIComponent(f.id)}?filename=${encodeURIComponent(f.filename || 'file')}`
                                      return (
                                        <div key={f.id} className="text-xs flex items-center gap-2 text-slate-300">
                                          <FileText className="w-3 h-3 text-slate-500 shrink-0" />
                                          <span className="truncate flex-1">{f.filename}</span>
                                          <a href={`${dl}&inline=1`} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline" data-testid={`file-view-${f.id}`}>Lihat</a>
                                          <a href={dl} className="text-sky-400 hover:text-sky-300 underline" data-testid={`file-download-${f.id}`}>Unduh</a>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {suratInfo?.total !== undefined && (
                  <div className="text-xs text-slate-500 mt-4 flex justify-between">
                    <span>Total: {suratInfo.total} · Halaman {suratInfo.current_page}/{suratInfo.last_page}</span>
                    <span>Data langsung dari <span className="font-mono">api-gw.polri.go.id/api-eoffice</span></span>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <div className="text-[11px] text-slate-600 text-center pt-4">
          SIMONDU_WEB · Kasubbid Paminal Bidpropam Polda Jabar · Data: ASTINA (api-gw.polri.go.id)
        </div>
      </main>
    </div>
  )
}
