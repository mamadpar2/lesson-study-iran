import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { clearSessionCookie, getSession } from '../lib/server-auth.js'
import { normalizeAllowedSections } from '../src/province-access.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Cookie')
  if (req.method === 'POST') {
    clearSessionCookie(res)
    return res.status(200).json({ ok: true })
  }
  if (req.method !== 'GET') return res.status(405).json({ ok: false })
  const session = getSession(req)
  if (!session) return res.status(401).json({ ok: false })
  if (session.role === 'admin') return res.status(200).json({ ok: true, role: 'admin' })

  const sql = getDb()
  if (!sql) return res.status(503).json({ ok: false, error: 'پایگاه داده مشترک استان‌ها متصل نیست.' })
  try {
    await initDbIfNeeded()
    const rows = await sql`SELECT province_name, active, allowed_sections FROM province_accounts WHERE province_id = ${session.provinceId} LIMIT 1;`
    const account = rows[0]
    if (!account || !account.active) {
      clearSessionCookie(res)
      return res.status(401).json({ ok: false })
    }
    return res.status(200).json({
      ok: true,
      role: 'ostan',
      province: {
        id: session.provinceId,
        name: String(account.province_name),
        allowedSections: normalizeAllowedSections(account.allowed_sections),
      },
    })
  } catch (error) {
    console.error('Session lookup failed:', error)
    return res.status(503).json({ ok: false, error: 'بررسی نشست استان ممکن نشد.' })
  }
}
