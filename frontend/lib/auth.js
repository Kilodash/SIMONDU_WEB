import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.APP_JWT_SECRET || 'dev-secret-change-me')
const COOKIE_NAME = 'simondu_session'

export const USERS = [
  { username: 'kasubbid', password: 'kasubbid123', name: 'KASUBBID PAMINAL POLDA JAWA BARAT', role: 'kasubbid_paminal', unit: null },
  { username: 'kasubbid_paminal', password: 'paminal123', name: 'KASUBBID PAMINAL POLDA JAWA BARAT', role: 'kasubbid_paminal', unit: null },
  { username: 'kasubbid_provos', password: 'provos123', name: 'KASUBBID PROVOS POLDA JAWA BARAT', role: 'kasubbid_provos', unit: null },
  { username: 'kasubbid_wabprof', password: 'wabprof123', name: 'KASUBBID WABPROF POLDA JAWA BARAT', role: 'kasubbid_wabprof', unit: null },
  { username: 'kabid_propam', password: 'kabid123', name: 'KABID PROPAM POLDA JAWA BARAT', role: 'kabid_propam', unit: null },
  { username: 'kasubbag_yanduan', password: 'yanduan123', name: 'KASUBBAG YANDUAN POLDA JAWA BARAT', role: 'kasubbag_yanduan', unit: null },
  { username: 'kasubbag_rehabpers', password: 'rehabpers123', name: 'KASUBBAG REHABPERS POLDA JAWA BARAT', role: 'kasubbag_rehabpers', unit: null },
  { username: 'admin', password: 'admin123', name: 'Admin/Operator Propam', role: 'admin', unit: null },
  { username: 'super_admin', password: 'superadmin123', name: 'Super Admin', role: 'super_admin', unit: null },
  { username: 'unit1', password: 'unit123', name: 'Kanit 1 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 1 SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'unit2', password: 'unit123', name: 'Kanit 2 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 2 SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'unit3', password: 'unit123', name: 'Kanit 3 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 3 SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'urbinpam', password: 'unit123', name: 'Ur Binpam Paminal Polda Jabar', role: 'unit', unit: 'UR BINPAM SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'urlitpers', password: 'unit123', name: 'Ur Litpers Paminal Polda Jabar', role: 'unit', unit: 'UR LITPERS SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'urprodok', password: 'unit123', name: 'Ur Prodok Paminal Polda Jabar', role: 'unit', unit: 'UR PRODOK SUBBID PAMINAL POLDA JAWA BARAT' },
]

export function isDisposisiRole(role) {
  return role === 'kasubbid_paminal' || role === 'kasubbid_provos' || role === 'kasubbid_wabprof'
    || role === 'admin' || role === 'super_admin' || role === 'kabid_propam' || role === 'kasubbag_yanduan'
}

export function isAdminRole(role) {
  return role === 'admin' || role === 'super_admin'
}

export function isKasubbidRole(role) {
  return role === 'kasubbid_paminal' || role === 'kasubbid_provos' || role === 'kasubbid_wabprof'
}

export function isUnitRole(role) {
  return role === 'unit'
}

export async function signSession(user) {
  const jwt = await new SignJWT({ username: user.username, role: user.role, unit: user.unit, name: user.name })
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
  const user = [..._dbUsers, ...USERS].find((u) => u.username === username && u.password === password)
  if (user) {
    const { password: _, ...safe } = user
    return safe
  }
  return null
}

// -------- DB-backed user cache --------
let _dbUsers = []
export function setDbUsers(users) { _dbUsers = users || [] }

// Return merged users (DB first, deduped by username) without passwords
export function getAllUsers() {
  const seen = new Set()
  const merged = []
  for (const u of [..._dbUsers, ...USERS]) {
    if (seen.has(u.username)) continue
    seen.add(u.username)
    const { password: _, ...safe } = u
    merged.push(safe)
  }
  return merged
}
