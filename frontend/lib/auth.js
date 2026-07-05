import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.APP_JWT_SECRET || 'dev-secret-change-me')
const COOKIE_NAME = 'simondu_session'

// Hardcoded MVP users - one per unit in the Paminal hierarchy
export const USERS = [
  { username: 'kasubbid', password: 'kasubbid123', name: 'Kasubbid Paminal Polda Jabar', role: 'kasubbid', unit: null },
  { username: 'admin', password: 'admin123', name: 'Admin/Operator Subbid Paminal', role: 'admin', unit: null },
  { username: 'unit1', password: 'unit123', name: 'Kanit 1 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 1 SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'unit2', password: 'unit123', name: 'Kanit 2 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 2 SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'unit3', password: 'unit123', name: 'Kanit 3 Paminal Polda Jabar', role: 'unit', unit: 'UNIT 3 SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'urbinpam', password: 'unit123', name: 'Ur Binpam Paminal Polda Jabar', role: 'unit', unit: 'UR BINPAM SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'urlitpers', password: 'unit123', name: 'Ur Litpers Paminal Polda Jabar', role: 'unit', unit: 'UR LITPERS SUBBID PAMINAL POLDA JAWA BARAT' },
  { username: 'urprodok', password: 'unit123', name: 'Ur Prodok Paminal Polda Jabar', role: 'unit', unit: 'UR PRODOK SUBBID PAMINAL POLDA JAWA BARAT' },
]

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
  return USERS.find((u) => u.username === username && u.password === password) || null
}
