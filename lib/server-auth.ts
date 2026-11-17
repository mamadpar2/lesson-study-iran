import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { VercelRequest, VercelResponse } from './vercel-types.js'

const scrypt = promisify(scryptCallback)
const COOKIE_NAME = 'dars_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12

export interface ServerSession {
  role: 'admin' | 'ostan'
  provinceId?: string
  provinceName?: string
  exp: number
}

function sessionSecret() {
  return process.env.SESSION_SECRET || ''
}

function sign(value: string) {
  const secret = sessionSecret()
  if (!secret) throw new Error('SESSION_SECRET is not configured')
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function setSessionCookie(res: VercelResponse, payload: Omit<ServerSession, 'exp'>) {
  const session: ServerSession = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }
  const encoded = Buffer.from(JSON.stringify(session)).toString('base64url')
  const token = `${encoded}.${sign(encoded)}`
  const secure = (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`)
}

export function clearSessionCookie(res: VercelResponse) {
  const secure = (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`)
}

export function getSession(req: VercelRequest): ServerSession | null {
  const rawCookie = req.headers.cookie || ''
  const token = rawCookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  if (!token || !sessionSecret()) return null
  const [encoded, supplied] = token.split('.')
  if (!encoded || !supplied) return null
  try {
    const expected = sign(encoded)
    const a = Buffer.from(supplied)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const session = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ServerSession
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null
    if (session.role !== 'admin' && session.role !== 'ostan') return null
    if (session.role === 'ostan' && (!session.provinceId || !session.provinceName)) return null
    return session
  } catch {
    return null
  }
}

export function constantTimeEqual(a: string, b: string) {
  const aa = Buffer.from(a)
  const bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  try {
    const derived = (await scrypt(password, salt, 64)) as Buffer
    return constantTimeEqual(derived.toString('hex'), hash)
  } catch {
    return false
  }
}

export function validUsername(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9._-]{3,40}$/.test(value)
}
