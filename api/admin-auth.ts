import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { constantTimeEqual, setSessionCookie } from '../lib/server-auth.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { jsonObjectBody, InvalidInputError } from '../lib/input.js'

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'روش درخواست پشتیبانی نمی‌شود.' })

  const adminPassword = process.env.ADMIN_PASSWORD || ''
  const sessionSecret = process.env.SESSION_SECRET || ''
  if (!adminPassword || !sessionSecret) {
    return res.status(503).json({
      ok: false,
      message: 'ورود امن تنظیم نشده است؛ ADMIN_PASSWORD و SESSION_SECRET را در متغیرهای محیطی Production سرور تعریف کنید.',
    })
  }
  if (!(await enforceRateLimit(req, res, 'admin-login', 5, 15 * 60))) return

  try {
    const body = jsonObjectBody(req)
    const entered = body.password
    if (typeof entered !== 'string' || !entered || entered.length > 512 || !constantTimeEqual(entered, adminPassword)) {
      return res.status(401).json({ ok: false, message: 'رمز عبور وارد شده نادرست است.' })
    }

    setSessionCookie(res, { role: 'admin' })
    return res.status(200).json({ ok: true, message: 'ورود موفقیت‌آمیز بود.' })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ ok: false, message: 'درخواست ورود معتبر نیست.' })
    console.error('Admin authentication session creation failed:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ ok: false, message: 'ایجاد نشست امن مدیر ممکن نشد؛ تنظیمات سرور را بررسی کنید.' })
  }
}
