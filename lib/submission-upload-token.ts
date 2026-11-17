import { createHmac, timingSafeEqual } from 'node:crypto'

// Bearer claim proves the private upload was created by this server recently.
export function issueSubmissionUploadToken(pathname: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is required')
  const payload = Buffer.from(JSON.stringify({ pathname, expires: Date.now() + 60 * 60 * 1000 })).toString('base64url')
  const signature = createHmac('sha256', secret).update(`experience-upload\0${payload}`).digest('base64url')
  return `${payload}.${signature}`
}
export function verifySubmissionUploadToken(token: string): string | null {
  const secret = process.env.SESSION_SECRET
  if (!secret || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const expected = createHmac('sha256', secret).update(`experience-upload\0${parts[0]}`).digest()
  let provided: Buffer
  try { provided = Buffer.from(parts[1], 'base64url') } catch { return null }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null
  try {
    const obj = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    if (typeof obj.pathname !== 'string' || !/^submissions\/[A-Za-z0-9_-]+\.(pdf|docx)$/.test(obj.pathname) || typeof obj.expires !== 'number' || obj.expires < Date.now()) return null
    return obj.pathname
  } catch { return null }
}
