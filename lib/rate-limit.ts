import { createHmac } from 'node:crypto'
import type { VercelRequest, VercelResponse } from './vercel-types.js'
import { getDb, initDbIfNeeded } from './db.js'

let lastCleanupAt = 0

function getClientAddress(req: VercelRequest) {
  const forwarded = req.headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  // Vercel supplies the client address in this platform header. If it is absent,
  // fail closed into one shared bucket instead of treating the request as unique.
  return typeof value === 'string' && value.trim()
    ? value.split(',')[0].trim().slice(0, 100)
    : 'unknown-client'
}

/** Persistent, privacy-preserving rate limit shared by serverless instances. */
export async function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  scope: string,
  maximum: number,
  windowSeconds: number,
): Promise<boolean> {
  const sql = getDb()
  const secret = process.env.SESSION_SECRET
  if (!sql || !secret || !(await initDbIfNeeded())) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: 'کنترل امنیتی درخواست در دسترس نیست؛ تنظیم پایگاه داده و SESSION_SECRET را بررسی کنید.' })
    return false
  }

  try {
    const now = Date.now()
    const bucket = Math.floor(now / (windowSeconds * 1000))
    const address = getClientAddress(req)
    const subjectHash = createHmac('sha256', secret)
      .update(`${scope}\0${address}`)
      .digest('hex')

    const rows = await sql`
      INSERT INTO api_rate_limits (scope, subject_hash, window_start, hit_count, expires_at)
      VALUES (${scope}, ${subjectHash}, ${bucket}, 1, NOW() + (${windowSeconds * 2} * INTERVAL '1 second'))
      ON CONFLICT (scope, subject_hash, window_start)
      DO UPDATE SET hit_count = api_rate_limits.hit_count + 1
      WHERE api_rate_limits.hit_count < ${maximum}
      RETURNING hit_count;
    `

    if (!rows.length) {
      const retryAfter = Math.max(1, windowSeconds - Math.floor((now % (windowSeconds * 1000)) / 1000))
      res.setHeader('Retry-After', String(retryAfter))
      res.setHeader('Cache-Control', 'no-store')
      res.status(429).json({ error: 'تعداد درخواست‌ها از حد مجاز گذشت؛ کمی بعد دوباره تلاش کنید.' })
      return false
    }

    if (now - lastCleanupAt > 5 * 60 * 1000) {
      lastCleanupAt = now
      try {
        await sql`DELETE FROM api_rate_limits WHERE expires_at < NOW();`
      } catch {
        // Cleanup is best-effort; the rate-limit upsert above is the security gate.
      }
    }
    return true
  } catch (error) {
    console.error('Rate-limit enforcement failed:', error instanceof Error ? error.message : 'unknown error')
    res.setHeader('Cache-Control', 'no-store')
    res.status(503).json({ error: 'کنترل امنیتی درخواست انجام نشد؛ دوباره تلاش کنید.' })
    return false
  }
}
