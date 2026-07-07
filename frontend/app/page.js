'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react'
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
import { toast } from 'sonner'
import {
  Shield, LayoutDashboard, FolderKanban, Send, LogOut, Search,
  Loader2, FileText, RefreshCw, Users, ChevronLeft, ChevronRight, Download, Paperclip,
  Building2, User, Calendar, Tag, CheckCircle2, XCircle, Clock,
  AlertCircle, ArrowRightLeft, History, Star, QrCode, Mail, Phone, MapPin,
  Hash, Settings, Eye, EyeOff,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line } from 'recharts'
import { parseAstinaSurat } from '@/lib/parse-astina'

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
const shortUnit = (u) => {
  if (!u) return '-'
  return u
    .replace(' SUBBID PAMINAL POLDA JAWA BARAT', ' PAMINAL')
    .replace(' SUBBID PAMINAL BID PROPAM POLDA JABAR', ' PAMINAL')
    .replace(' SUBBID PROVOS BID PROPAM POLDA JABAR', ' PROVOS')
    .replace(' SUBBID WABPROF BID PROPAM POLDA JABAR', ' WABPROF')
    .replace(' SUBBAG RENMIN BID PROPAM POLDA JABAR', ' RENMIN')
    .replace(' BID PROPAM POLDA JABAR', ' PROPAM')
    .replace(' POLDA JAWA BARAT', '')
    .replace(' BID PROPAM', '')
}

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
function Dashboard({ user, onNavigate }) {
  const [anev, setAnev] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api(`/anev?scope=${scope}`); setAnev(r) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [scope])
  useEffect(() => { load() }, [load])

  const isAdmin = ['superadmin', 'kabid', 'kasubbag', 'kasubbid', 'admin'].includes(user.role)
  const isSubUnit = user.role === 'unit' || user.role === 'polres'

  const COLORS = useMemo(() => ['#1e40af', '#7c3aed', '#0891b2', '#059669', '#ea580c', '#dc2626', '#4338ca', '#9333ea'], [])
  if (loading || !anev) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div>

  const navTo = (filter) => onNavigate && onNavigate('cases', filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard ANEV</h2>
          <p className="text-sm text-slate-500">
            {isSubUnit ? `Unit: ${user.unit || '-'}` : scope === 'paminal' ? 'Cakupan: Paminal & Unit' : 'Cakupan: Seluruh Polda Jabar'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isSubUnit && (
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

      {/* KPI Cards — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard color="blue" icon={<FolderKanban />} label="Total Kasus" value={anev.total} subtitle={`${anev.sampled} sampel`} onClick={() => navTo({})} />
        {!isSubUnit && <KpiCard color="amber" icon={<Clock />} label="Diterima" value={anev.kpi.totalDiterima} onClick={() => navTo({ status: 'Diterima' })} />}
        <KpiCard color="blue" icon={<ArrowRightLeft />} label="Didistribusi" value={anev.kpi.totalDidistribusi} onClick={() => navTo({ status: 'Didistribusi' })} />
        <KpiCard color="purple" icon={<AlertCircle />} label="Proses Lidik" value={anev.kpi.totalLidik} onClick={() => navTo({ status: 'Proses Lidik' })} />
        <KpiCard color="green" icon={<CheckCircle2 />} label="Selesai" value={anev.kpi.totalSelesai} onClick={() => navTo({ status: 'Selesai' })} />
        {anev.kpi.totalOverdue > 0 && (
          <KpiCard color="amber" icon={<Clock />} label="Overdue >30hr" value={anev.kpi.totalOverdue} subtitle="⏰ Perlu tindakan" onClick={() => navTo({})} />
        )}
        {!isSubUnit && anev.kpi.wassidik > 0 && (
          <KpiCard color="blue" icon={<Send />} label="Wassidik" value={anev.kpi.wassidik} subtitle="Dilimpah" />
        )}
      </div>

      {/* Summary strip */}
      {anev.kpi.skor != null && (
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <Badge variant="outline" className={`text-xs ${anev.kpi.skor >= 70 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
            Skor Rata-rata: {anev.kpi.skor}/100
          </Badge>
          {anev.kpi.avgWaktu != null && (
            <Badge variant="outline" className="text-xs bg-slate-50">{anev.kpi.avgWaktu} hari rata-rata penyelesaian</Badge>
          )}
          {anev.kpi.totalAtensi > 0 && (
            <Badge className="bg-amber-100 text-amber-800 text-xs border border-amber-300">
              <Star className="h-3 w-3 mr-1 inline" /> {anev.kpi.totalAtensi} ATENSI
            </Badge>
          )}
        </div>
      )}

      {/* Per Unit Ranking Table — grouped by kategori — admin view only */}
      {isAdmin && anev.perUnit && anev.perUnit.length > 0 && (() => {
        const orderKategori = ['Paminal', 'Provos', 'Wabprof', 'Polres', 'Renmin', 'Lainnya']
        const grouped = {}
        for (const u of anev.perUnit) { const k = u.kategori || 'Lainnya'; if (!grouped[k]) grouped[k] = []; grouped[k].push(u) }
        const cats = ['Paminal', 'Provos', 'Wabprof', 'Polres', 'Renmin', 'Lainnya'].filter((k) => grouped[k] && grouped[k].length > 0)
        return (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Kinerja per Unit</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <th className="p-3 pl-4 w-8">#</th>
                      <th className="p-3">Unit</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-right">Selesai</th>
                      <th className="p-3 text-right">Overdue</th>
                      <th className="p-3 text-right">Avg Waktu</th>
                      <th className="p-3 text-right pr-4">Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((kategori) => (<Fragment key={kategori}>
                        <tr className="bg-slate-100">
                          <td colSpan={7} className="px-4 py-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            {kategori}
                          </td>
                        </tr>
                        {grouped[kategori].map((u, i) => (
                          <tr key={u.name} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navTo({ unit: u.name })}>
                            <td className="p-3 pl-4 text-slate-400">{i + 1}</td>
                            <td className="p-3 font-medium max-w-[300px] truncate">{shortUnit(u.name)}</td>
                            <td className="p-3 text-right">{u.total}</td>
                            <td className="p-3 text-right text-green-700">{u.selesai}</td>
                            <td className="p-3 text-right">{u.overdue > 0 ? <span className="text-red-600 font-medium">{u.overdue}</span> : '0'}</td>
                            <td className="p-3 text-right">{u.avgWaktu != null ? `${u.avgWaktu}h` : '-'}</td>
                            <td className="p-3 text-right pr-4">
                              <span className={`font-semibold ${u.skor >= 80 ? 'text-green-700' : u.skor >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                                {u.skor}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Per Sub-Unit — subbid/polres view */}
      {isSubUnit && anev.perUnit && anev.perUnit.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Per Anak Unit</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="p-3 pl-4">Anak Unit</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-right">Selesai</th>
                    <th className="p-3 text-right">Overdue</th>
                    <th className="p-3 text-right pr-4">Avg Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {anev.perUnit.map((u) => (
                    <tr key={u.name} className="border-b hover:bg-slate-50 cursor-pointer" onClick={() => navTo({ unit: u.name })}>
                      <td className="p-3 pl-4 font-medium max-w-[300px] truncate">{shortUnit(u.name)}</td>
                      <td className="p-3 text-right">{u.total}</td>
                      <td className="p-3 text-right text-green-700">{u.selesai}</td>
                      <td className="p-3 text-right">{u.overdue > 0 ? <span className="text-red-600 font-medium">{u.overdue}</span> : '0'}</td>
                      <td className="p-3 text-right pr-4">{u.avgWaktu != null ? `${u.avgWaktu}h` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly trend */}
      {anev.monthly && anev.monthly.length > 1 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Tren Bulanan</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={anev.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis />
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="received" stroke="#1e40af" strokeWidth={2} name="Diterima" dot={false} />
                <Line type="monotone" dataKey="completed" stroke="#059669" strokeWidth={2} name="Selesai" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Compact charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi per Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={anev.byStatus.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                <YAxis />
                <RTooltip />
                <Bar dataKey="value" fill="#1e40af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi per Kategori</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={anev.byCategory.slice(0, 8)} dataKey="value" nameKey="name" outerRadius={85}>
                  {anev.byCategory.slice(0, 8).map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <RTooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {anev.byUnit && anev.byUnit.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Distribusi per Unit</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={anev.byUnit.slice(0, 12).map(x => ({ ...x, name: shortUnit(x.name) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 11 }} />
                <RTooltip />
                <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const KpiCard = memo(function KpiCard({ color, icon, label, value, subtitle, onClick }) {
  const bg = { blue: 'border-l-blue-800 bg-blue-50/40 text-blue-800',
              amber: 'border-l-amber-500 bg-amber-50/40 text-amber-700',
              purple: 'border-l-purple-600 bg-purple-50/40 text-purple-700',
              green: 'border-l-green-600 bg-green-50/40 text-green-700' }[color] || 'border-l-slate-500'
  return (
    <Card className={`border-l-4 ${bg.split(' ')[0]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`} onClick={onClick}>
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
  const [showFullChronology, setShowFullChronology] = useState(false)
  const [mergedTimeline, setMergedTimeline] = useState([])
  const [saranText, setSaranText] = useState('')
  const [saranSubmitting, setSaranSubmitting] = useState(false)

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

  const submitSaran = async () => {
    if (!saranText.trim()) return toast.error('Saran tidak boleh kosong')
    setSaranSubmitting(true)
    try {
      await api(`/cases/${encodeURIComponent(pid)}/saran`, { method: 'POST', body: JSON.stringify({ title: 'Saran Yanduan', description: saranText }) })
      toast.success('Saran berhasil dikirim')
      setSaranText('')
      await load(); onChanged?.()
    } catch (e) { toast.error(e.message) }
    finally { setSaranSubmitting(false) }
  }

  if (!pid) return null
  const derivedStatus = data?.derived_status

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
                  <div className="flex items-center gap-2 mt-1">
                    {data.source_alias && <Badge className={`${sourceColor(data.source_alias)} text-[10px]`}>{data.source_alias}</Badge>}
                  </div>
                  <p className="text-lg font-bold font-mono">{data.prepetrator_id}</p>
                  <p className="text-sm mt-2 text-blue-100 line-clamp-2">{data.prepetrator_name || '(Tanpa nama terlapor)'}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={statusColor(derivedStatus)}>{derivedStatus}</Badge>
                  <p className="text-xs text-blue-200">{fmtDate(data.created_date)}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <Tabs defaultValue="info">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="catatan">Catatan ({mergedTimeline.length})</TabsTrigger>
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
                  {atts.length > 0 && (
                    <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Lampiran ({atts.length})</CardTitle></CardHeader>
                      <CardContent>
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
                        </div>
                      </CardContent>
                    </Card>
                  )}
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

                <TabsContent value="catatan" className="mt-4 space-y-4">
                  {user.role === 'yanduan' && (
                    <Card className="border-blue-300 bg-blue-50/30">
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Beri Saran</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <Textarea value={saranText} onChange={(e) => setSaranText(e.target.value)} placeholder="Tulis saran yanduan..." className="min-h-[80px] text-sm" />
                          <Button onClick={submitSaran} disabled={saranSubmitting || !saranText.trim()} size="sm">
                            {saranSubmitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null} Kirim Saran
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <Card><CardHeader className="pb-2">
                    <CardTitle className="text-sm">Catatan</CardTitle>
                  </CardHeader>
                    <CardContent>
                      {mergedTimeline.length === 0 ? <p className="text-sm text-slate-500">Catatan masih kosong.</p> :
                        <ol className="relative border-l-2 border-blue-200 ml-3 space-y-4">
                          {mergedTimeline.map((t) => (
                            <li key={t.id} className="ml-4 relative">
                              <div className={`absolute -left-[24px] w-4 h-4 rounded-full border-2 border-white ${t.source === 'gajamada' ? 'bg-slate-600' : t.by?.role === 'yanduan' ? 'bg-amber-500' : 'bg-blue-800'}`} />
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium">{t.title || t.status}</p>
                                <Badge variant="outline" className={`text-[10px] ${t.source === 'gajamada' ? 'bg-slate-100 text-slate-700' : t.by?.role === 'yanduan' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-blue-50 text-blue-800'}`}>
                                  {t.source === 'gajamada' ? 'Gajamada' : t.by?.role === 'yanduan' ? 'Saran Yanduan' : 'Internal'}
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
                  <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Log Sinkronisasi ke Gajamada</CardTitle>
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
function CasesList({ user, onOpenCase, initialFilter }) {
  const [cases, setCases] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size] = useState(7)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('')
  const [scope, setScope] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('')
  const [astinaToken, setAstinaToken] = useState('')
  const [astinaTokenSet, setAstinaTokenSet] = useState(!!(process.env.NEXT_PUBLIC_ASTINA_COOKIE || ''))
  const [astinaCookie, setAstinaCookie] = useState('')
  const [loading, setLoading] = useState(true)
  const [reference, setReference] = useState({ units: [], statuses: [], categories: [] })

  // Apply filter from dashboard navigation
  useEffect(() => {
    if (initialFilter) {
      if (initialFilter.status) setStatus(initialFilter.status)
      if (initialFilter.unit) setUnit(initialFilter.unit)
      setPage(1)
    }
  }, [initialFilter])

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
      case_type: 'pengaduan',
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
          source_alias: c.source_alias, disposisi_case_position: '-', '5w1h_where': '', '5w1h_when': c.tgl_surat, derived_status: c.status,
        }))
        setCases(formatted); setTotal(r.total || formatted.length)
      } catch(e) { toast.error(e.message) }
      finally { setLoading(false) }
      return
    }

    if (sourceFilter === 'astina') {
      setLoading(true)
      try {
        const lc = await api('/local-cases?source=astina&case_type=dumas').catch(() => ({ data: [] }))
        const localData = (lc.data || []).map(c => ({
          ...c, id: c.id, prepetrator_id: c.prepator_id, created_date: c.created_at, updated_at: c.updated_at,
          status_label: c.status, category: c.category || 'NON-DUMAS', pengirim: c.pengirim,
          prepetrator_name: c.prepator_name, summary: c.perihal, content: c.content,
          source_alias: c.source_alias, derived_status: c.status,
          nomor_surat: c.nomor_surat, tgl_surat: c.tgl_surat, perihal: c.perihal,
        }))
        // ASTINA tab: only DUMAS (from local_cases), exclude live/unclassified
        setCases(localData)
        setTotal(localData.length)
      } catch(e) { toast.error('Gagal fetch ASTINA: ' + e.message) }
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
  const clearFilter = useCallback(() => { setStatus(''); setCategory(''); setUnit(''); setSearch(''); setScope('all'); setPage(1) }, [])
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
              <TabsTrigger value="astina" className="text-xs">ASTINA</TabsTrigger>
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
                  {sourceFilter && sourceFilter !== 'astina' ? (
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
                  {sourceFilter && sourceFilter !== 'astina' ? (
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
                          <TableCell className="pt-3"><Badge className={statusColor(c.status_label)}>{c.status_label || 'Diterima'}</Badge></TableCell>
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
                            {c.source_alias === 'ASTINA' ? (
                              <>
                                <p className="text-sm font-medium">{c.perihal || c.summary || c.nomor_surat || '-'}</p>
                                {c.nomor_surat && <p className="text-xs text-slate-500 mt-0.5">No. {c.nomor_surat}</p>}
                              </>
                            ) : (
                              <>
                                <p className="text-sm font-mono font-semibold">{c.id}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{fmtDate(c.created_date)}</p>
                              </>
                            )}
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
                              <Badge className={`${statusColor(c.status_label)} text-xs`}>{c.status_label || c.derived_status}</Badge>
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
            <DialogHeader><DialogTitle>Tambah Data Surat</DialogTitle><DialogDescription>Isi data surat manual.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Jenis</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                  <button type="button" onClick={() => setCreateForm({ ...createForm, case_type: 'pengaduan' })}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium ${createForm.case_type === 'pengaduan' ? 'bg-blue-800 text-white border-blue-900' : 'bg-white text-slate-700 border-slate-300'}`}>Pengaduan</button>
                  <button type="button" onClick={() => setCreateForm({ ...createForm, case_type: 'laporan_informasi' })}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium ${createForm.case_type === 'laporan_informasi' ? 'bg-sky-800 text-white border-sky-900' : 'bg-white text-slate-700 border-slate-300'}`}>Laporan Informasi</button>
                  <button type="button" onClick={() => setCreateForm({ ...createForm, case_type: 'non_dumas' })}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium ${createForm.case_type === 'non_dumas' ? 'bg-slate-800 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>Non-Dumas</button>
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
  const [detailEdit, setDetailEdit] = useState(false)
  const [detailForm, setDetailForm] = useState({})

  const resetForm = (ref, item) => {
    setToUnit(''); setNote(''); setIsAtensi(false)
    const ct = item?.case_type || ''
    const src = item?._source || ''
    if (ct === 'non_pengaduan' || ct === 'non_dumas') setCaseType('non_dumas')
    else if (src === 'astina') setCaseType('non_dumas')
    else setCaseType('dumas')
    const dumasTasks = ref?.default_disposisi_tasks || reference.default_disposisi_tasks || []
    const nonDumasTasks = ref?.non_dumas_disposisi_tasks || reference.non_dumas_disposisi_tasks || dumasTasks
    const isNonDumas = ct === 'non_pengaduan' || ct === 'non_dumas' || src === 'astina'
    const defaults = isNonDumas ? nonDumasTasks : dumasTasks
    setTasks(defaults.map((label) => ({ label, checked: false })))
  }

  const [astinaError, setAstinaError] = useState(null)

  const loadQueue = async () => {
    setLoading(true)
    try {
      const [q, r] = await Promise.all([api('/disposisi-queue'), api('/reference')])
      setQueue(q.data); setReference(r); resetForm(r, q.data?.[0]); setIdx(0)
      if (q.astina_error) {
        setAstinaError(q.astina_error)
        if (q.astina_error === 'OTP_REQUIRED') {
          toast.warning('ASTINA memerlukan OTP. Silakan login ulang ke ASTINA.')
        } else {
          toast.warning(`ASTINA: ${q.astina_error}`)
        }
      } else {
        setAstinaError(null)
      }
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadQueue() }, [])

  const loadRiwayat = async () => { try { const r = await api('/disposisi-history'); setRiwayat(r.data) } catch (e) { toast.error(e.message) } }
  const openEdit = async (d) => {
    const src = d.case_info?.source_alias || 'GAJAMADA'
    const item = { prepetrator_id: d.prepetrator_id, _source: src === 'ASTINA' ? 'astina' : 'gajamada', perihal: d.case_info?.perihal || '', nomor_surat: d.case_info?.nomor_surat || '', pengirim: d.case_info?.pengirim || '', source_alias: src, localCaseId: null }
    setEditQueueItem(item)
    setToUnit(d.to_unit || '')
    const rawNote = d.note || ''
    const tasksMatch = rawNote.match(/^TASKS:\s*(.+?)\n/)
    const savedTasks = tasksMatch ? tasksMatch[1].split(/,\s*/).filter(Boolean) : []
    const cleanNote = tasksMatch ? rawNote.slice(tasksMatch[0].length).trim() : rawNote
    setNote(cleanNote)
    setIsAtensi(!!d.is_atensi)
    // Fetch case_type from case detail
    let ct = src === 'ASTINA' ? 'non_dumas' : 'dumas'
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
    const isAstina = current._source === 'astina'
    // Immediately clear stale data so UI reflects the new case
    setDetail(null); setAtts([]); setTimeline([])
    let cancelled = false
    ;(async () => {
      try {
        if (isAstina) {
          const r = await api(`/astina/surat/${encodeURIComponent(pid)}/riwayat`).catch(() => ({ riwayat_disposisi: [] }))
          if (!cancelled) setTimeline((r.riwayat_disposisi || current._riwayat_disposisi || []).map((e) => ({ ...e, _source: 'astina' })))
        } else {
          const [d, a, t] = await Promise.all([
            api(`/cases/${encodeURIComponent(pid)}`).catch(() => ({ data: null })),
            api(`/cases/${encodeURIComponent(pid)}/attachments`).catch(() => ({ data: [] })),
            api(`/cases/${encodeURIComponent(pid)}/timeline-all`).catch(() => ({ data: [] })),
          ])
          if (!cancelled) { setDetail(d.data); setAtts(a.data); setTimeline(t.data || []) }
        }
      } catch (_) { /* ignore */ }
    })()
    if (!editMode) resetForm(null, current)
    setActiveTab('info')
    setPdfIdx(0)
    setKronologiMode('singkat')
    return () => { cancelled = true }
  }, [idx, current?.prepetrator_id, current?._source]) // eslint-disable-line

  // Unified attachments across ASTINA / Gajamada sources
  const attachments = useMemo(() => {
    if (!current) return []
    if (current._source === 'astina') {
      const files = [...(current.files || []), ...(current.lampiran || [])]
      return files.map((f) => {
        const nm = f.filename || 'file'
        const inlineUrl = `/api/astina/attachment/${encodeURIComponent(f.id)}?filename=${encodeURIComponent(nm)}&inline=1`
        const dlUrl = `/api/astina/attachment/${encodeURIComponent(f.id)}?filename=${encodeURIComponent(nm)}`
        return { id: f.id, name: nm, url: inlineUrl, dlUrl, isPdf: /\.pdf$/i.test(nm), source: 'astina' }
      })
    }
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

      {astinaError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">ASTINA tidak tersedia</p>
            <p className="text-xs text-amber-700 mt-0.5">{astinaError === 'OTP_REQUIRED' ? 'Memerlukan OTP. Silakan login ulang di halaman ASTINA.' : astinaError}</p>
          </div>
        </div>
      )}

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
                {current?._source === 'astina' && !detailEdit && (
                  <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => {
                    const parsed = parseAstinaSurat(current._astina_raw)
                    setDetailForm({
                      prepetrator_name: parsed.prepetrator_name || (current.prepetrator_name && current.prepetrator_name !== '-' ? current.prepetrator_name : ''),
                      pengirim: parsed.pengirim || current.pengirim || '',
                      perihal: parsed.perihal || current.perihal || '',
                      nomor_surat: parsed.nomor_surat || current.nomor_surat || '',
                      summary: parsed.summary || '',
                      category: current.category !== 'NON-DUMAS' ? current.category : (parsed.category || 'NON-DUMAS'),
                    })
                    setDetailEdit(true)
                  }}>Edit Data</Button>
                )}
              </div>
              {detailEdit ? (
                <div className="space-y-3">
                  <div><Label className="text-xs">Terlapor</Label><Input value={detailForm.prepetrator_name || ''} onChange={(e) => setDetailForm({ ...detailForm, prepetrator_name: e.target.value })} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Pengirim</Label><Input value={detailForm.pengirim || ''} onChange={(e) => setDetailForm({ ...detailForm, pengirim: e.target.value })} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Perihal</Label><Input value={detailForm.perihal || ''} onChange={(e) => setDetailForm({ ...detailForm, perihal: e.target.value })} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Nomor Surat</Label><Input value={detailForm.nomor_surat || ''} onChange={(e) => setDetailForm({ ...detailForm, nomor_surat: e.target.value })} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Rangkuman</Label><Textarea value={detailForm.summary || ''} onChange={(e) => setDetailForm({ ...detailForm, summary: e.target.value })} rows={3} className="text-sm" /></div>
                  <div><Label className="text-xs">Kategori</Label><Select value={detailForm.category || 'NON-DUMAS'} onValueChange={(v) => setDetailForm({ ...detailForm, category: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{reference?.categories?.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select></div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailEdit(false)} className="flex-1">Batal</Button>
                    <Button size="sm" onClick={async () => {
                      const pid = current.prepetrator_id
                      if (!pid) return
                      try {
                        await api('/local-cases', { method: 'POST', body: JSON.stringify({ source: 'astina', prepetrator_id: pid, prepetrator_name: detailForm.prepetrator_name, pengirim: detailForm.pengirim, perihal: detailForm.perihal, nomor_surat: detailForm.nomor_surat, summary: detailForm.summary, category: detailForm.category }) })
                        toast.success('Data tersimpan')
                        setDetailEdit(false)
                      } catch (e) { toast.error('Gagal menyimpan: ' + e.message) }
                    }} className="flex-1">Simpan</Button>
                  </div>
                </div>
              ) : (
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
              )}
            </section>

            {/* --- SECTION: Preview PDF (ASTINA) atau Kronologi (Gajamada) --- */}
            {current?._source === 'astina' ? (
              <section data-testid="section-pdf">
                <div className="flex items-center gap-2 mb-2 pb-1 border-b border-slate-200">
                  <Paperclip className="h-4 w-4 text-blue-800" />
                  <h3 className="text-sm font-semibold text-slate-800">Preview PDF ({attachments.length})</h3>
                  {attachments[pdfIdx] && (
                    <a href={attachments[pdfIdx].dlUrl} download className="ml-auto text-xs text-emerald-700 hover:underline flex items-center gap-1" data-testid="pdf-download-current">
                      <Download className="h-3 w-3" /> Unduh
                    </a>
                  )}
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4 text-center" data-testid="pdf-empty">Tidak ada lampiran.</p>
                ) : (
                  <>
                    {attachments.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {attachments.map((f, i) => (
                          <button
                            key={f.id}
                            onClick={() => setPdfIdx(i)}
                            className={`text-[10px] px-2 py-1 rounded border ${i === pdfIdx ? 'bg-blue-800 text-white border-blue-900' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                            data-testid={`pdf-tab-${i}`}
                          >
                            <span className="max-w-[140px] truncate inline-block align-middle">{f.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="w-full border rounded-md overflow-hidden bg-slate-100" style={{ height: '480px' }}>
                      {attachments[pdfIdx]?.isPdf ? (
                        <iframe key={attachments[pdfIdx].id} src={attachments[pdfIdx].url} className="w-full h-full" title={attachments[pdfIdx].name} data-testid="pdf-preview-iframe" />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2">
                          <FileText className="h-8 w-8" />
                          <a href={attachments[pdfIdx]?.dlUrl} className="text-blue-800 underline" download>Unduh {attachments[pdfIdx]?.name}</a>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            ) : (
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
            )}

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
                    const isAstina = current._source === 'astina'
                    const title = isAstina ? (r.jenis || 'Disposisi') : (r.title || r.status_alias || r.status || 'Aktivitas')
                    const from = isAstina ? r.dari_name : r.previous_case_position
                    const to = isAstina ? (Array.isArray(r.tujuan) ? r.tujuan.join(' · ') : r.tujuan_name) : r.case_position
                    const officer = r.officer_report_name
                    const desc = isAstina ? (Array.isArray(r.note) ? r.note.join(' · ') : (r.note || r.custom_note)) : r.description
                    const dateStr = isAstina ? `${r.tanggal || (r.created_at || '').slice(0, 10)} ${r.waktu || ''}` : fmtDate(r.date_activity)
                    return (
                      <li key={r.id || i} className="text-xs" data-testid={`timeline-item-${i}`}>
                        <span className="absolute -left-[7px] w-3 h-3 rounded-full bg-blue-800 border-2 border-white" />
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800">{title}</span>
                          {!isAstina && r.source && <Badge variant="outline" className="text-[8px] py-0">{r.source.toUpperCase()}</Badge>}
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
                    Simpan
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

// ---------------- Master Unit CRUD ----------------
function MasterUnitPage({ user }) {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', parent: 'KASUBBID PAMINAL POLDA JAWA BARAT', order: 99 })
  const [syncing, setSyncing] = useState(false)
  const isKasubbid = ['superadmin', 'kabid', 'kasubbag', 'kasubbid', 'admin'].includes(user.role)

  const load = async () => {
    setLoading(true)
    try { const r = await api('/units-master'); setUnits(r.data) }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ name: '', parent: 'KASUBBID PAMINAL POLDA JAWA BARAT', order: 99 }); setDialogOpen(true) }
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, parent: u.parent || '', order: u.order || 99, active: u.active }); setDialogOpen(true) }
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

  // Group units by parent
  const grouped = useMemo(() => {
    const parents = units.filter((u) => u.is_kasubbid).sort((a, b) => (a.order || 99) - (b.order || 99))
    return parents.map((p) => ({
      ...p,
      children: units.filter((u) => !u.is_kasubbid && u.parent === (p.parent || p.name)).sort((a, b) => (a.order || 99) - (b.order || 99)),
    }))
  }, [units])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Master Unit</h2>
          <p className="text-sm text-slate-500">{units.length} unit — {grouped.length} induk</p>
        </div>
        {isKasubbid && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={syncGajamada} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />} Sync dari Gajamada
            </Button>
            <Button onClick={openCreate}><Building2 className="h-4 w-4 mr-2" /> Tambah Unit</Button>
          </div>
        )}
      </div>

      {loading ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-800" /></div> :
        <div className="space-y-2">
          {grouped.map((parent) => (
            <UnitGroup key={parent.id} parent={parent} isKasubbid={isKasubbid} onEdit={openEdit} onToggle={toggleActive} onDelete={remove} />
          ))}
        </div>
      }

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Unit' : 'Tambah Unit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Unit</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. UNIT 4 SUBBID PAMINAL POLDA JAWA BARAT" />
            </div>
            <div>
              <Label>Parent Unit</Label>
              <Input value={form.parent} onChange={(e) => setForm({ ...form, parent: e.target.value })} />
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

function UnitGroup({ parent, isKasubbid, onEdit, onToggle, onDelete }) {
  const [open, setOpen] = useState(true)
  const childCount = parent.children?.length || 0

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Parent header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-blue-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-blue-600 shrink-0" />}
        <Building2 className="h-4 w-4 text-blue-800 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-blue-900 truncate">{parent.name}</div>
          <div className="text-[11px] text-blue-600">{childCount} sub-unit</div>
        </div>
        <Badge className="bg-blue-800 text-white text-[10px] shrink-0">INDUK</Badge>
      </button>

      {/* Children list */}
      {open && (
        <div className="divide-y divide-slate-100">
          {childCount === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Belum ada sub-unit</div>
          ) : (
            parent.children.map((child) => (
              <div key={child.id} className={`flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-slate-50 transition-colors ${!child.active ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-sm truncate">{child.name}</span>
                  <Badge className={`text-[10px] shrink-0 ${child.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                    {child.active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                  {child.source === 'gajamada' && <Badge variant="outline" className="text-[10px] shrink-0">Gajamada</Badge>}
                </div>
                {isKasubbid && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => onToggle(child)}>
                      {child.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => onEdit(child)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-600 hover:text-red-700" onClick={() => onDelete(child)}>Hapus</Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
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
  const isAdmin = user.role === 'kasubbid' || user.role === 'admin'

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

// ---------------- Account Management Page (Super Admin) ----------------
function AccountManagementPage() {
  const [users, setUsers] = useState([])
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('users')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'unit', unit: '', email: '' })
  const [unitForm, setUnitForm] = useState({ name: '', parent: 'BID PROPAM POLDA JABAR', order: 99 })
  const [unitDialog, setUnitDialog] = useState(false)
  const [unitEditing, setUnitEditing] = useState(null)

  const loadUsers = async () => {
    try { const r = await api('/admin/users'); setUsers(r.data || []) } catch (_) { setUsers([]) }
  }
  const loadUnits = async () => {
    try { const r = await api('/units-master'); setUnits(r.data || []) } catch (_) { setUnits([]) }
  }
  useEffect(() => { loadUsers(); loadUnits(); setLoading(false) }, [])

  const openCreateUser = () => {
    setEditing(null)
    setForm({ username: '', password: '', name: '', role: 'unit', unit: '', email: '' })
    setDialogOpen(true)
  }
  const openEditUser = (u) => {
    setEditing(u)
    setForm({ username: u.username, password: '', name: u.name, role: u.role, unit: u.unit || '', email: u.email || '' })
    setDialogOpen(true)
  }
  const saveUser = async () => {
    if (!form.username || !form.name || !form.role) return toast.error('Username, nama, dan role wajib')
    if (!editing && !form.password) return toast.error('Password wajib untuk user baru')
    setSaving(true)
    try {
      if (editing) {
        await api(`/admin/users/${encodeURIComponent(editing.username)}`, { method: 'PUT', body: JSON.stringify(form) })
        toast.success('User diperbarui')
      } else {
        await api('/admin/users', { method: 'POST', body: JSON.stringify(form) })
        toast.success('User ditambahkan')
      }
      setDialogOpen(false); await loadUsers()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }
  const deleteUser = async (u) => {
    if (!confirm(`Hapus user "${u.name}" (${u.username})?`)) return
    try { await api(`/admin/users/${encodeURIComponent(u.username)}`, { method: 'DELETE' }); toast.success('User dihapus'); await loadUsers() }
    catch (e) { toast.error(e.message) }
  }

  const openCreateUnit = () => {
    setUnitEditing(null)
    setUnitForm({ name: '', parent: 'BID PROPAM POLDA JABAR', order: 99, active: true })
    setUnitDialog(true)
  }
  const openEditUnit = (u) => {
    setUnitEditing(u)
    setUnitForm({ name: u.name, parent: u.parent || '', order: u.order || 99, active: u.active !== false })
    setUnitDialog(true)
  }
  const saveUnit = async () => {
    if (!unitForm.name) return toast.error('Nama unit wajib')
    setSaving(true)
    try {
      if (unitEditing) {
        await api(`/units-master/${encodeURIComponent(unitEditing.id)}`, { method: 'PUT', body: JSON.stringify(unitForm) })
        toast.success('Unit diperbarui')
      } else {
        await api('/units-master', { method: 'POST', body: JSON.stringify(unitForm) })
        toast.success('Unit ditambahkan')
      }
      setUnitDialog(false); await loadUnits()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }
  const toggleUnitActive = async (u) => {
    try { await api(`/units-master/${encodeURIComponent(u.id)}`, { method: 'PATCH', body: JSON.stringify({ active: !u.active }) }); await loadUnits() }
    catch (e) { toast.error(e.message) }
  }
  const deleteUnit = async (u) => {
    if (!confirm(`Hapus unit "${u.name}"?`)) return
    try { await api(`/units-master/${encodeURIComponent(u.id)}`, { method: 'DELETE' }); toast.success('Unit dihapus'); await loadUnits() }
    catch (e) { toast.error(e.message) }
  }

  const roleLabel = (r) => ({ superadmin: 'Super Admin', kabid: 'Kabid', kasubbag: 'Kasubbag', kasubbid: 'Kasubbid', admin: 'Admin', unit: 'Unit', polres: 'Polres' })[r] || r
  const roleBadgeColor = (r) => {
    const map = { superadmin: 'bg-red-100 text-red-800', kabid: 'bg-purple-100 text-purple-800', kasubbag: 'bg-indigo-100 text-indigo-800', kasubbid: 'bg-blue-100 text-blue-800', admin: 'bg-cyan-100 text-cyan-800', unit: 'bg-slate-100 text-slate-700', polres: 'bg-amber-100 text-amber-800' }
    return map[r] || 'bg-slate-100 text-slate-700'
  }

  const parentUnits = units.filter((u) => u.is_kasubbid || (u.name && !units.some((c) => c.parent === u.name)))
  const groupedUnits = {}
  for (const u of units) {
    const p = u.parent || 'ROOT'
    if (!groupedUnits[p]) groupedUnits[p] = []
    groupedUnits[p].push(u)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-blue-800" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Pengaturan Akun</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola user / akun dan master unit organisasi</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {['users', 'units'].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-800 text-blue-800' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'users' ? '👤 Data User' : '🏢 Master Unit'}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateUser}><Users className="h-4 w-4 mr-2" /> Tambah User</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {users.map((u) => (
              <Card key={u.username}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm">{u.name}</CardTitle>
                      <p className="text-xs text-slate-500 font-mono">{u.username}</p>
                      {u.email && <p className="text-xs text-slate-400">{u.email}</p>}
                    </div>
                    <Badge className={roleBadgeColor(u.role)}>{roleLabel(u.role)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {u.unit && <p className="text-xs text-slate-500 truncate" title={u.unit}>Unit: {shortUnit(u.unit)}</p>}
                  {u._source === 'hardcoded' && <Badge variant="outline" className="text-[10px] mt-1 bg-slate-100">Hardcoded</Badge>}
                  <div className="flex justify-end gap-1 mt-2">
                    <Button size="sm" variant="ghost" onClick={() => openEditUser(u)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700"
                      disabled={u._source === 'hardcoded'}
                      onClick={() => deleteUser(u)}>Hapus</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {users.length === 0 && <p className="text-sm text-slate-500 col-span-full text-center py-8">Belum ada data user. Tambahkan user baru.</p>}
          </div>
        </div>
      )}

      {/* UNITS TAB */}
      {tab === 'units' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateUnit}><Building2 className="h-4 w-4 mr-2" /> Tambah Unit</Button>
          </div>
          {Object.entries(groupedUnits).map(([parent, children]) => (
            <div key={parent} className="space-y-2">
              {parent !== 'ROOT' && (
                <h3 className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md">
                  {shortUnit(parent)}
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {children.map((u) => (
                  <Card key={u.id} className={`${u.is_kasubbid ? 'border-2 border-blue-500 bg-blue-50/40' : ''} ${!u.active ? 'opacity-50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-xs leading-snug">{u.name}</CardTitle>
                        {u.is_kasubbid && <Badge className="bg-blue-800 text-white text-[10px]">INDUK</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 flex items-center justify-between">
                      <Badge className={u.active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}>
                        {u.active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleUnitActive(u)}>{u.active ? 'Nonaktifkan' : 'Aktifkan'}</Button>
                        <Button size="sm" variant="ghost" onClick={() => openEditUnit(u)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => deleteUnit(u)}>Hapus</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
          {units.length === 0 && <p className="text-sm text-slate-500 text-center py-8">Belum ada data unit.</p>}
        </div>
      )}

      {/* USER DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit User' : 'Tambah User'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Username</Label><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="username" disabled={!!editing} /></div>
            <div><Label>Password {editing && <span className="text-xs text-slate-400">(kosongkan jika tidak diubah)</span>}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editing ? '••••••••' : 'password'} /></div>
            <div><Label>Nama Lengkap</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@propam.polri.go.id" /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['superadmin', 'kabid', 'kasubbag', 'kasubbid', 'admin', 'unit', 'polres'].map((r) => (
                    <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Unit (opsional)</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Nama unit" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={saveUser} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UNIT DIALOG */}
      <Dialog open={unitDialog} onOpenChange={setUnitDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{unitEditing ? 'Edit Unit' : 'Tambah Unit'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Unit</Label><Input value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} placeholder="mis. UNIT 4 SUBBID PAMINAL POLDA JAWA BARAT" /></div>
            <div>
              <Label>Parent Unit</Label>
              <Select value={unitForm.parent} onValueChange={(v) => setUnitForm({ ...unitForm, parent: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BID PROPAM POLDA JABAR">BID PROPAM POLDA JABAR</SelectItem>
                  {units.filter((u) => u.is_kasubbid).map((u) => (
                    <SelectItem key={u.id} value={u.name}>{shortUnit(u.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Urutan</Label><Input type="number" value={unitForm.order} onChange={(e) => setUnitForm({ ...unitForm, order: parseInt(e.target.value || '99', 10) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUnitDialog(false)}>Batal</Button>
            <Button onClick={saveUnit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  // ASTINA fields
  const [asEmail, setAsEmail] = useState('')
  const [asPass, setAsPass] = useState('')
  const [zimEmail, setZimEmail] = useState('')
  const [zimPass, setZimPass] = useState('')
  // AI field
  const [aiKey, setAiKey] = useState('')

  const toggleShow = (k) => setShowPass((p) => ({ ...p, [k]: !p[k] }))
  const PassInput = ({ value, onChange, placeholder, field }) => (
    <div className="flex items-center gap-1">
      <Input type={showPass[field] ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} className="h-9 text-sm flex-1" />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleShow(field) }}
        className="shrink-0 p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
        {showPass[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )

  useEffect(() => {
    api('/settings').then((r) => {
      setSaved(r)
      if (r.gajamada?.email_set) setGjEmail(r.gajamada.email || '')
      if (r.astina?.email_set) setAsEmail(r.astina.email || '')
      if (r.zimbra?.email_set) setZimEmail(r.zimbra.email || '')
    }).catch(() => {}).finally(() => setLoading(false))
    api('/settings/ai').then((r) => {
      if (r.opencode_api_key) setAiKey(r.opencode_api_key)
    }).catch(() => {})
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-blue-800" /></div>

  const Dot = ({ ok }) => (
    <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'} ${ok ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
  )

  const saveService = async (service) => {
    setSaving((p) => ({ ...p, [service]: true }))
    const body = {}
    if (service === 'gajamada') { body.gajamada_email = gjEmail; body.gajamada_password = gjPass }
    if (service === 'astina') {
      body.astina_email = asEmail; body.astina_password = asPass
      body.zimbra_email = zimEmail; body.zimbra_password = zimPass
    }
    try {
      await api('/user/credentials', { method: 'POST', body: JSON.stringify(body) })
      toast.success('Kredensial ' + (service === 'gajamada' ? 'Gajamada' : 'ASTINA/Zimbra') + ' disimpan')
    } catch (e) {
      toast.error('Gagal menyimpan: ' + (e.message || 'error'))
    } finally {
      setSaving((p) => ({ ...p, [service]: false }))
    }
  }

  const testLogin = async (service) => {
    setTesting((p) => ({ ...p, [service]: true }))
    const endpoint = service === 'gajamada' ? '/user/test-gajamada' : '/user/test-astina'
    const body = service === 'gajamada'
      ? { email: gjEmail, password: gjPass }
      : { email: asEmail, password: asPass }
    try {
      const r = await api(endpoint, { method: 'POST', body: JSON.stringify(body) })
      if (r.ok) toast.success('Login ' + (service === 'gajamada' ? 'Gajamada' : 'ASTINA') + ' berhasil')
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
      <p className="text-sm text-slate-500 -mt-2">Setiap user memiliki kredensial Gajamada dan ASTINA sendiri. Masukkan kredensial akun Anda.</p>

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

      {/* ASTINA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Dot ok={connStatus.astina} />
            <span>ASTINA (e-Office Polri)</span>
            <Badge variant="outline" className={`text-[10px] ml-auto ${connStatus.astina ? 'text-green-700 border-green-300' : saved?.astina?.email_set ? 'text-green-700 border-green-300' : 'text-red-700 border-red-300'}`}>
              {connStatus.astina ? 'Session aktif' : saved?.astina?.email_set ? 'Kredensial tersimpan' : 'Belum login'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email ASTINA</Label>
              <Input value={asEmail} onChange={(e) => setAsEmail(e.target.value)} placeholder="email@polri" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Password ASTINA</Label>
              <PassInput value={asPass} onChange={(e) => setAsPass(e.target.value)} placeholder="••••••••" field="as" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email Zimbra (OTP)</Label>
              <Input value={zimEmail} onChange={(e) => setZimEmail(e.target.value)} placeholder="email@polri.go.id" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Password Zimbra</Label>
              <PassInput value={zimPass} onChange={(e) => setZimPass(e.target.value)} placeholder="••••••••" field="zim" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => testLogin('astina')} disabled={testing.astina || !asEmail || !asPass}>
              {testing.astina ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Test Login (Step 1)
            </Button>
            <Button size="sm" onClick={() => saveService('astina')} disabled={saving.astina || !asEmail || !asPass}>
              {saving.astina ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null} Simpan
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
  const [caseFilter, setCaseFilter] = useState(null)
  const isKasubbid = ['superadmin', 'kabid', 'kasubbag', 'kasubbid', 'admin'].includes(user.role)
  const isSuperadmin = user.role === 'superadmin'
  const isYanduan = user.role === 'yanduan'
  const [disposisiCount, setDisposisiCount] = useState(0)
  const notifiedRef = useRef(false)
  const [connStatus, setConnStatus] = useState({ astina: false, gajamada: false, ai: false })

  const handleNavigate = (targetTab, filter) => {
    setCaseFilter(filter || null)
    setTab(targetTab || 'cases')
  }

  const refreshDisposisiCount = async () => {
    if (!isKasubbid && !isYanduan) return
    try { const r = await api('/disposisi-queue/count'); setDisposisiCount(r.count || 0) } catch (_) { /* ignore */ }
  }
  const refreshConnStatus = async () => {
    try {
      const r = await api('/connection-status')
      setConnStatus({ astina: !!r.astina?.connected, gajamada: !!r.gajamada?.connected, ai: !!r.ai?.connected })
    } catch (_) { /* ignore */ }
  }
  useEffect(() => {
    refreshConnStatus()
    const interval = setInterval(refreshConnStatus, 60000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line
  useEffect(() => {
    if (!isKasubbid && !isYanduan) return
    refreshDisposisiCount()
    const interval = setInterval(refreshDisposisiCount, 30000)
    return () => clearInterval(interval)
  }, [isKasubbid, isYanduan]) // eslint-disable-line
  useEffect(() => {
    if ((isKasubbid || isYanduan) && disposisiCount > 0 && !notifiedRef.current) {
      notifiedRef.current = true
      toast.info(`Ada ${disposisiCount} pengaduan belum didisposisi ke unit`, {
        action: { label: 'Lihat', onClick: () => setTab('disposisi') },
      })
    }
  }, [disposisiCount]) // eslint-disable-line

  const menu = isYanduan ? [
    { id: 'dashboard', label: 'Dashboard ANEV', icon: LayoutDashboard },
    { id: 'cases', label: 'Daftar Surat', icon: FolderKanban },
    { id: 'disposisi', label: 'Disposisi (ke Kabid)', icon: ArrowRightLeft, badge: disposisiCount },
    { id: 'input-manual', label: 'Input Manual', icon: FileText },
    { id: 'sync', label: 'Log Sync', icon: Send },
    { id: 'audit', label: 'Audit Log', icon: History },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ] : [
    { id: 'dashboard', label: 'Dashboard ANEV', icon: LayoutDashboard },
    { id: 'cases', label: 'Daftar Surat', icon: FolderKanban },
    ...(isKasubbid ? [{ id: 'disposisi', label: 'Disposisi', icon: ArrowRightLeft, badge: disposisiCount }] : []),
    ...(isKasubbid ? [{ id: 'units', label: 'Master Unit', icon: Building2 }] : []),
    ...(isKasubbid ? [{ id: 'satker', label: 'Satker/Satwil', icon: MapPin }] : []),
    ...(isSuperadmin ? [{ id: 'accounts', label: 'Pengaturan Akun', icon: Shield }] : []),
    { id: 'sync', label: 'Log Sync', icon: Send },
    { id: 'audit', label: 'Audit Log', icon: History },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
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
            <div className="flex items-center gap-1.5" data-testid="status-astina">
              <span className={`h-2 w-2 rounded-full ${connStatus.astina ? 'bg-green-400' : 'bg-red-400'} ${connStatus.astina ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
              <span className="text-[10px] text-blue-200">ASTINA</span>
            </div>
            <div className="flex items-center gap-1.5" data-testid="status-gajamada">
              <span className={`h-2 w-2 rounded-full ${connStatus.gajamada ? 'bg-green-400' : 'bg-red-400'} ${connStatus.gajamada ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
              <span className="text-[10px] text-blue-200">GAJAMADA</span>
            </div>
            <div className="flex items-center gap-1.5" data-testid="status-ai">
              <span className={`h-2 w-2 rounded-full ${connStatus.ai ? 'bg-green-400' : 'bg-red-400'} ${connStatus.ai ? 'shadow-[0_0_6px_rgba(74,222,128,0.6)]' : 'shadow-[0_0_6px_rgba(248,113,113,0.6)]'}`} />
              <span className="text-[10px] text-blue-200">AI</span>
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
          {tab === 'dashboard' && <Dashboard user={user} onNavigate={handleNavigate} />}
          {tab === 'cases' && <CasesList user={user} onOpenCase={setSelectedCase} initialFilter={caseFilter} />}
          {tab === 'disposisi' && (isKasubbid || isYanduan) && <DisposisiPage user={user} onOpenCase={setSelectedCase} onGoMasterUnit={() => setTab('units')} onQueueChange={refreshDisposisiCount} />}
          {tab === 'units' && isKasubbid && <MasterUnitPage user={user} />}
          {tab === 'satker' && isKasubbid && <SatkerSatwilPage user={user} />}
          {tab === 'input-manual' && isYanduan && <CasesList user={user} onOpenCase={setSelectedCase} />}
          {tab === 'accounts' && isSuperadmin && <AccountManagementPage />}
          {tab === 'sync' && <SyncLogsView />}
          {tab === 'audit' && <AuditView />}
          {tab === 'settings' && <SettingsPage connStatus={connStatus} />}
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
