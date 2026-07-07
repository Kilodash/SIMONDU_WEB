import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.APP_JWT_SECRET || 'dev-secret-change-me')
const COOKIE_NAME = 'simondu_session'

// Hardcoded MVP users - Bid Propam Polda Jabar hierarchy
export const USERS = [
  // ---- SUPER ADMIN ----
  { username: 'superadmin', password: 'superadmin123', name: 'Super Admin Bid Propam', role: 'superadmin', unit: null, email: 'xxx@propam.polri.go.id' },

  // ---- YANDUAN (Penerima Pengaduan) ----
  { username: 'yanduan', password: 'yanduan123', name: 'Petugas Yanduan Bid Propam', role: 'yanduan', unit: null, email: 'yanduan@propam.polri.go.id' },

  // ---- KABID PROPAM ----
  { username: 'kabid', password: 'kabid123', name: 'Kabid Propam Polda Jabar', role: 'kabid', unit: null, email: 'kabid@propam.polri.go.id' },

  // ---- KASUBBAG RENMIN ----
  { username: 'kasubbag', password: 'kasubbag123', name: 'Kasubbag Renmin Bid Propam', role: 'kasubbag', unit: 'SUBBAG RENMIN BID PROPAM POLDA JABAR', email: 'kasubbag@propam.polri.go.id' },

  // ---- SUBBID PAMINAL (existing) ----
  { username: 'kasubbid', password: 'kasubbid123', name: 'Kasubbid Paminal Polda Jabar', role: 'kasubbid', unit: null, email: 'kasubbid_paminal@propam.polri.go.id' },
  { username: 'admin', password: 'admin123', name: 'Admin/Operator Subbid Paminal', role: 'admin', unit: null, email: 'admin_paminal@propam.polri.go.id' },
  { username: 'unit1', password: 'unit123', name: 'Kanit 1 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 1 SUBBID PAMINAL POLDA JAWA BARAT', email: 'unit1_paminal@propam.polri.go.id' },
  { username: 'unit2', password: 'unit123', name: 'Kanit 2 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 2 SUBBID PAMINAL POLDA JAWA BARAT', email: 'unit2_paminal@propam.polri.go.id' },
  { username: 'unit3', password: 'unit123', name: 'Kanit 3 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 3 SUBBID PAMINAL POLDA JAWA BARAT', email: 'unit3_paminal@propam.polri.go.id' },
  { username: 'urbinpam', password: 'unit123', name: 'Ur Binpam Paminal Polda Jabar', role: 'unit', unit: 'UR BINPAM SUBBID PAMINAL POLDA JAWA BARAT', email: 'urbinpam@propam.polri.go.id' },
  { username: 'urlitpers', password: 'unit123', name: 'Ur Litpers Paminal Polda Jabar', role: 'unit', unit: 'UR LITPERS SUBBID PAMINAL POLDA JAWA BARAT', email: 'urlitpers@propam.polri.go.id' },
  { username: 'urprodok', password: 'unit123', name: 'Ur Prodok Paminal Polda Jabar', role: 'unit', unit: 'UR PRODOK SUBBID PAMINAL POLDA JAWA BARAT', email: 'urprodok@propam.polri.go.id' },

  // ---- SUBBID PROVOS ----
  { username: 'kasubbid_provos', password: 'kasubbid123', name: 'Kasubbid Provos Polda Jabar', role: 'kasubbid', unit: 'SUBBID PROVOS BID PROPAM POLDA JABAR', email: 'kasubbid_provos@propam.polri.go.id' },
  { username: 'provos_unit1', password: 'unit123', name: 'Kanit 1 Provos Polda Jabar', role: 'unit', unit: 'UNIT 1 SUBBID PROVOS BID PROPAM POLDA JABAR', email: 'unit1_provos@propam.polri.go.id' },
  { username: 'provos_unit2', password: 'unit123', name: 'Kanit 2 Provos Polda Jabar', role: 'unit', unit: 'UNIT 2 SUBBID PROVOS BID PROPAM POLDA JABAR', email: 'unit2_provos@propam.polri.go.id' },

  // ---- SUBBID WABPROF ----
  { username: 'kasubbid_wabprof', password: 'kasubbid123', name: 'Kasubbid Wabprof Polda Jabar', role: 'kasubbid', unit: 'SUBBID WABPROF BID PROPAM POLDA JABAR', email: 'kasubbid_wabprof@propam.polri.go.id' },
  { username: 'wabprof_unit1', password: 'unit123', name: 'Kanit 1 Wabprof Polda Jabar', role: 'unit', unit: 'UNIT 1 SUBBID WABPROF BID PROPAM POLDA JABAR', email: 'unit1_wabprof@propam.polri.go.id' },
  { username: 'wabprof_unit2', password: 'unit123', name: 'Kanit 2 Wabprof Polda Jabar', role: 'unit', unit: 'UNIT 2 SUBBID WABPROF BID PROPAM POLDA JABAR', email: 'unit2_wabprof@propam.polri.go.id' },

  // ---- SUBBAG RENMIN UNITS ----
  { username: 'urrenmin', password: 'unit123', name: 'Ur Renmin Bid Propam', role: 'unit', unit: 'UR RENMIN SUBBAG RENMIN BID PROPAM POLDA JABAR', email: 'urrenmin@propam.polri.go.id' },
  { username: 'urkeu', password: 'unit123', name: 'Ur Keu Bid Propam', role: 'unit', unit: 'UR KEU SUBBAG RENMIN BID PROPAM POLDA JABAR', email: 'urkeu@propam.polri.go.id' },

  // ---- POLRES JAJARAN POLDA JABAR ----
  { username: 'polrestabes_bdg', password: 'polres123', name: 'Kapolrestabes Bandung', role: 'polres', unit: 'POLRESTABES BANDUNG', email: 'polrestabes_bdg@propam.polri.go.id' },
  { username: 'polres_bdg', password: 'polres123', name: 'Kapolres Bandung', role: 'polres', unit: 'POLRES BANDUNG', email: 'polres_bdg@propam.polri.go.id' },
  { username: 'polres_bb', password: 'polres123', name: 'Kapolres Bandung Barat', role: 'polres', unit: 'POLRES BANDUNG BARAT', email: 'polres_bb@propam.polri.go.id' },
  { username: 'polres_bgr', password: 'polres123', name: 'Kapolres Bogor', role: 'polres', unit: 'POLRES BOGOR', email: 'polres_bgr@propam.polri.go.id' },
  { username: 'polres_skb', password: 'polres123', name: 'Kapolres Sukabumi', role: 'polres', unit: 'POLRES SUKABUMI', email: 'polres_skb@propam.polri.go.id' },
  { username: 'polres_cjr', password: 'polres123', name: 'Kapolres Cianjur', role: 'polres', unit: 'POLRES CIANJUR', email: 'polres_cjr@propam.polri.go.id' },
  { username: 'polres_pwk', password: 'polres123', name: 'Kapolres Purwakarta', role: 'polres', unit: 'POLRES PURWAKARTA', email: 'polres_pwk@propam.polri.go.id' },
  { username: 'polres_krw', password: 'polres123', name: 'Kapolres Karawang', role: 'polres', unit: 'POLRES KARAWANG', email: 'polres_krw@propam.polri.go.id' },
  { username: 'polres_bks', password: 'polres123', name: 'Kapolres Bekasi', role: 'polres', unit: 'POLRES BEKASI', email: 'polres_bks@propam.polri.go.id' },
  { username: 'polres_sbg', password: 'polres123', name: 'Kapolres Subang', role: 'polres', unit: 'POLRES SUBANG', email: 'polres_sbg@propam.polri.go.id' },
  { username: 'polres_smd', password: 'polres123', name: 'Kapolres Sumedang', role: 'polres', unit: 'POLRES SUMEDANG', email: 'polres_smd@propam.polri.go.id' },
  { username: 'polres_mjl', password: 'polres123', name: 'Kapolres Majalengka', role: 'polres', unit: 'POLRES MAJALENGKA', email: 'polres_mjl@propam.polri.go.id' },
  { username: 'polres_idm', password: 'polres123', name: 'Kapolres Indramayu', role: 'polres', unit: 'POLRES INDRAMAYU', email: 'polres_idm@propam.polri.go.id' },
  { username: 'polres_crb', password: 'polres123', name: 'Kapolres Cirebon', role: 'polres', unit: 'POLRES CIREBON', email: 'polres_crb@propam.polri.go.id' },
  { username: 'polresta_crb', password: 'polres123', name: 'Kapolresta Cirebon', role: 'polres', unit: 'POLRESTA CIREBON', email: 'polresta_crb@propam.polri.go.id' },
  { username: 'polres_kng', password: 'polres123', name: 'Kapolres Kuningan', role: 'polres', unit: 'POLRES KUNINGAN', email: 'polres_kng@propam.polri.go.id' },
  { username: 'polres_cms', password: 'polres123', name: 'Kapolres Ciamis', role: 'polres', unit: 'POLRES CIAMIS', email: 'polres_cms@propam.polri.go.id' },
  { username: 'polres_tsm', password: 'polres123', name: 'Kapolres Tasikmalaya', role: 'polres', unit: 'POLRES TASIKMALAYA', email: 'polres_tsm@propam.polri.go.id' },
  { username: 'polresta_tsm', password: 'polres123', name: 'Kapolresta Tasikmalaya', role: 'polres', unit: 'POLRESTA TASIKMALAYA', email: 'polresta_tsm@propam.polri.go.id' },
  { username: 'polres_grt', password: 'polres123', name: 'Kapolres Garut', role: 'polres', unit: 'POLRES GARUT', email: 'polres_grt@propam.polri.go.id' },
  { username: 'polres_bjr', password: 'polres123', name: 'Kapolres Banjar', role: 'polres', unit: 'POLRES BANJAR', email: 'polres_bjr@propam.polri.go.id' },
  { username: 'polres_cmh', password: 'polres123', name: 'Kapolres Cimahi', role: 'polres', unit: 'POLRES CIMAHI', email: 'polres_cmh@propam.polri.go.id' },
  { username: 'polresta_bdg', password: 'polres123', name: 'Kapolresta Bandung', role: 'polres', unit: 'POLRESTA BANDUNG', email: 'polresta_bdg@propam.polri.go.id' },
]

export async function signSession(user) {
  const jwt = await new SignJWT({ username: user.username, role: user.role, unit: user.unit, name: user.name, email: user.email || null })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(SECRET)
  return jwt
}
export async function verifySession(token) {
  try { const { payload } = await jwtVerify(token, SECRET); return payload } catch { return null }
}
export function getCookieHeader(token, maxAgeSec = 7 * 24 * 3600) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`
}
export function clearCookieHeader() { return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` }
export function parseCookies(request) {
  const header = request.headers.get('cookie') || ''
  const out = {}
  header.split(';').forEach((p) => { const [k, ...rest] = p.trim().split('='); if (k) out[k] = rest.join('=') })
  return out
}
export async function getUserFromRequest(request) {
  const cookies = parseCookies(request)
  const token = cookies[COOKIE_NAME]
  if (!token) return null
  return await verifySession(token)
}
export function authenticate(username, password) {
  return USERS.find((u) => u.username === username && u.password === password) || null
}
