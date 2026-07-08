'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Shield, LayoutDashboard, FolderKanban, Send, ClipboardList, LogOut, Search,
  Loader2, FileText, RefreshCw, ChevronDown, ChevronLeft, ChevronRight, Download, Paperclip,
  Building2, User, Calendar, Tag, CheckCircle2, XCircle, Clock,
  AlertCircle, ArrowRightLeft, History, Star, QrCode, Mail, Phone, MapPin,
  Bell, Hash, Ban, Scale, Settings, Eye, EyeOff, GripVertical,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, PieChart, Pie, Cell, Legend, CartesianGrid } from 'recharts'
import { STATUS, RESOLUSI, BUCKET, getBucket } from '../lib/status.js'

const APP_NAME = 'SIMONDU WEB'
const APP_SUBTITLE = 'Sistem Monitoring Pengaduan — Polda Jabar'

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    cache: 'no-store',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({ ok: false, error: 'Bad response' }))
  if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}
// ---------------- Helpers ----------------
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const monthRoman = (d) => ROMAN[(d || new Date()).getMonth()]
const fmtDate = (d) => {
  if (!d) return '-'
  const n = typeof d === 'number' ? d : Date.parse(d)
  if (!n) return '-'
  return new Date(n).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
const fmtDateShort = (d) => {
  if (!d) return '-'
  const n = typeof d === 'number' ? d : Date.parse(d)
  if (!n) return '-'
  return new Date(n).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
const shortUnit = (u) => (u || '').replace(' SUBBID PAMINAL POLDA JAWA BARAT', ' PAMINAL').replace(' POLDA JAWA BARAT', '')

const statusColor = (s) => {
  if (!s) return 'bg-slate-100 text-slate-700 border-slate-300'
  if (/selesai/i.test(s)) return 'bg-green-100 text-green-800 border-green-300'
  if (/tolak/i.test(s)) return 'bg-red-100 text-red-800 border-red-300'
  if (/lidik|henti/i.test(s)) return 'bg-purple-100 text-purple-800 border-purple-300'
  if (/distribusi/i.test(s)) return 'bg-blue-100 text-blue-800 border-blue-300'
  if (/diterima/i.test(s)) return 'bg-amber-100 text-amber-800 border-amber-300'
  if (/perdamaian|restorative|pencabutan/i.test(s)) return 'bg-emerald-100 text-emerald-800 border-emerald-300'
  return 'bg-slate-100 text-slate-700 border-slate-300'
}
const sourceColor = (s) => {
  if (!s) return 'bg-slate-100 text-slate-700'
  if (/qr/i.test(s)) return 'bg-orange-100 text-orange-800 border-orange-300'
  if (/surat/i.test(s)) return 'bg-cyan-100 text-cyan-800 border-cyan-300'
  return 'bg-slate-100 text-slate-700 border-slate-300'
}
const bucketColor = (b) => {
  if (b === 'SURAT_MASUK') return 'bg-blue-100 text-blue-800 border-blue-300'
  if (b === 'DALAM_PENANGANAN') return 'bg-amber-100 text-amber-800 border-amber-300'
  if (b === 'SELESAI') return 'bg-green-100 text-green-800 border-green-300'
  return 'bg-slate-100 text-slate-700 border-slate-300'
}
const SyncBadge = memo(function SyncBadge({ status }) {
  if (status === 'synced') return <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px]"><span className="h-2 w-2 rounded-full bg-green-500 mr-1 inline-block" />Tersinkron</Badge>
  if (status === 'failed') return <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]"><span className="h-2 w-2 rounded-full bg-red-500 mr-1 inline-block" />Gagal</Badge>
  return <Badge className="bg-slate-100 text-slate-600 border-slate-300 text-[10px]"><span className="h-2 w-2 rounded-full bg-slate-400 mr-1 inline-block" />Belum Sync</Badge>
})

// ---------------- Login ----------------
function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState('kasubbid')
  const [password, setPassword] = useState('kasubbid123')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
      toast.success(`Selamat datang, ${r.user.name}`)
      onSuccess(r.user)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-20 w-20 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mb-4 shadow-2xl">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{APP_NAME}</h1>

        </div>
        <Card className="border-white/10 shadow-2xl backdrop-blur-lg bg-white/95">
          <CardHeader>
            <CardTitle>Login Internal</CardTitle>
            
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label htmlFor="u">Username</Label>
                <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
              </div>
              <div>
                <Label htmlFor="p">Password</Label>
                <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-blue-800 hover:bg-blue-900">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Masuk
              </Button>
            </form>

          </CardContent>
        </Card>

      </div>
    </div>
  )
}

// ---------------- Dashboard ----------------
function Dashboard({ user }) {
  const [anev, setAnev] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('paminal')

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api(`/anev?scope=${scope}`); setAnev(r) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [scope])
  useEffect(() => { load() }, [load])

  const COLORS = useMemo(() => ['#1e40af', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#dc2626', '#4338ca', '#9333ea'], [])
  const bucketCounts = useMemo(() => {
    const counts = { SURAT_MASUK: 0, DALAM_PENANGANAN: 0, SELESAI: 0 }
    if (!anev?.byStatus) return counts
    for (const { name, value } of anev.byStatus) {
      const b = getBucket(name)
      if (b) counts[b] += value
    }
    return counts
  }, [anev])
  if (loading || !anev) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard ANEV</h2>
        </div>
        <div className="flex items-center gap-3">
          {user.role !== 'unit' && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">Cakupan:</span>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paminal">Paminal & Unit</SelectItem>
                  <SelectItem value="all">Semua Polda Jabar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard color="blue" icon={<Mail />} label="SURAT MASUK" value={bucketCounts.SURAT_MASUK} />
        <KpiCard color="amber" icon={<Clock />} label="DALAM PENANGANAN" value={bucketCounts.DALAM_PENANGANAN} />
        <KpiCard color="green" icon={<CheckCircle2 />} label="SELESAI" value={bucketCounts.SELESAI} />
      </div>

      {anev.kpi.totalAtensi > 0 && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 flex items-center gap-3">
          <Star className="h-6 w-6 text-amber-600 fill-amber-500" />
          <div>
            <p className="font-semibold text-amber-900">{anev.kpi.totalAtensi} kasus ATENSI</p>

          </div>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi per Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={anev.byStatus.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
                <YAxis />
                <RTooltip />
                <Bar dataKey="value" fill="#1e40af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi per Kategori (Top 8)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={anev.byCategory.slice(0, 8)} dataKey="value" nameKey="name" outerRadius={90}>
                  {anev.byCategory.slice(0, 8).map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi per Unit Penanganan</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={anev.byUnit.slice(0, 12).map(x => ({ ...x, name: shortUnit(x.name) }))} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={220} tick={{ fontSize: 11 }} />
              <RTooltip />
              <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

const KpiCard = memo(function KpiCard({ color, icon, label, value, subtitle }) {
  const bg = { blue: 'border-l-blue-800 bg-blue-50/40 text-blue-800',
              amber: 'border-l-amber-500 bg-amber-50/40 text-amber-700',
              purple: 'border-l-purple-600 bg-purple-50/40 text-purple-700',
              green: 'border-l-green-600 bg-green-50/40 text-green-700' }[color] || 'border-l-slate-500'
  return (
    <Card className={`border-l-4 ${bg.split(' ')[0]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1 text-slate-900">{(value || 0).toLocaleString('id-ID')}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`h-11 w-11 rounded-lg ${bg} flex items-center justify-center`}>
            {icon && <div className="h-5 w-5">{icon}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

// ---------------- Case Detail Sheet ----------------
function CaseDetail({ pid, user, onClose, onChanged }) {
  const [data, setData] = useState(null)
  const [atts, setAtts] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [terimaLoading, setTerimaLoading] = useState(false)
  const [showFullChronology, setShowFullChronology] = useState(false)
  const [mergedTimeline, setMergedTimeline] = useState([])
  const [reference, setReference] = useState({ hasil_lidik_options: [], settlement_options: [], satker_satwil: [] })
  const [notingItem, setNotingItem] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [perdamaianOpen, setPerdamaianOpen] = useState(false)
  const [perdamaianChecks, setPerdamaianChecks] = useState({
    material1: false, material2: false, material3: false, material4: false,
    prinsip1: false, prinsip2: false,
  })
  const [perdamaianTab, setPerdamaianTab] = useState('sebelum')
  const [perdamaianSebelum, setPerdamaianSebelum] = useState({ pencabutan: false, klarifikasi: false, ba_introgasi: false })
  const [perdamaianSetelah, setPerdamaianSetelah] = useState({ permohonan_gelar: false, rekomendasi_gelar: false, surat_henti: false, buku_register: false, surat_ankum: false })
  const allPerdamaianChecked = Object.values(perdamaianChecks).every(Boolean) && (perdamaianTab === 'sebelum' ? Object.values(perdamaianSebelum).every(Boolean) : Object.values(perdamaianSetelah).every(Boolean))

  const load = async () => {
    setLoading(true)
    try {
      const [d, a, t] = await Promise.all([
        api(`/cases/${encodeURIComponent(pid)}`),
        api(`/cases/${encodeURIComponent(pid)}/attachments`),
        api(`/cases/${encodeURIComponent(pid)}/timeline-all`).catch(() => ({ data: [] })),
      ])
      setData(d.data); setAtts(a.data); setMergedTimeline(t.data || [])
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { if (pid) load() }, [pid])
  useEffect(() => { api('/reference').then(setReference).catch(() => {}) }, [])

  const doSetChecklistStatus = async (documentType, status, note) => {
    try {
      await api(`/cases/${encodeURIComponent(pid)}/checklist/${encodeURIComponent(documentType)}`, { method: 'POST', body: JSON.stringify({ status, note: note || '' }) })
      toast.success('Status checklist diperbarui')
      setNotingItem(null); setNoteDraft('')
      await load(); onChanged?.()
    } catch (e) { toast.error(e.message) }
  }
  const doSetOutcome = async (patch) => {
    try {
      await api(`/cases/${encodeURIComponent(pid)}/outcome`, { method: 'POST', body: JSON.stringify(patch) })
      await load(); onChanged?.()
    } catch (e) { toast.error(e.message) }
  }
  const doPerdamaian = async () => {
    if (!allPerdamaianChecked) return toast.error('Semua syarat harus diceklist terlebih dahulu')
    try {
      await api(`/cases/${encodeURIComponent(pid)}/perdamaian`, { method: 'POST', body: JSON.stringify({ checks: perdamaianChecks, tab: perdamaianTab, sebelum: perdamaianTab === 'sebelum' ? perdamaianSebelum : null, setelah: perdamaianTab === 'setelah' ? perdamaianSetelah : null }) })
      toast.success('Perdamaian dicatat · status & timeline diperbarui')
      setPerdamaianOpen(false)
      setPerdamaianChecks({
        material1: false, material2: false, material3: false, material4: false,
        prinsip1: false, prinsip2: false,
      })
      setPerdamaianSebelum({ pencabutan: false, klarifikasi: false, ba_introgasi: false })
      setPerdamaianSetelah({ permohonan_gelar: false, rekomendasi_gelar: false, surat_henti: false, buku_register: false, surat_ankum: false })
      await load(); onChanged?.()
    } catch (e) { toast.error(e.message) }
  }
  const togglePerdamaianCheck = (key) => {
    if (perdamaianTab === 'sebelum' && key in perdamaianSebelum) {
      setPerdamaianSebelum((p) => ({ ...p, [key]: !p[key] }))
    } else if (perdamaianTab === 'setelah' && key in perdamaianSetelah) {
      setPerdamaianSetelah((p) => ({ ...p, [key]: !p[key] }))
    } else {
      setPerdamaianChecks((p) => ({ ...p, [key]: !p[key] }))
    }
  }
  const resetPerdamaian = () => {
    setPerdamaianChecks({
      material1: false, material2: false, material3: false, material4: false,
      prinsip1: false, prinsip2: false,
    })
    setPerdamaianSebelum({ pencabutan: false, klarifikasi: false, ba_introgasi: false })
    setPerdamaianSetelah({ permohonan_gelar: false, rekomendasi_gelar: false, surat_henti: false, buku_register: false, surat_ankum: false })
  }
  const doComplete = async () => {
    if (!confirm('Tandai kasus ini SELESAI?')) return
    setCompleting(true)
    try {
      await api(`/cases/${encodeURIComponent(pid)}/complete`, { method: 'POST', body: JSON.stringify({ note: 'Ditandai selesai' }) })
      toast.success('Kasus ditandai Selesai · disinkronisasi otomatis')
      await load(); onChanged?.()
    } catch (e) { toast.error(e.message) }
    finally { setCompleting(false) }
  }
  const doTerima = async () => {
    setTerimaLoading(true)
    try {
      await api(`/cases/${encodeURIComponent(pid)}/terima`, { method: 'POST' })
      toast.success('Kasus diterima · status diperbarui')
      await load(); onChanged?.()
    } catch (e) { toast.error(e.message) }
    finally { setTerimaLoading(false) }
  }

  if (!pid) return null
  const checklist = data?._internal?.checklist
  const outcome = data?._internal?.outcome
  const canComplete = data && (user.role === 'unit' ? data.disposisi_case_position === user.unit : true) && data?.status !== STATUS.SELESAI && (checklist ? checklist.canComplete : true)
  const latestDisp = data?._internal?.dispositions?.[data._internal.dispositions.length - 1]
  const canTerima = user.role === 'unit' && latestDisp?.to_unit === user.unit && getBucket(data?.status) === 'SURAT_MASUK'

  return (
    <Sheet open={!!pid} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto p-0">
        <VisuallyHidden>
          <SheetTitle>Detail Kasus {pid}</SheetTitle>

        </VisuallyHidden>
        {loading || !data ? (
          <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div>
        ) : (
          <div>
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 shadow-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs uppercase tracking-wide text-blue-200">ID Kasus</p>
                    {data.is_atensi && <Badge className="bg-amber-400 text-amber-950 text-[10px]"><Star className="h-3 w-3 mr-0.5 fill-amber-800" />ATENSI</Badge>}
                  </div>
                  <p className="text-lg font-bold font-mono">{data.prepetrator_id}</p>
                  <p className="text-sm mt-2 text-blue-100 line-clamp-2">{data.prepetrator_name || '(Tanpa nama terlapor)'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <Badge className={`${bucketColor(getBucket(data.status))} text-xs`}>{getBucket(data.status) || data.status}</Badge>
                    {data.resolusi && <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">{data.resolusi}</Badge>}
                    <SyncBadge status={data._sync_status} />
                  </div>
                  <p className="text-xs text-blue-200">Gajamada: {data.status_label || '-'}</p>
                  {data.status && data.status_label && data.status !== data.status_label && (
                    <p className="text-[10px] text-amber-300 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Status SIMONDU & Gajamada berbeda</p>
                  )}
                  <p className="text-xs text-blue-200">{fmtDate(data.created_date)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {canTerima && (
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={doTerima} disabled={terimaLoading}>
                    {terimaLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Terima
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setPerdamaianOpen(true)}><ClipboardList className="h-4 w-4 mr-1" /> Perdamaian</Button>
                {canComplete && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={doComplete} disabled={completing}>
                    {completing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Tandai Selesai
                  </Button>
                )}
              </div>

            </div>

            <div className="p-6">
              <Tabs defaultValue="info">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="attach">Sumber ({atts.length})</TabsTrigger>
                  <TabsTrigger value="docs">Tindak Lanjut {checklist ? `(${checklist.requiredProgress.completed}/${checklist.requiredProgress.total})` : ''}</TabsTrigger>
                  <TabsTrigger value="timeline">Timeline ({mergedTimeline.length})</TabsTrigger>
                  <TabsTrigger value="sync">Sync ({data._internal?.sync_logs?.length || 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Informasi Kasus</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      <InfoRow icon={<Tag className="h-4 w-4" />} label="Kategori" value={data.category} />
                      <InfoRow icon={<Building2 className="h-4 w-4" />} label="Unit Penanganan Saat Ini" value={data.disposisi_case_position} />
                      <InfoRow icon={<User className="h-4 w-4" />} label="Terlapor" value={data.prepetrator_name} />
                      <InfoRow icon={<User className="h-4 w-4" />} label="Pelapor" value={`${data.pengirim || '-'}${data.reporter_nik ? ` · NIK ${data.reporter_nik}` : ''}`} />
                      <InfoRow icon={<Phone className="h-4 w-4" />} label="Telp Pelapor" value={data.phone_no} />
                      <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={data.email} />
                      <InfoRow icon={<MapPin className="h-4 w-4" />} label="Tempat Peristiwa" value={data['5w1h_where']} />
                      <InfoRow icon={<Calendar className="h-4 w-4" />} label="Waktu Peristiwa" value={fmtDate(data['5w1h_when'])} />
                      <InfoRow icon={<QrCode className="h-4 w-4" />} label="Sumber" value={data.source_alias} />
                      <InfoRow icon={<Calendar className="h-4 w-4" />} label="Diterima" value={fmtDate(data.created_date)} />
                    </CardContent>
                  </Card>
                  {(data.summary || data.content) && (
                    <Card>
                      <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">Kronologis</CardTitle>
                        {data.summary && data.content && data.content !== data.summary && (
                          <Button size="sm" variant="outline" onClick={() => setShowFullChronology(!showFullChronology)}>
                            {showFullChronology ? 'Tampilkan Singkat' : 'Tampilkan Lengkap'}
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {showFullChronology ? (data.content || data.summary) : (data.summary || data.content)}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Riwayat Disposisi Internal</CardTitle></CardHeader>
                    <CardContent>
                      {(data._internal?.dispositions?.length || 0) === 0 ? <p className="text-sm text-slate-500">Belum ada disposisi internal.</p> :
                        <div className="space-y-2">
                          {data._internal.dispositions.map((d) => (
                            <div key={d.id} className="border-l-2 border-blue-500 pl-3 py-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">→ {shortUnit(d.to_unit)}</p>
                                {d.is_atensi && <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]"><Star className="h-3 w-3 mr-0.5" /> ATENSI</Badge>}
                              </div>
                              <p className="text-xs text-slate-500">oleh {d.by?.name} · {fmtDate(d.created_at)}</p>
                              {d.note && <p className="text-sm mt-1">{d.note}</p>}
                            </div>
                          ))}
                        </div>}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="attach" className="mt-4">
                  <Card><CardHeader className="pb-2">
                    <CardTitle className="text-sm">Dokumen Sumber Pengaduan (Gajamada)</CardTitle>
</CardHeader>
                    <CardContent>
                      {atts.length === 0 ? <p className="text-sm text-slate-500">Tidak ada lampiran.</p> :
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {atts.map((a, i) => (
                            <a key={i} href={`/api/download?url=${encodeURIComponent(a.url)}&name=${encodeURIComponent(a.file_name + '.' + a.file_type)}`} target="_blank" rel="noreferrer"
                              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 transition-colors group">
                              <div className="h-10 w-10 rounded bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0"><Paperclip className="h-5 w-5" /></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{a.file_name}</p>
                                <p className="text-xs text-slate-500">{(a.file_type || '').toUpperCase()} · {fmtDateShort(a.created_at)}</p>
                              </div>
                              <Download className="h-4 w-4 text-slate-400 group-hover:text-blue-800" />
                            </a>
                          ))}
                        </div>}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="docs" className="mt-4 space-y-4">
                  <Card className="border-blue-200 bg-blue-50/30">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-blue-800" /> Hasil Lidik & Pelimpahan</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Hasil Lidik</Label>
                        <Select value={outcome?.hasil_lidik || '__none'} onValueChange={(v) => doSetOutcome({ hasil_lidik: v === '__none' ? null : v, settlement: outcome?.settlement })}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Belum ditentukan" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Belum ditentukan</SelectItem>
                            {reference.hasil_lidik_options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Pelimpahan ke Satker/Satwil</Label>
                        <Select value={outcome?.pelimpahan || '__none'} onValueChange={(v) => doSetOutcome({ ...outcome, pelimpahan: v === '__none' ? null : v })}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Tidak ada" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Tidak ada</SelectItem>
                            {reference.satker_satwil?.map((o) => <SelectItem key={o.id} value={o.name}>{o.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {checklist && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-slate-700">Kelengkapan Dokumen Wajib</p>
                          <p className="text-sm font-bold text-blue-800">{checklist.requiredProgress.completed} / {checklist.requiredProgress.total}</p>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-blue-800 rounded-full transition-all" style={{ width: `${checklist.requiredProgress.total ? (checklist.requiredProgress.completed / checklist.requiredProgress.total) * 100 : 100}%` }} />
                        </div>

                      </CardContent>
                    </Card>
                  )}

                  {['perencanaan', 'pelaksanaan', 'tindak_lanjut', 'cabang_terbukti', 'cabang_tidak_terbukti'].map((stage) => {
                    const items = (checklist?.items || []).filter((i) => i.stage === stage)
                    if (items.length === 0) return null
                    return (
                      <Card key={stage}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm">{reference.stage_labels?.[stage] || stage}</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {items.map((item) => (
                            <div key={item.key} className="border rounded-lg p-3">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium">{item.label}</p>
                                    {!item.required && <Badge variant="outline" className="text-[10px]">Opsional</Badge>}
                                  </div>
                                  {item.note && <p className="text-xs text-slate-500 mt-1 italic">Catatan: {item.note}</p>}
                                </div>
                                <Badge className={`text-[10px] ${item.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' : item.status === 'not_applicable' ? 'bg-slate-100 text-slate-500 border-slate-300' : 'bg-amber-100 text-amber-800 border-amber-300'}`}>
                                  {item.status === 'completed' ? 'Lengkap' : item.status === 'not_applicable' ? 'Tidak Berlaku' : 'Belum Lengkap'}
                                </Badge>
                              </div>

                              {notingItem === item.key ? (
                                <div className="mt-2 flex items-center gap-2">
                                  <Input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Catatan (opsional)..." className="h-8 text-xs" />
                                  <Button size="sm" className="h-8" onClick={() => doSetChecklistStatus(item.key, 'not_applicable', noteDraft)}>Simpan</Button>
                                  <Button size="sm" variant="ghost" className="h-8" onClick={() => { setNotingItem(null); setNoteDraft('') }}>Batal</Button>
                                </div>
                              ) : (
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  {item.status !== 'not_applicable' ? (
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={() => setNotingItem(item.key)}><Ban className="h-3 w-3 mr-1" /> Tidak Berlaku</Button>
                                  ) : (
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500" onClick={() => doSetChecklistStatus(item.key, 'pending', '')}>Aktifkan Lagi</Button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )
                  })}
                </TabsContent>

                <TabsContent value="timeline" className="mt-4">
                  <Card><CardHeader className="pb-2">
                    <CardTitle className="text-sm">Timeline Tindak Lanjut</CardTitle>
                  </CardHeader>
                    <CardContent>
                      {mergedTimeline.length === 0 ? <p className="text-sm text-slate-500">Timeline masih kosong.</p> :
                        <ol className="relative border-l-2 border-blue-200 ml-3 space-y-4">
                          {mergedTimeline.map((t) => (
                            <li key={t.id} className="ml-4 relative">
                              <div className={`absolute -left-[24px] w-4 h-4 rounded-full border-2 border-white ${t.source === 'gajamada' ? 'bg-slate-600' : 'bg-blue-800'}`} />
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium">{t.title || t.status}</p>
                                <Badge variant="outline" className={`text-[10px] ${t.source === 'gajamada' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-800'}`}>
                                  {t.source === 'gajamada' ? 'Gajamada' : 'Internal'}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {t.officer_report_name || '-'} · {fmtDate(t.date_activity)}
                              </p>
                              {(t.previous_case_position || t.case_position) && t.previous_case_position !== t.case_position && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {shortUnit(t.previous_case_position)} → <span className="font-medium">{shortUnit(t.case_position)}</span>
                                </p>
                              )}
                              {t.description && <p className="text-sm mt-1 text-slate-700 whitespace-pre-wrap">{t.description}</p>}
                            </li>
                          ))}
                        </ol>}
                    </CardContent></Card>
                </TabsContent>

                <TabsContent value="sync" className="mt-4">
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Log Sinkronisasi Otomatis ke Gajamada</CardTitle>
</CardHeader>
                    <CardContent>
                      {(data._internal?.sync_logs?.length || 0) === 0 ? <p className="text-sm text-slate-500">Belum ada aktivitas sinkronisasi.</p> :
                        <div className="space-y-2">
                          {data._internal.sync_logs.map((s) => (
                            <div key={s.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge className={s.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                    {s.status === 'success' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />} {s.status}
                                  </Badge>
                                  {s.reason && <Badge variant="outline" className="text-[10px]">{s.reason}</Badge>}
                                </div>
                                <p className="text-xs text-slate-500">{fmtDate(s.request_at)}</p>
                              </div>
                              {s.error && <p className="text-xs text-red-700 mt-2">{s.error}</p>}
                            </div>
                          ))}
                        </div>}
                    </CardContent></Card>
                </TabsContent>
              </Tabs>
            </div>

            <Dialog open={perdamaianOpen} onOpenChange={setPerdamaianOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Perdamaian</DialogTitle></DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <Tabs value={perdamaianTab} onValueChange={setPerdamaianTab}>
                    <TabsList className="grid grid-cols-2 w-full">
                      <TabsTrigger value="sebelum">Sebelum Lidik</TabsTrigger>
                      <TabsTrigger value="setelah">Setelah Lidik</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sebelum" className="space-y-4 mt-4">
                      <div>
                        <p className="text-sm font-semibold mb-2">1. Syarat Material</p>
                        <div className="space-y-2">
                          {[
                            { key: 'material1', label: 'Tidak menimbulkan keresahan dan penolakan dari masyarakat' },
                            { key: 'material2', label: 'Tidak berdampak konflik sosial' },
                            { key: 'material3', label: 'Adanya pernyataan dari semua pihak yang terlibat untuk tidak keberatan' },
                            { key: 'material4', label: 'Memenuhi kriteria Prinsip pembatas' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-start gap-2">
                              <Checkbox id={`p-${item.key}`} checked={perdamaianChecks[item.key]} onCheckedChange={() => togglePerdamaianCheck(item.key)} />
                              <Label htmlFor={`p-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">2. Prinsip Pembatas</p>
                        <div className="space-y-2">
                          {[
                            { key: 'prinsip1', label: 'Tingkat kesalahan pelaku tidak berat dengan mempertimbangkan niat dan tujuan pelaku (Mensrea)' },
                            { key: 'prinsip2', label: 'Pelaku bukan anggota yang sering melakukan pelanggaran Disiplin dan/atau KEPP dan pertimbangan ankum layak untuk perdamaian' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-start gap-2">
                              <Checkbox id={`p-${item.key}`} checked={perdamaianChecks[item.key]} onCheckedChange={() => togglePerdamaianCheck(item.key)} />
                              <Label htmlFor={`p-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">3. Mekanisme</p>
                        <div className="space-y-2">
                          {[
                            { key: 'pencabutan', label: 'Surat Pencabutan Laporan oleh pelapor di atas meterai' },
                            { key: 'klarifikasi', label: 'Surat Permohonan Perdamaian / Klarifikasi dari kedua belah pihak' },
                            { key: 'ba_introgasi', label: 'Berita acara introgasi / pemeriksaan tambahan terhadap kedua belah pihak' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-start gap-2">
                              <Checkbox id={`p-${item.key}`} checked={perdamaianSebelum[item.key]} onCheckedChange={() => togglePerdamaianCheck(item.key)} />
                              <Label htmlFor={`p-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="setelah" className="space-y-4 mt-4">
                      <div>
                        <p className="text-sm font-semibold mb-2">1. Syarat Material</p>
                        <div className="space-y-2">
                          {[
                            { key: 'material1', label: 'Tidak menimbulkan keresahan dan penolakan dari masyarakat' },
                            { key: 'material2', label: 'Tidak berdampak konflik sosial' },
                            { key: 'material3', label: 'Adanya pernyataan dari semua pihak yang terlibat untuk tidak keberatan' },
                            { key: 'material4', label: 'Memenuhi kriteria Prinsip pembatas' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-start gap-2">
                              <Checkbox id={`p-${item.key}`} checked={perdamaianChecks[item.key]} onCheckedChange={() => togglePerdamaianCheck(item.key)} />
                              <Label htmlFor={`p-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">2. Prinsip Pembatas</p>
                        <div className="space-y-2">
                          {[
                            { key: 'prinsip1', label: 'Tingkat kesalahan pelaku tidak berat dengan mempertimbangkan niat dan tujuan pelaku (Mensrea)' },
                            { key: 'prinsip2', label: 'Pelaku bukan anggota yang sering melakukan pelanggaran Disiplin dan/atau KEPP dan pertimbangan ankum layak untuk perdamaian' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-start gap-2">
                              <Checkbox id={`p-${item.key}`} checked={perdamaianChecks[item.key]} onCheckedChange={() => togglePerdamaianCheck(item.key)} />
                              <Label htmlFor={`p-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">3. Mekanisme</p>
                        <div className="space-y-2">
                          {[
                            { key: 'permohonan_gelar', label: 'Surat Permohonan Gelar Perkara' },
                            { key: 'rekomendasi_gelar', label: 'Surat Rekomendasi Hasil Gelar Perkara' },
                            { key: 'surat_henti', label: 'Surat Perintah Penghentian Penyidikan / Lidik' },
                            { key: 'buku_register', label: 'Buku Register Perkara' },
                            { key: 'surat_ankum', label: 'Surat Jawaban Ankum / Kesatuan' },
                          ].map((item) => (
                            <div key={item.key} className="flex items-start gap-2">
                              <Checkbox id={`p-${item.key}`} checked={perdamaianSetelah[item.key]} onCheckedChange={() => togglePerdamaianCheck(item.key)} />
                              <Label htmlFor={`p-${item.key}`} className="text-xs cursor-pointer">{item.label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                  {!allPerdamaianChecked && (
                    <p className="text-xs text-red-600">Semua syarat harus diceklist sebelum menyimpan perdamaian.</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={resetPerdamaian}>Reset</Button>
                  <Button onClick={doPerdamaian} disabled={!allPerdamaianChecked}>
                    Simpan
                  </Button>
                </DialogFooter>
              </DialogContent>
      </Dialog>
    </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

const InfoRow = memo(function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-slate-400 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm text-slate-900 break-words">{value || '-'}</p>
      </div>
    </div>
  )
})

// ---------------- Cases List (Gajamada-style columns) ----------------
function CasesList({ user, onOpenCase }) {
  const [cases, setCases] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size] = useState(7)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [scope, setScope] = useState('paminal')
  const [sourceFilter, setSourceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [reference, setReference] = useState({ units: [], statuses: [], categories: [] })
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [createOpen, setCreateOpen] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm, setCreateForm] = useState({})

  const resetCreateForm = () => {
    setCreateForm({
      perihal: '', pengirim: '', nomor_surat: '', tgl_surat: '',
      prepetrator_name: '', summary: '', category: '',
      case_type: user.role === 'unit' ? 'laporan_informasi' : 'pengaduan',
    })
  }

  const openCreateLocal = () => { resetCreateForm(); setCreateOpen(true) }
  const saveCreateLocal = async () => {
    const { perihal, pengirim } = createForm
    if (!perihal && !pengirim) { toast.error('Perihal atau Pengirim wajib diisi'); return }
    setCreateSaving(true)
    try {
      await api('/local-cases', { method: 'POST', body: JSON.stringify(createForm) })
      toast.success('Data tersimpan')
      setCreateOpen(false)
      load()
    } catch (e) { toast.error('Gagal menyimpan: ' + e.message) }
    finally { setCreateSaving(false) }
  }

  const openEditLocal = (c) => { setEditForm({ ...c }); setEditOpen(true) }
  const saveEditLocal = async () => {
    const { prepator_name, pengirim, perihal, nomor_surat, tgl_surat, category, summary, case_type } = editForm
    const patch = { prepetrator_name: prepator_name, pengirim, perihal, nomor_surat, tgl_surat, category, summary, case_type }
    setEditSaving(true)
    try {
      await api(`/local-cases/${encodeURIComponent(editForm.id)}`, { method: 'PUT', body: JSON.stringify(patch) })
      toast.success('Data diperbarui')
      setEditOpen(false)
      load()
    } catch (e) { toast.error(e.message) }
    finally { setEditSaving(false) }
  }

  const load = useCallback(async () => {
    if (sourceFilter === 'manual' || sourceFilter === 'non_dumas' || sourceFilter === 'laporan_informasi') {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        if (sourceFilter === 'non_dumas') qs.set('case_type', 'non_dumas')
        else qs.set('source', sourceFilter)
        if (search) qs.set('search', search)
        qs.set('page', String(page))
        qs.set('size', String(size))
        const r = await api(`/local-cases?${qs}`)
        const formatted = (r.data || []).map(c => ({
          ...c, id: c.id, prepetrator_id: c.prepator_id || c.prepetrator_id, created_date: c.created_at, updated_at: c.updated_at,
          status_label: c.status, category: c.category || 'NON-DUMAS', pengirim: c.pengirim, reporter_nik: c.reporter_nik,
          phone_no: c.phone_no, email: c.email, prepetrator_name: c.prepator_name || c.prepetrator_name, summary: c.perihal, content: c.content,
          source_alias: c.source_alias, disposisi_case_position: '-', '5w1h_where': '', '5w1h_when': c.tgl_surat,
        }))
        setCases(formatted); setTotal(r.total || formatted.length)
      } catch(e) { toast.error(e.message) }
      finally { setLoading(false) }
      return
    }

    setLoading(true)
    try {
      const qs = new URLSearchParams({ page: String(page), size: String(size), scope })
      if (search) qs.set('search', search)
      if (status) qs.set('status', status)
      if (category) qs.set('category', category)
      if (unit) qs.set('unit', unit)
      qs.set('case_type', 'dumas')
      const r = await api(`/cases?${qs.toString()}`)
      setCases(r.data); setTotal(r.total)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [page, status, category, unit, scope, search, size, sourceFilter])
  useEffect(() => { load() }, [load])
  useEffect(() => { api('/reference').then(setReference).catch(() => {}) }, [])

  const onSearch = useCallback((e) => { e.preventDefault(); setPage(1); load() }, [load])
  const clearFilter = useCallback(() => { setStatus(''); setCategory(''); setUnit(''); setSearch(''); setScope('paminal'); setPage(1) }, [])
  const maxPage = useMemo(() => Math.ceil(total / size) || 1, [total, size])
  const handleStatusChange = useCallback((v) => { setStatus(v === '__all' ? '' : v); setPage(1) }, [])
  const handleCategoryChange = useCallback((v) => { setCategory(v === '__all' ? '' : v); setPage(1) }, [])
  const handleUnitChange = useCallback((v) => { setUnit(v === '__all' ? '' : v); setPage(1) }, [])
  const handleScopeChange = useCallback((v) => { setScope(v); setPage(1) }, [])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 96px)' }}>
      <div className="shrink-0 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Daftar Surat</h2>
          <Tabs value={sourceFilter || 'gajamada'} onValueChange={(v) => { setSourceFilter(v === 'gajamada' ? '' : v); setPage(1) }}>
            <TabsList>
              <TabsTrigger value="gajamada" className="text-xs">GAJAMADA</TabsTrigger>
              <TabsTrigger value="laporan_informasi" className="text-xs">LAPORAN INFORMASI</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs">INPUT MANUAL</TabsTrigger>
              <TabsTrigger value="non_dumas" className="text-xs">NON-DUMAS</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-blue-50 text-blue-900 border-blue-200">Total: {total.toLocaleString('id-ID')}</Badge>
          {(sourceFilter === 'manual' || sourceFilter === 'laporan_informasi') && (
            <Button size="sm" onClick={openCreateLocal} className="bg-blue-800 hover:bg-blue-900">
              <FileText className="h-4 w-4 mr-2" /> Tambah
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={onSearch} className="flex flex-wrap items-end gap-2 justify-end">
            <Select value={status || '__all'} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Semua Status" /></SelectTrigger>
              <SelectContent><SelectItem value="__all">Semua Status</SelectItem>
                {reference.statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={category || '__all'} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
              <SelectContent><SelectItem value="__all">Semua Kategori</SelectItem>
                {reference.categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            {user.role !== 'unit' && (
              <Select value={unit || '__all'} onValueChange={handleUnitChange}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Semua Unit" /></SelectTrigger>
                <SelectContent><SelectItem value="__all">Semua Unit</SelectItem>
                  {(scope === 'all' ? (reference.gajamada_satker || reference.satker_satwil || []) : reference.units).map((u) => <SelectItem key={typeof u === 'string' ? u : u.id} value={typeof u === 'string' ? u : u.name}>{typeof u === 'string' ? shortUnit(u) : u.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {user.role !== 'unit' && (
              <Select value={scope} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Cakupan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paminal">Paminal & Unit</SelectItem>
                  <SelectItem value="all">Semua Polda Jabar</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="relative w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari..." className="pl-9" />
            </div>
            <Button type="submit" size="sm"><Search className="h-4 w-4 mr-2" /> Cari</Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilter}>Reset</Button>
          </form>
        </CardContent>
      </Card>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col mt-4">
        <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50 sticky top-0">
                  {sourceFilter ? (
                    <TableRow>
                      <TableHead className="w-10 text-sm">No</TableHead>
                      <TableHead className="text-sm">Perihal</TableHead>
                      <TableHead className="text-sm">Nomor Surat</TableHead>
                      <TableHead className="w-[110px] text-sm">Tgl Surat</TableHead>
                      <TableHead className="text-sm">Pengirim</TableHead>
                      <TableHead className="text-sm">Sumber</TableHead>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableHead className="w-12 text-sm">No</TableHead>
                      <TableHead className="w-[180px] text-sm">Informasi Laporan</TableHead>
                      <TableHead className="min-w-[220px] text-sm">Terlapor</TableHead>
                      <TableHead className="min-w-[240px] text-sm">Pelapor</TableHead>
                      <TableHead className="text-sm">Peristiwa</TableHead>
                      <TableHead className="text-sm">Kategori</TableHead>
                      <TableHead className="min-w-[320px] text-sm">Rangkuman</TableHead>
                      <TableHead className="w-[110px] text-sm">Last Updated</TableHead>
                      <TableHead className="w-[160px] text-sm">Status</TableHead>
                    </TableRow>
                  )}
                </TableHeader>
                <TableBody>
                  {sourceFilter ? (
                    cases.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        {sourceFilter === 'manual' ? 'Belum ada data. Klik "Tambah" untuk input surat manual.' :
                         sourceFilter === 'laporan_informasi' ? 'Belum ada laporan informasi. Klik "Tambah" untuk input.' :
                         sourceFilter === 'non_dumas' ? 'Belum ada surat non-dumas.' : 'Tidak ada data.'}
                      </TableCell></TableRow>
                    ) : (
                      cases.map((c, idx) => (
                        <TableRow key={`${c._source || c.source || 'other'}-${c.prepator_id || c.prepetrator_id || idx}`} className="cursor-pointer hover:bg-blue-50/40 align-top" onClick={() => onOpenCase(c.prepator_id || c.prepetrator_id)}>
                          <TableCell className="text-sm text-slate-500 pt-3">{idx + 1}</TableCell>
                          <TableCell className="pt-3">
                            <p className="text-sm font-medium">{c.perihal || c.summary || '-'}</p>
                            {c.source_alias && <Badge className={`mt-1 text-xs ${sourceColor(c.source_alias)}`}>{c.source_alias}</Badge>}
                          </TableCell>
                          <TableCell className="pt-3 text-sm font-mono">{c.nomor_surat || '-'}</TableCell>
                          <TableCell className="pt-3 text-sm">{c.tgl_surat ? fmtDateShort(c.tgl_surat) : fmtDateShort(c.created_date)}</TableCell>
                          <TableCell className="pt-3 text-sm">{c.pengirim || '-'}</TableCell>
                          <TableCell className="pt-3"><Badge className={statusColor(c.status_label)}>{c.status_label || c.status || '-'}</Badge></TableCell>
                          <TableCell className="pt-3"><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); openEditLocal(c) }}>Edit</Button></TableCell>
                        </TableRow>
                      ))
                    )
                  ) : (
                    <>
                      {cases.map((c, idx) => (
                        <TableRow key={`${c._source || 'gajamada'}-${c.prepetrator_id || idx}`} className="cursor-pointer hover:bg-blue-50/40 align-top" onClick={() => onOpenCase(c.prepetrator_id)}>
                          <TableCell className="text-sm text-slate-500 pt-3">{(page - 1) * size + idx + 1}</TableCell>
                          <TableCell className="pt-3">
                            <p className="text-sm font-mono font-semibold">{c.id}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{fmtDate(c.created_date)}</p>
                            {c.source_alias && <Badge className={`mt-1.5 text-xs ${sourceColor(c.source_alias)}`}>{c.source_alias}</Badge>}
                          </TableCell>
                          <TableCell className="pt-3 min-w-[220px]">
                            <p className="text-sm font-medium">{c.prepetrator_name || <span className="text-slate-400">-</span>}</p>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">{c.prepetrator_id}</p>
                          </TableCell>
                          <TableCell className="pt-3 min-w-[240px]">
                            <p className="text-sm font-medium">{c.pengirim || <span className="text-slate-400">-</span>}</p>
                            {c.reporter_nik && <p className="text-xs font-mono text-slate-500 mt-0.5">{c.reporter_nik}</p>}
                            {c.total_report > 1 && <Badge className="mt-1 bg-amber-100 text-amber-800 border-amber-300 text-xs">Laporan Ke {c.total_report}</Badge>}
                          </TableCell>
                          <TableCell className="pt-3 max-w-[160px]">
                            <p className="text-sm line-clamp-2">{c['5w1h_where'] || <span className="text-slate-400">-</span>}</p>
                            {c['5w1h_when'] && <p className="text-xs text-slate-500 mt-0.5">{fmtDateShort(c['5w1h_when'])}</p>}
                          </TableCell>
                          <TableCell className="pt-3 max-w-[180px]">
                            {c.category ? <Badge className={`text-xs ${c.category === 'NON-DUMAS' || c.category === 'non_dumas' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-800'}`}>{c.category}</Badge> : <span className="text-slate-400">-</span>}
                          </TableCell>
                          <TableCell className="pt-3">
                            <p className="text-sm text-slate-700 line-clamp-5">{c.summary || c.content || <span className="text-slate-400">-</span>}</p>
                          </TableCell>
                          <TableCell className="text-xs pt-3">{fmtDate(c.updated_at)}</TableCell>
                          <TableCell className="pt-3">
                            <div className="flex flex-col gap-1 items-start">
                              <Badge className={`${statusColor(c.status_label)} text-xs`}>{c.status_label || c.status || '-'}</Badge>
                              <Badge variant="outline" className="text-xs font-normal">{shortUnit(c.disposisi_case_position)}</Badge>
                              {c.is_atensi && <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs"><Star className="h-2.5 w-2.5 mr-0.5" />ATENSI</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {cases.length === 0 && (
                        <TableRow><TableCell colSpan={9} className="text-center py-12 text-slate-500">Tidak ada kasus pada cakupan ini.</TableCell></TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="shrink-0 bg-white border-t py-3 px-4 flex items-center justify-between z-10">
        <p className="text-sm text-slate-500">Halaman {page} dari {maxPage} · {size} per halaman · Total {total.toLocaleString('id-ID')}</p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>Awal</Button>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
          <form onSubmit={(e) => { e.preventDefault(); const v = parseInt(e.target.elements.pageInput.value, 10); if (v >= 1 && v <= maxPage) setPage(v) }} className="flex items-center gap-1">
            <input name="pageInput" type="number" min={1} max={maxPage} defaultValue={page} key={page} className="w-12 h-8 text-center text-sm border rounded-md" />
          </form>
          <Button variant="outline" size="sm" disabled={cases.length < size} onClick={() => setPage(page + 1)}>Selanjutnya</Button>
          <Button variant="outline" size="sm" disabled={cases.length < size} onClick={() => setPage(maxPage)}>Akhir</Button>
        </div>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Data Surat</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Terlapor</Label><Input value={editForm.prepator_name || ''} onChange={(e) => setEditForm({ ...editForm, prepator_name: e.target.value })} /></div>
            <div><Label>Pelapor/Pengirim</Label><Input value={editForm.pengirim || ''} onChange={(e) => setEditForm({ ...editForm, pengirim: e.target.value })} /></div>
            <div><Label>Perihal</Label><Input value={editForm.perihal || ''} onChange={(e) => setEditForm({ ...editForm, perihal: e.target.value })} /></div>
            <div><Label>Nomor Surat</Label><Input value={editForm.nomor_surat || ''} onChange={(e) => setEditForm({ ...editForm, nomor_surat: e.target.value })} /></div>
            <div><Label>Tgl Surat</Label><Input value={editForm.tgl_surat || ''} onChange={(e) => setEditForm({ ...editForm, tgl_surat: e.target.value })} placeholder="YYYY-MM-DD" /></div>
            <div>
              <Label>Jenis</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={() => setEditForm({ ...editForm, case_type: 'dumas' })} className={`px-3 py-1.5 rounded-md border text-xs font-medium ${(editForm.case_type || 'non_dumas') === 'dumas' ? 'bg-blue-800 text-white border-blue-900' : 'bg-white text-slate-700 border-slate-300'}`}>DUMAS</button>
                <button type="button" onClick={() => setEditForm({ ...editForm, case_type: 'non_dumas' })} className={`px-3 py-1.5 rounded-md border text-xs font-medium ${(editForm.case_type || 'non_dumas') !== 'dumas' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>NON-DUMAS</button>
              </div>
            </div>
            <div><Label>Kategori</Label><Select value={editForm.category || ''} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>{reference.categories?.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
            </Select></div>
            <div><Label>Rangkuman</Label><Textarea value={editForm.summary || ''} onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })} className="min-h-[80px]" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setEditOpen(false)}>Batal</Button><Button onClick={saveEditLocal} disabled={editSaving}>{editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Data Surat</DialogTitle><DialogDescription>{
            user.role === 'unit' ? 'Unit hanya bisa input Laporan Informasi.' : 'Isi data surat manual.'
          }</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Jenis</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {user.role !== 'unit' && (
                  <button type="button" onClick={() => setCreateForm({ ...createForm, case_type: 'pengaduan' })}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium ${createForm.case_type === 'pengaduan' ? 'bg-blue-800 text-white border-blue-900' : 'bg-white text-slate-700 border-slate-300'}`}>Pengaduan</button>
                )}
                <button type="button" onClick={() => setCreateForm({ ...createForm, case_type: 'laporan_informasi' })}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium ${createForm.case_type === 'laporan_informasi' ? 'bg-sky-800 text-white border-sky-900' : 'bg-white text-slate-700 border-slate-300'}`}>Laporan Informasi</button>
                {user.role !== 'unit' && (
                  <button type="button" onClick={() => setCreateForm({ ...createForm, case_type: 'non_dumas' })}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium ${createForm.case_type === 'non_dumas' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>Non-Dumas</button>
                )}
              </div>
            </div>
            <div><Label>Perihal *</Label><Input value={createForm.perihal || ''} onChange={(e) => setCreateForm({ ...createForm, perihal: e.target.value })} placeholder="Perihal surat" /></div>
            <div><Label>Pelapor/Pengirim *</Label><Input value={createForm.pengirim || ''} onChange={(e) => setCreateForm({ ...createForm, pengirim: e.target.value })} placeholder="Nama pengirim" /></div>
            <div><Label>Terlapor</Label><Input value={createForm.prepator_name || createForm.prepetrator_name || ''} onChange={(e) => setCreateForm({ ...createForm, prepetrator_name: e.target.value })} placeholder="Nama terduga" /></div>
            <div><Label>Nomor Surat</Label><Input value={createForm.nomor_surat || ''} onChange={(e) => setCreateForm({ ...createForm, nomor_surat: e.target.value })} /></div>
            <div><Label>Tgl Surat</Label><Input value={createForm.tgl_surat || ''} onChange={(e) => setCreateForm({ ...createForm, tgl_surat: e.target.value })} placeholder="YYYY-MM-DD" /></div>
            <div><Label>Kategori</Label><Select value={createForm.category || ''} onValueChange={(v) => setCreateForm({ ...createForm, category: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>{reference.categories?.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
            </Select></div>
            <div><Label>Rangkuman</Label><Textarea value={createForm.summary || ''} onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })} className="min-h-[80px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Batal</Button>
            <Button onClick={saveCreateLocal} disabled={createSaving}>
              {createSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Disposisi Page (Kasubbid only) ----------------
function DisposisiPage({ user, onOpenCase, onGoMasterUnit, onQueueChange }) {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [tab, setTab] = useState('antrian')
  const [riwayat, setRiwayat] = useState([])
  const [editDisp, setEditDisp] = useState(null)
  const [editFormData, setEditFormData] = useState({ to_unit: '', note: '', is_atensi: false })
  const [editOpen, setEditOpen] = useState(false)
  const [editMode, setEditMode] = useState(null) // full edit mode: disposition object
  const [editQueueItem, setEditQueueItem] = useState(null) // synthetic queue item for edit mode
  const [reference, setReference] = useState({ units: [], default_disposisi_tasks: [] })
  // Form state
  const [toUnit, setToUnit] = useState('')
  const [note, setNote] = useState('')
  const [isAtensi, setIsAtensi] = useState(false)
  const [tasks, setTasks] = useState([]) // {label, checked}
  const [caseType, setCaseType] = useState('dumas')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Extra details for the current case
  const [atts, setAtts] = useState([])
  const [detail, setDetail] = useState(null)
  const [timeline, setTimeline] = useState([])
  // UI: tab per current source; kronologi mode (Gajamada); PDF selection index
  const [activeTab, setActiveTab] = useState('info')
  const [pdfIdx, setPdfIdx] = useState(0)
  const [kronologiMode, setKronologiMode] = useState('singkat')
  const resetForm = (ref, item) => {
    setToUnit(''); setNote(''); setIsAtensi(false)
    const ct = item?.case_type || ''
    if (ct === 'non_pengaduan' || ct === 'non_dumas') setCaseType('non_dumas')
    else setCaseType('dumas')
    const dumasTasks = ref?.default_disposisi_tasks || reference.default_disposisi_tasks || []
    const nonDumasTasks = ref?.non_dumas_disposisi_tasks || reference.non_dumas_disposisi_tasks || dumasTasks
    const isNonDumas = ct === 'non_pengaduan' || ct === 'non_dumas'
    const defaults = isNonDumas ? nonDumasTasks : dumasTasks
    setTasks(defaults.map((label) => ({ label, checked: false })))
  }

  const loadQueue = async () => {
    setLoading(true)
    try {
      const [q, r] = await Promise.all([api('/disposisi-queue'), api('/reference')])
      setQueue(q.data); setReference(r); resetForm(r, q.data?.[0]); setIdx(0)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadQueue() }, [])

  const loadRiwayat = async () => { try { const r = await api('/disposisi-history'); setRiwayat(r.data) } catch (e) { toast.error(e.message) } }
  const openEdit = async (d) => {
    const src = d.case_info?.source_alias || 'GAJAMADA'
    const item = { prepetrator_id: d.prepetrator_id, _source: 'gajamada', perihal: d.case_info?.perihal || '', nomor_surat: d.case_info?.nomor_surat || '', pengirim: d.case_info?.pengirim || '', source_alias: src, localCaseId: null }
    setEditQueueItem(item)
    setToUnit(d.to_unit || '')
    const rawNote = d.note || ''
    const tasksMatch = rawNote.match(/^TASKS:\s*(.+?)\n/)
    const savedTasks = tasksMatch ? tasksMatch[1].split(/,\s*/).filter(Boolean) : []
    const cleanNote = tasksMatch ? rawNote.slice(tasksMatch[0].length).trim() : rawNote
    setNote(cleanNote)
    setIsAtensi(!!d.is_atensi)
    // Fetch case_type from case detail
    let ct = 'dumas'
    let localCaseId = null
    try {
      const caseData = await api(`/cases/${encodeURIComponent(d.prepetrator_id)}`)
      if (caseData.data) {
        const ctype = caseData.data.case_type || ''
        if (ctype === 'dumas' || ctype === 'pengaduan') ct = 'dumas'
        else if (ctype === 'non_dumas' || ctype === 'non_pengaduan') ct = 'non_dumas'
        localCaseId = caseData.data.id
      }
    } catch (_) {}
    setEditQueueItem({ ...item, localCaseId })
    setCaseType(ct)
    const dumasTasks = reference.default_disposisi_tasks || []
    const nonDumasTasks = reference.non_dumas_disposisi_tasks || dumasTasks
    const defaults = ct === 'non_dumas' ? nonDumasTasks : dumasTasks
    setTasks(defaults.map((label) => ({ label, checked: savedTasks.some((l) => l.toUpperCase().includes(label.toUpperCase()) || label.toUpperCase().includes(l.toUpperCase())) })))
    setEditMode(d)
    setTab('antrian')
  }
  const cancelEdit = () => { setEditMode(null); setEditQueueItem(null); setTab('riwayat'); loadRiwayat() }
  const saveEdit = async () => {
    if (!toUnit || !reference.units?.includes(toUnit)) return toast.error('Pilih unit tujuan')
    setSubmitting(true)
    try {
      const checkedTasks = tasks.filter((t) => t.checked && t.label).map((t) => t.label)
      const taskPrefix = checkedTasks.length ? `TASKS: ${checkedTasks.join(', ')}\n` : ''
      await api(`/dispositions/${encodeURIComponent(editMode.id)}`, { method: 'PUT', body: JSON.stringify({ to_unit: toUnit, note: taskPrefix + note, is_atensi: isAtensi }) })
      // Update case_type di local_cases
      if (editQueueItem?.localCaseId) {
        try {
          await api(`/local-cases/${encodeURIComponent(editQueueItem.localCaseId)}`, { method: 'PUT', body: JSON.stringify({ case_type: caseType }) })
        } catch (e) { console.error('Gagal update case_type:', e.message) }
      }
      toast.success('Disposisi diperbarui')
      setEditMode(null); setEditQueueItem(null); setTab('riwayat'); loadRiwayat(); onQueueChange?.()
    } catch (e) { toast.error(e.message) }
    finally { setSubmitting(false) }
  }

  const current = editMode ? { ...editQueueItem, _editMode: true } : queue[idx]

  // Load detail + attachments + timeline for current case (source-aware)
  useEffect(() => {
    if (!current) { setDetail(null); setAtts([]); setTimeline([]); return }
    const pid = current.prepetrator_id
    // Immediately clear stale data so UI reflects the new case
    setDetail(null); setAtts([]); setTimeline([])
    let cancelled = false
    ;(async () => {
      try {
        const [d, a, t] = await Promise.all([
          api(`/cases/${encodeURIComponent(pid)}`).catch(() => ({ data: null })),
          api(`/cases/${encodeURIComponent(pid)}/attachments`).catch(() => ({ data: [] })),
          api(`/cases/${encodeURIComponent(pid)}/timeline-all`).catch(() => ({ data: [] })),
        ])
        if (!cancelled) { setDetail(d.data); setAtts(a.data); setTimeline(t.data || []) }
      } catch (_) { /* ignore */ }
    })()
    if (!editMode) resetForm(null, current)
    setActiveTab('info')
    setPdfIdx(0)
    setKronologiMode('singkat')
    return () => { cancelled = true }
  }, [idx, current?.prepetrator_id, current?._source]) // eslint-disable-line

  const attachments = useMemo(() => {
    if (!current) return []
    return (atts || []).map((a, i) => {
      const nm = a.file_name || a.filename || a.name || `lampiran-${i + 1}`
      const src = a.file_url || a.url || a.link || a.file_path || a.path
      if (!src) return null
      const inlineUrl = `/api/download?url=${encodeURIComponent(src)}&name=${encodeURIComponent(nm)}`
      return { id: a.id || `${i}`, name: nm, url: inlineUrl, dlUrl: inlineUrl, isPdf: /\.pdf$/i.test(nm), source: 'gajamada' }
    }).filter(Boolean)
  }, [current, atts])

  const goNext = () => { if (idx < queue.length - 1) setIdx(idx + 1) }
  const goPrev = () => { if (idx > 0) setIdx(idx - 1) }

  const toggleTask = (i) => {
    setTasks(tasks.map((t, ti) => ti === i ? { ...t, checked: !t.checked } : t))
  }
  const addTask = () => setTasks([...tasks, { label: '', checked: false }])
  const removeTask = (i) => setTasks(tasks.filter((_, ti) => ti !== i))
  const setTaskLabel = (i, label) => setTasks(tasks.map((t, ti) => ti === i ? { ...t, label } : t))
  const moveTask = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= tasks.length) return
    const arr = [...tasks]
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setTasks(arr)
  }

  const submitAndNext = async () => {
    if (!current) return
    if (!toUnit) return toast.error('Pilih unit tujuan')
    setConfirmOpen(true)
  }
  const confirmedSubmit = async () => {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      await api('/disposisi-bulk', { method: 'POST', body: JSON.stringify({
        items: [current.prepetrator_id], to_unit: toUnit, note, is_atensi: isAtensi, case_type: caseType,
        tasks: tasks.filter((t) => t.checked && t.label),
      }) })
      toast.success(`Disposisi ke ${shortUnit(toUnit)} berhasil`)
      const newQueue = queue.filter((_, i) => i !== idx)
      setQueue(newQueue)
      setIdx(Math.min(idx, newQueue.length - 1))
    resetForm(null, current)
      onQueueChange?.()
    } catch (e) { toast.error(e.message) }
    finally { setSubmitting(false) }
  }

  if (loading && tab === 'antrian') {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div>
  }

  if (tab === 'riwayat') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Disposisi</h2>
            <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'riwayat') loadRiwayat() }}>
              <TabsList><TabsTrigger value="antrian">Antrian</TabsTrigger><TabsTrigger value="riwayat">Riwayat</TabsTrigger></TabsList>
            </Tabs>
          </div>
          <Button variant="outline" size="sm" onClick={loadRiwayat}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
        </div>
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto"><Table>
            <TableHeader className="bg-slate-50"><TableRow>
              <TableHead className="text-sm">Waktu</TableHead><TableHead className="text-sm">Surat</TableHead><TableHead className="text-sm">Unit Tujuan</TableHead><TableHead className="text-sm">Oleh</TableHead><TableHead className="text-sm">ATENSI</TableHead><TableHead className="w-[80px] text-sm">Aksi</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {riwayat.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs">{fmtDate(d.created_at)}</TableCell>
                  <TableCell className="text-xs cursor-pointer hover:text-blue-800" onClick={() => onOpenCase(d.prepetrator_id)}>
                    <div className="font-medium">{d.case_info?.pengirim || '-'}</div>
                    <div className="text-slate-500">{d.case_info?.nomor_surat || ''} {d.case_info?.perihal || d.prepetrator_id}</div>
                  </TableCell>
                  <TableCell className="text-sm">{shortUnit(d.to_unit)}</TableCell>
                  <TableCell className="text-xs">{d.by?.name || '-'}</TableCell>
                  <TableCell>{d.is_atensi ? <Badge className="bg-amber-100 text-amber-800 text-xs"><Star className="h-2.5 w-2.5 mr-0.5" />Ya</Badge> : <span className="text-xs text-slate-400">-</span>}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(d)}>Edit</Button></TableCell>
                </TableRow>
              ))}
              {riwayat.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">Belum ada riwayat disposisi.</TableCell></TableRow>}
            </TableBody>
          </Table></div>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Disposisi</h2>
          <Tabs value={tab} onValueChange={(v) => { setTab(v); if (v === 'riwayat') loadRiwayat() }}>
            <TabsList><TabsTrigger value="antrian">Antrian</TabsTrigger><TabsTrigger value="riwayat">Riwayat</TabsTrigger></TabsList>
          </Tabs>
        </div>
        <Button variant="outline" size="sm" onClick={loadQueue}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
      </div>

      {(!editMode && queue.length === 0 && tab === 'antrian') ? (
        <Card><CardContent className="py-16 text-center" data-testid="disposisi-empty">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
          <p className="text-lg font-medium text-slate-700">Tidak ada surat/pengaduan di antrian</p>
        </CardContent></Card>
      ) : tab === 'antrian' && (
      <>
      {editMode && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
          <Badge className="bg-amber-200 text-amber-900">Edit Disposisi</Badge>
          <span className="text-xs text-amber-800">Unit sebelumnya: <strong>{shortUnit(editMode.to_unit)}</strong> · Oleh: {editMode.by?.name || '-'}</span>
          <Button variant="ghost" size="sm" onClick={cancelEdit} className="ml-auto text-xs">Batal</Button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* PANEL 1: Detail + Preview/Kronologi + Timeline (scrollable) */}
        <Card className="lg:col-span-7 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <div className={`${editMode ? 'bg-gradient-to-r from-amber-800 to-amber-900' : 'bg-gradient-to-r from-blue-900 to-indigo-900'} text-white p-3 shrink-0`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-blue-200">{editMode ? 'Edit Disposisi' : `Surat #${idx + 1} dari ${queue.length}`}</p>
                <p className="text-xs font-bold font-mono mt-0.5 truncate" data-testid="current-case-id">{current?.prepetrator_id}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {current?.source_alias && <Badge className={`${sourceColor(current.source_alias)} text-[10px]`}>{current.source_alias}</Badge>}
                {!editMode && <button onClick={onGoMasterUnit} className="text-[10px] text-blue-200 hover:underline mt-1">Master Unit</button>}
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-4 space-y-4" data-testid="panel-detail">
            {/* --- SECTION: Info Surat --- */}
            <section data-testid="section-info">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200">
                <FileText className="h-4 w-4 text-blue-800" />
                <h3 className="text-sm font-semibold text-slate-800">Info Surat</h3>
              </div>
              <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Kategori" value={current?.category} />
                <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Diterima" value={fmtDate(current?.created_date || current?.tgl_surat)} />
                <InfoRow icon={<Hash className="h-3.5 w-3.5" />} label="No Surat" value={current?.nomor_surat} />
                <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="Jenis" value={current?.jenis_surat || current?.tipe} />
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Pengirim" value={current?.pengirim || current?.prepetrator_name} />
                {current?.phone_no && <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Telp" value={current.phone_no} />}
                {current?.['5w1h_where'] && <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Tempat" value={current['5w1h_where']} />}
                {current?.['5w1h_when'] && <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Waktu" value={fmtDate(current['5w1h_when'])} />}
                {current?.kka_name && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="KKA" value={current.kka_name} />}
                {current?.derajat && <InfoRow icon={<Tag className="h-3.5 w-3.5" />} label="Derajat" value={current.derajat} />}
              </div>
              {current?.perihal && (
                <div className="mt-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Perihal</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap" data-testid="info-perihal">{current.perihal}</p>
                </div>
              )}
              {current?.note && (
                <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-2 py-1.5 text-xs text-amber-900 italic">
                  Catatan sumber: {Array.isArray(current.note) ? current.note.join(' · ') : current.note}
                </div>
              )}
              </>
            </section>

            {/* --- SECTION: Kronologi --- */}
            <section data-testid="section-kronologi">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200">
                <FileText className="h-4 w-4 text-blue-800" />
                <h3 className="text-sm font-semibold text-slate-800">Kronologi</h3>
                <div className="ml-auto inline-flex rounded-md border border-slate-200 overflow-hidden">
                  <button onClick={() => setKronologiMode('singkat')} className={`px-2 py-0.5 text-[10px] ${kronologiMode === 'singkat' ? 'bg-blue-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`} data-testid="kronologi-singkat-btn">Singkat</button>
                  <button onClick={() => setKronologiMode('lengkap')} className={`px-2 py-0.5 text-[10px] border-l ${kronologiMode === 'lengkap' ? 'bg-blue-800 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`} data-testid="kronologi-lengkap-btn">Lengkap</button>
                </div>
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-md border border-slate-200 p-3 max-h-[300px] overflow-y-auto" data-testid="kronologi-body">
                {kronologiMode === 'singkat'
                  ? (detail?.summary || current?.summary || <span className="text-slate-400 italic">(Tidak ada ringkasan singkat)</span>)
                  : (detail?.content || current?.content || <span className="text-slate-400 italic">(Tidak ada kronologi lengkap)</span>)}
              </div>
            </section>

            {/* --- SECTION: Timeline --- */}
            <section data-testid="section-timeline">
              <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200">
                <History className="h-4 w-4 text-blue-800" />
                <h3 className="text-sm font-semibold text-slate-800">Timeline ({timeline.length})</h3>
              </div>
              {timeline.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-3 text-center" data-testid="timeline-empty">Belum ada timeline untuk surat ini.</p>
              ) : (
                <ol className="relative border-l-2 border-slate-200 pl-4 space-y-3">
                  {timeline.map((r, i) => {
                    const title = r.title || r.status_alias || r.status || 'Aktivitas'
                    const from = r.previous_case_position
                    const to = r.case_position
                    const officer = r.officer_report_name
                    const desc = r.description
                    const dateStr = fmtDate(r.date_activity)
                    return (
                      <li key={r.id || i} className="text-xs" data-testid={`timeline-item-${i}`}>
                        <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-blue-800 border-2 border-white" />
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800">{title}</span>
                          {r.source && <Badge variant="outline" className="text-[8px] py-0">{r.source.toUpperCase()}</Badge>}
                          <span className="text-[10px] text-slate-500 ml-auto">{dateStr}</span>
                        </div>
                        {(from || to) && (
                          <p className="text-slate-600 mt-0.5 text-[11px]">
                            {from && <><span className="text-slate-400">Dari:</span> {from}</>}
                            {to && <span className="ml-1"><span className="text-slate-400">Ke:</span> {to}</span>}
                          </p>
                        )}
                        {officer && <p className="text-slate-500 text-[10px] mt-0.5">Petugas: {officer}</p>}
                        {desc && <div className="mt-1 rounded bg-slate-50 border border-slate-200 px-2 py-1 text-slate-700 italic text-[11px] whitespace-pre-wrap">{desc}</div>}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          </div>
        </Card>

        {/* PANEL 2: Lembar Disposisi */}
        <Card className="lg:col-span-5 flex flex-col overflow-hidden border-2 border-blue-300" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <CardHeader className="pb-2 bg-blue-50/60 border-b shrink-0">
            <CardTitle className="text-sm flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-blue-800" /> Lembar Disposisi</CardTitle>
          </CardHeader>
          <div className="overflow-y-auto p-4 space-y-4" data-testid="panel-disposisi">
            <div>
              <Label className="text-xs">Jenis Kasus</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button type="button" onClick={() => { setCaseType('dumas'); const defaults = reference.default_disposisi_tasks || []; setTasks(defaults.map((label) => ({ label, checked: false }))) }} className={`px-3 py-1.5 rounded-md border text-xs font-medium ${caseType === 'dumas' ? 'bg-blue-800 text-white border-blue-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`} data-testid="case-type-dumas">DUMAS</button>
                <button type="button" onClick={() => { setCaseType('non_dumas'); const defaults = reference.non_dumas_disposisi_tasks || reference.default_disposisi_tasks || []; setTasks(defaults.map((label) => ({ label, checked: false }))) }} className={`px-3 py-1.5 rounded-md border text-xs font-medium ${caseType === 'non_dumas' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`} data-testid="case-type-non-dumas">NON-DUMAS</button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Unit Tujuan</Label>
              <Select value={toUnit} onValueChange={setToUnit}>
                <SelectTrigger data-testid="disposisi-unit-select" className="h-9"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                <SelectContent>
                  {reference.units?.map((u) => <SelectItem key={u} value={u}>{shortUnit(u)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Ceklist Tugas</Label>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[10px]" onClick={addTask}>+ Tambah</Button>
              </div>
              <div className="space-y-1.5 border rounded-md p-2 bg-slate-50/50 max-h-[180px] overflow-y-auto">
                {tasks.length === 0 && <p className="text-[10px] text-slate-400">Klik &quot;+ Tambah&quot; untuk menambah tugas.</p>}
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Checkbox checked={t.checked} onCheckedChange={() => toggleTask(i)} />
                    <Input value={t.label} onChange={(e) => setTaskLabel(i, e.target.value)} placeholder="Nama tugas..." className="h-7 text-xs" />
                    <button type="button" onClick={() => moveTask(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 text-xs">▲</button>
                    <button type="button" onClick={() => moveTask(i, 1)} disabled={i === tasks.length - 1} className="text-slate-400 hover:text-slate-800 disabled:opacity-30 text-xs">▼</button>
                    <button type="button" onClick={() => removeTask(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs">Instruksi / Catatan</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Instruksi disposisi..." className="min-h-[70px] text-xs" data-testid="disposisi-note" />
            </div>

            <div className="flex items-center gap-2 rounded-md border p-2 bg-amber-50/30">
              <Checkbox id="atensi-single" checked={isAtensi} onCheckedChange={setIsAtensi} />
              <Label htmlFor="atensi-single" className="cursor-pointer flex items-center gap-1 text-xs"><Star className="h-3.5 w-3.5 text-amber-500" /> ATENSI (prioritas)</Label>
            </div>

            <div className="border-t pt-3">
              {editMode ? (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={cancelEdit} className="flex-1">Batal</Button>
                  <Button onClick={saveEdit} disabled={submitting || !toUnit} className="flex-1 bg-amber-700 hover:bg-amber-800" data-testid="disposisi-submit">
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Simpan & Sinkronkan
                  </Button>
                </div>
              ) : (
                <Button onClick={submitAndNext} disabled={submitting || !toUnit} className="w-full bg-blue-800 hover:bg-blue-900" data-testid="disposisi-submit">
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                  Disposisi &amp; Lanjut
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation bar — below content, above bottom */}
      {!editMode && (
      <div className="bg-white border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]" data-testid="bottom-nav">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={goPrev} disabled={idx === 0} className="text-xs min-w-[80px]" data-testid="btn-prev">
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-medium" data-testid="queue-counter">{idx + 1} / {queue.length}</span>
            <Button variant="outline" size="sm" onClick={() => onOpenCase(current?.prepetrator_id)} className="text-xs" data-testid="btn-detail">Detail</Button>
          </div>
          <Button variant="outline" size="sm" onClick={goNext} disabled={idx >= queue.length - 1} className="text-xs min-w-[80px]" data-testid="btn-next">
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
      )}
      </>
      )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Konfirmasi Disposisi</DialogTitle><DialogDescription>
            Disposisi ke unit <strong>{shortUnit(toUnit)}</strong>{isAtensi ? ' (ATENSI)' : ''}?
          </DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Batal</Button>
            <Button onClick={confirmedSubmit} className="bg-blue-800 hover:bg-blue-900">
              Ya, Disposisi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Master Unit CRUD (Tree View) ----------------
function UnitGroup({ parent, children, level, isKasubbid, onToggle, onEdit, onRemove, onAddChild }) {
  const [open, setOpen] = useState(level === 0)
  const indent = level * 24

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!open) } }}
        className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left cursor-pointer"
      >
        {children.length > 0 ? (
          open ? <ChevronDown className="h-4 w-4 text-blue-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-blue-600 shrink-0" />
        ) : (
          <div className="w-4 shrink-0" />
        )}
        <Building2 className="h-4 w-4 text-blue-800 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-blue-900 truncate">{parent.name}</div>
          {!parent.active && <Badge className="text-[10px] bg-red-100 text-red-700 ml-1">Nonaktif</Badge>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-[10px] ${level === 0 ? 'bg-blue-800 text-white' : level === 1 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>
            {level === 0 ? 'SATKER INDUK' : level === 1 ? 'SUB SATKER' : 'UNIT PELAKSANA'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">{children.length} anak</Badge>
        </div>
        {isKasubbid && (
          <div className="flex gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onToggle(parent)}>
              {parent.active ? 'Nonaktifkan' : 'Aktifkan'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onEdit(parent)}>Edit</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onAddChild(parent)}>+Anak</Button>
            {level > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600" onClick={() => onRemove(parent)}>Hapus</Button>
            )}
          </div>
        )}
      </div>
      {open && children.length > 0 && (
        <div style={{ marginLeft: indent + 16 }}>
          {children.map(([child, grandChildren]) => (
            <UnitGroup
              key={child.id}
              parent={child}
              children={grandChildren}
              level={level + 1}
              isKasubbid={isKasubbid}
              onToggle={onToggle}
              onEdit={onEdit}
              onRemove={onRemove}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MasterUnitPage({ user }) {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', parent: '', order: 99 })
  const [syncing, setSyncing] = useState(false)
  const isKasubbid = user.role === 'kasubbid' || user.role === 'admin' || user.role === 'kabid_propam' || user.role === 'kasubbag_yanduan' || user.role === 'super_admin'

  const load = async () => {
    setLoading(true)
    try { const r = await api('/units-master'); setUnits(r.data) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openCreate = (parentUnit) => {
    setEditing(null)
    setForm({ name: '', parent: parentUnit ? parentUnit.name : '', order: 99 })
    setDialogOpen(true)
  }
  const openEdit = (u) => {
    setEditing(u)
    setForm({ name: u.name, parent: u.parent || '', order: u.order || 99, active: u.active })
    setDialogOpen(true)
  }
  const save = async () => {
    if (!form.name) return toast.error('Nama unit wajib')
    try {
      if (editing) {
        await api(`/units-master/${encodeURIComponent(editing.id)}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('Unit diperbarui')
      } else {
        await api('/units-master', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Unit ditambahkan')
      }
      setDialogOpen(false); await load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (u) => {
    if (!confirm(`Hapus unit "${u.name}"?`)) return
    try { await api(`/units-master/${encodeURIComponent(u.id)}`, { method: 'DELETE' }); toast.success('Unit dihapus'); await load() }
    catch (e) { toast.error(e.message) }
  }
  const syncGajamada = async () => {
    setSyncing(true)
    try { const r = await api('/units-master/sync-gajamada', { method: 'POST' }); toast.success(`Sync dari Gajamada: +${r.added} baru, ${r.existing} sudah ada (total ${r.total})`); await load() }
    catch (e) { toast.error(e.message) }
    finally { setSyncing(false) }
  }
  const toggleActive = async (u) => {
    try { await api(`/units-master/${encodeURIComponent(u.id)}`, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) }); await load() }
    catch (e) { toast.error(e.message) }
  }

  const tree = useMemo(() => {
    const byParent = {}
    for (const u of units) {
      const p = u.parent || '__root__'
      if (!byParent[p]) byParent[p] = []
      byParent[p].push(u)
    }
    const sorted = (arr) => arr.sort((a, b) => (a.order || 99) - (b.order || 99))
    for (const k of Object.keys(byParent)) byParent[k] = sorted(byParent[k])
    const buildChildren = (parentName) => {
      const children = byParent[parentName] || []
      return sorted(children).map((c) => [c, buildChildren(c.name)])
    }
    const roots = byParent['__root__'] || []
    return sorted(roots).map((r) => [r, buildChildren(r.name)])
  }, [units])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Master Unit</h2>
          <p className="text-xs text-slate-500 mt-0.5">Hierarki: Satker Induk — Sub Satker — Unit Pelaksana</p>
        </div>
        {isKasubbid && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncGajamada} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Sync dari Gajamada
            </Button>
            <Button onClick={() => openCreate(null)}><Building2 className="h-4 w-4 mr-2" /> Tambah Satker Induk</Button>
          </div>
        )}
      </div>

      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div> :
        tree.length === 0 ? <Card><CardContent className="py-16 text-center"><p className="text-slate-500">Belum ada unit. Klik "Tambah Satker Induk" atau "Sync dari Gajamada".</p></CardContent></Card> :
        <Card className="divide-y">
          {tree.map(([root, children]) => (
            <UnitGroup
              key={root.id}
              parent={root}
              children={children}
              level={0}
              isKasubbid={isKasubbid}
              onToggle={toggleActive}
              onEdit={openEdit}
              onRemove={remove}
              onAddChild={(p) => openCreate(p)}
            />
          ))}
        </Card>
      }

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Unit' : 'Tambah Unit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Unit</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. KASUBBID PAMINAL POLDA JAWA BARAT" />
            </div>
            <div>
              <Label>Parent Unit (kosongkan untuk Satker Induk)</Label>
              <Input value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} placeholder="Nama unit induk..." />
            </div>
            <div>
              <Label>Urutan Tampilan</Label>
              <Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value || '99', 10) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Satker / Satwil Master ----------------
function SatkerSatwilPage({ user }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', order: 99 })
  const isAdmin = user.role === 'kasubbid' || user.role === 'admin' || user.role === 'kabid_propam' || user.role === 'kasubbag_yanduan' || user.role === 'super_admin'

  const load = async () => {
    setLoading(true)
    try { const r = await api('/satker-satwil'); setRows(r.data) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ name: '', order: 99 }); setDialogOpen(true) }
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, order: u.order || 99 }); setDialogOpen(true) }
  const save = async () => {
    if (!form.name) return toast.error('Nama wajib')
    try {
      if (editing) {
        await api(`/satker-satwil/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(form) })
        toast.success('Diperbarui')
      } else {
        await api('/satker-satwil', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Ditambahkan')
      }
      setDialogOpen(false); await load()
    } catch (e) { toast.error(e.message) }
  }
  const remove = async (u) => {
    if (!confirm(`Hapus "${u.name}"?`)) return
    try { await api(`/satker-satwil/${encodeURIComponent(u.id)}`, { method: 'DELETE' }); toast.success('Dihapus'); await load() }
    catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-slate-900">Master Satker / Satwil</h2>
        {isAdmin && <Button onClick={openCreate}><Building2 className="h-4 w-4 mr-2" /> Tambah</Button>}
      </div>
      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-3"><CardTitle className="text-sm">{r.name}</CardTitle></CardHeader>
              <CardContent className="pt-0 flex justify-end gap-1">
                {isAdmin && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(r)}>Hapus</Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-sm text-slate-500 col-span-full text-center py-8">Belum ada data Satker/Satwil.</p>}
        </div>
      }
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Tambah'} Satker/Satwil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. POLRES BANDUNG" /></div>
            <div><Label>Urutan</Label><Input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value || '99', 10) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={save}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------- Sync & Audit ----------------
function SyncLogsView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api('/sync-logs').then((r) => setRows(r.data)).catch((e) => toast.error(e.message)).finally(() => setLoading(false)) }, [])
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Log Sinkronisasi ke Gajamada</h2>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-800" /></div> :
          <Table><TableHeader className="bg-slate-50"><TableRow>
            <TableHead>Waktu</TableHead><TableHead>Prepetrator ID</TableHead>
            <TableHead>Status</TableHead><TableHead>Alasan</TableHead>
            <TableHead>HTTP</TableHead><TableHead>Oleh</TableHead>
          </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (<TableRow key={r.id}>
                <TableCell className="text-xs">{fmtDate(r.request_at)}</TableCell>
                <TableCell className="text-xs font-mono">{r.prepetrator_id}</TableCell>
                <TableCell><Badge className={r.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{r.reason || '-'}</TableCell>
                <TableCell className="text-xs">{r.http_status || '-'}</TableCell>
                <TableCell className="text-xs">{r.by?.username}</TableCell>
              </TableRow>))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">Belum ada sinkronisasi.</TableCell></TableRow>}
            </TableBody></Table>}
      </CardContent></Card>
    </div>
  )
}
function AuditView() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api('/audit').then((r) => setRows(r.data)).catch((e) => toast.error(e.message)).finally(() => setLoading(false)) }, [])
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Audit Log</h2>
      <Card><CardContent className="p-0">
        {loading ? <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-800" /></div> :
          <Table><TableHeader className="bg-slate-50"><TableRow>
            <TableHead>Waktu</TableHead><TableHead>Pelaku</TableHead>
            <TableHead>Aksi</TableHead><TableHead>Resource</TableHead><TableHead>Detail</TableHead>
          </TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (<TableRow key={r.id}>
                <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                <TableCell className="text-xs">{r.actor?.username} <Badge variant="outline" className="ml-1 text-[10px]">{r.actor?.role}</Badge></TableCell>
                <TableCell className="text-xs font-medium">{r.action}</TableCell>
                <TableCell className="text-xs font-mono">{r.resource}</TableCell>
                <TableCell className="text-xs text-slate-500">{JSON.stringify(r.meta)}</TableCell>
              </TableRow>))}
              {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada log.</TableCell></TableRow>}
            </TableBody></Table>}
      </CardContent></Card>
    </div>
  )
}

// ---------------- Settings Page ----------------
const PassInput = memo(({ value, onChange, placeholder }) => {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} className="h-9 text-sm pr-8" />
      <button type="button" tabIndex={-1} onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
})
PassInput.displayName = 'PassInput'

function SettingsPage({ connStatus }) {
  const [saved, setSaved] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [testing, setTesting] = useState({})
  const [showPass, setShowPass] = useState({})

  // Gajamada fields
  const [gjEmail, setGjEmail] = useState('')
  const [gjPass, setGjPass] = useState('')

  const toggleShow = (k) => setShowPass((p) => ({ ...p, [k]: !p[k] }))
  const PassInput = ({ value, onChange, placeholder, field }) => (
    <div className="relative">
      <Input type={showPass[field] ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} className="h-9 text-sm pr-8" />
      <button type="button" onClick={() => toggleShow(field)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
        {showPass[field] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  )

  useEffect(() => {
    api('/settings').then((r) => {
      setSaved(r)
      if (r.gajamada?.email_set) setGjEmail(r.gajamada.email || '')
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-blue-800" /></div>

  const Dot = ({ ok }) => (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'} ${ok ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
  )

  const saveService = async (service) => {
    setSaving((p) => ({ ...p, [service]: true }))
    const body = {}
    if (service === 'gajamada') { body.gajamada_email = gjEmail; body.gajamada_password = gjPass }
    try {
      await api('/user/credentials', { method: 'POST', body: JSON.stringify(body) })
      toast.success('Kredensial Gajamada disimpan')
    } catch (e) {
      toast.error('Gagal menyimpan: ' + (e.message || 'error'))
    } finally {
      setSaving((p) => ({ ...p, [service]: false }))
    }
  }

  const testLogin = async (service) => {
    setTesting((p) => ({ ...p, [service]: true }))
    const body = { email: gjEmail, password: gjPass }
    try {
      const r = await api('/user/test-gajamada', { method: 'POST', body: JSON.stringify(body) })
      if (r.ok) toast.success('Login Gajamada berhasil')
      else toast.error('Login gagal: ' + (r.error || 'kredensial salah'))
    } catch (e) {
      toast.error('Test gagal: ' + (e.message || 'error'))
    } finally {
      setTesting((p) => ({ ...p, [service]: false }))
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><Settings className="h-6 w-6" /> Koneksi Eksternal</h2>
      <p className="text-sm text-slate-500 -mt-2">Masukkan kredensial akun Gajamada Anda.</p>

      {/* Gajamada */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Dot ok={connStatus.gajamada} />
            <span>Gajamada (eBdesk Fusion)</span>
            <Badge variant="outline" className={`text-[10px] ml-auto ${connStatus.gajamada ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}`}>
              {connStatus.gajamada ? 'Terhubung' : saved?.gajamada?.email_set ? 'Kredensial tersimpan' : 'Belum login'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={gjEmail} onChange={(e) => setGjEmail(e.target.value)} placeholder="email@gajamada" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Password</Label>
            <PassInput value={gjPass} onChange={(e) => setGjPass(e.target.value)} placeholder="••••••••" field="gj" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => testLogin('gajamada')} disabled={testing.gajamada || !gjEmail || !gjPass}>
              {testing.gajamada ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Test Login
            </Button>
            <Button size="sm" onClick={() => saveService('gajamada')} disabled={saving.gajamada || !gjEmail || !gjPass}>
              {saving.gajamada ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Simpan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function AstinaInputPage() {
  const [form, setForm] = useState({
    perihal: '', pengirim: '', nik: '', nomor_surat: '', tanggal: '', kategori: '', isi: ''
  })
  const [saving, setSaving] = useState(false)
  const [reference, setReference] = useState({ categories: [] })

  useEffect(() => { api('/reference').then((r) => setReference(r)).catch(() => {}) }, [])

  const categories = useMemo(() => [...(reference.categories || []), 'ASTINA'], [reference.categories])

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.perihal.trim()) { toast.error('Perihal wajib diisi'); return }
    setSaving(true)
    try {
      await api('/local-cases', {
        method: 'POST',
        body: JSON.stringify({
          perihal: form.perihal,
          pengirim: form.pengirim,
          reporter_nik: form.nik,
          nomor_surat: form.nomor_surat,
          tgl_surat: form.tanggal,
          category: form.kategori,
          summary: form.isi,
          source: 'astina',
          case_type: 'dumas',
        })
      })
      toast.success('Data ASTINA tersimpan')
      setForm({ perihal: '', pengirim: '', nik: '', nomor_surat: '', tanggal: '', kategori: '', isi: '' })
    } catch (err) { toast.error('Gagal menyimpan: ' + err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Input Manual ASTINA</h2>
        <p className="text-sm text-slate-500">Input pengaduan dari sumber ASTINA secara manual.</p>
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label>Perihal <span className="text-red-500">*</span></Label>
            <Input value={form.perihal} onChange={(e) => handleChange('perihal', e.target.value)} placeholder="Perihal surat/pengaduan" />
          </div>
          <div>
            <Label>Pengirim</Label>
            <Input value={form.pengirim} onChange={(e) => handleChange('pengirim', e.target.value)} placeholder="Nama pengirim/pelapor" />
          </div>
          <div>
            <Label>NIK</Label>
            <Input value={form.nik} onChange={(e) => handleChange('nik', e.target.value)} placeholder="NIK pelapor" />
          </div>
          <div>
            <Label>Nomor Surat</Label>
            <Input value={form.nomor_surat} onChange={(e) => handleChange('nomor_surat', e.target.value)} placeholder="Nomor surat" />
          </div>
          <div>
            <Label>Tanggal Surat</Label>
            <Input type="date" value={form.tanggal} onChange={(e) => handleChange('tanggal', e.target.value)} />
          </div>
          <div>
            <Label>Kategori</Label>
            <Select value={form.kategori} onValueChange={(v) => handleChange('kategori', v)}>
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Isi / Kronologis</Label>
            <Textarea value={form.isi} onChange={(e) => handleChange('isi', e.target.value)} placeholder="Isi pengaduan..." className="min-h-[120px]" />
          </div>
          <div className="pt-2">
            <Button onClick={submit} disabled={saving} className="bg-blue-800 hover:bg-blue-900">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Simpan
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------- App Shell ----------------
function AppShell({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [selectedCase, setSelectedCase] = useState(null)
  const role = user?.role || 'unit'
  const isKasubbid = role === 'kasubbid' || role === 'admin'
  const isPropamYanduan = role === 'kabid_propam' || role === 'kasubbag_yanduan'
  const isSuperAdmin = role === 'super_admin'
  const canDisposisi = isKasubbid || isPropamYanduan
  const canAstina = isPropamYanduan
  const canManageUnits = isKasubbid || isSuperAdmin
  const canSettings = isKasubbid || isSuperAdmin
  const canDashboardCases = !isSuperAdmin
  const [disposisiCount, setDisposisiCount] = useState(0)
  const notifiedRef = useRef(false)
  const [connStatus, setConnStatus] = useState({ gajamada: false })

  const refreshDisposisiCount = async () => {
    if (!canDisposisi) return
    try { const r = await api('/disposisi-queue/count'); setDisposisiCount(r.count || 0) } catch (_) { /* ignore */ }
  }
  const refreshConnStatus = async () => {
    try {
      const r = await api('/connection-status')
      setConnStatus({ gajamada: !!r.gajamada })
    } catch (_) { /* ignore */ }
  }
  useEffect(() => {
    refreshConnStatus()
    const interval = setInterval(refreshConnStatus, 60000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line
  useEffect(() => {
    if (!canDisposisi) return
    refreshDisposisiCount()
    const interval = setInterval(refreshDisposisiCount, 30000)
    return () => clearInterval(interval)
  }, [canDisposisi]) // eslint-disable-line
  useEffect(() => {
    if (canDisposisi && disposisiCount > 0 && !notifiedRef.current) {
      notifiedRef.current = true
      toast.info(`Ada ${disposisiCount} pengaduan belum didisposisi ke unit`, {
        action: { label: 'Lihat', onClick: () => setTab('disposisi') },
      })
    }
  }, [disposisiCount]) // eslint-disable-line

  const menu = [
    ...(canDashboardCases ? [{ id: 'dashboard', label: 'Dashboard ANEV', icon: LayoutDashboard }] : []),
    ...(canDashboardCases ? [{ id: 'cases', label: 'Daftar Surat', icon: FolderKanban }] : []),
    ...(canDisposisi ? [{ id: 'disposisi', label: 'Disposisi', icon: ArrowRightLeft, badge: disposisiCount }] : []),
    ...(canAstina ? [{ id: 'astina', label: 'ASTINA', icon: FileText }] : []),
    ...(canManageUnits ? [{ id: 'units', label: 'Master Unit', icon: Building2 }] : []),
    ...(canManageUnits ? [{ id: 'satker', label: 'Satker/Satwil', icon: MapPin }] : []),
    { id: 'sync', label: 'Log Sync', icon: Send },
    { id: 'audit', label: 'Audit Log', icon: History },
    ...(canSettings ? [{ id: 'settings', label: 'Pengaturan', icon: Settings }] : []),
  ]

  return (
    <div className="min-h-screen flex bg-slate-100">
      <aside className="w-64 bg-gradient-to-b from-blue-950 via-blue-900 to-indigo-950 text-white flex flex-col shadow-2xl">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center"><Shield className="h-5 w-5" /></div>
            <div>
              <p className="font-bold text-lg leading-tight">{APP_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-1.5" data-testid="status-gajamada">
              <span className={`h-2 w-2 rounded-full ${connStatus.gajamada ? 'bg-green-400' : 'bg-red-400'} ${connStatus.gajamada ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
              <span className="text-[10px] text-blue-200">GAJAMADA</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {menu.map((m) => (
            <button key={m.id} onClick={() => setTab(m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors relative ${tab === m.id ? 'bg-white/15 text-white shadow-sm' : 'text-blue-200 hover:bg-white/5 hover:text-white'}`}>
              <span className="relative">
                <m.icon className="h-4 w-4" />
                {!!m.badge && <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
              </span>
              <span className="flex-1 text-left">{m.label}</span>
              {!!m.badge && <Badge className="bg-red-600 text-white text-[10px] h-5 min-w-5 px-1.5 justify-center">{m.badge}</Badge>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
              {(user.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>

            </div>
          </div>
          <Button variant="ghost" className="w-full mt-2 text-blue-200 hover:text-white hover:bg-white/10" onClick={onLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto p-6">
          {tab === 'dashboard' && canDashboardCases && <Dashboard user={user} />}
          {tab === 'cases' && canDashboardCases && <CasesList user={user} onOpenCase={setSelectedCase} />}
          {tab === 'disposisi' && canDisposisi && <DisposisiPage user={user} onOpenCase={setSelectedCase} onGoMasterUnit={() => setTab('units')} onQueueChange={refreshDisposisiCount} />}
          {tab === 'astina' && canAstina && <AstinaInputPage />}
          {tab === 'units' && canManageUnits && <MasterUnitPage user={user} />}
          {tab === 'satker' && canManageUnits && <SatkerSatwilPage user={user} />}
          {tab === 'sync' && <SyncLogsView />}
          {tab === 'audit' && <AuditView />}
          {tab === 'settings' && canSettings && <SettingsPage connStatus={connStatus} />}
        </div>
      </main>

      <CaseDetail pid={selectedCase} user={user} onClose={() => setSelectedCase(null)} onChanged={refreshDisposisiCount} />
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  useEffect(() => { api('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setChecking(false)) }, [])
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }) } catch (_) { /* ignore */ }
    setUser(null); toast.success('Anda telah keluar')
  }
  if (checking) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div>
  if (!user) return <LoginPage onSuccess={setUser} />
  return <AppShell user={user} onLogout={logout} />
}

export default App
