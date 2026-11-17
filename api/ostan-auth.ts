import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { setSessionCookie, verifyPassword, validUsername } from '../lib/server-auth.js'
import { normalizeAllowedSections } from '../src/province-access.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { InvalidInputError, jsonObjectBody, textField } from '../lib/input.js'

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'روش درخواست پشتیبانی نمی‌شود.' })
  if (!process.env.SESSION_SECRET) {
    return res.status(503).json({ ok: false, message: 'تنظیم ورود امن روی سرور کامل نشده است.' })
  }
  if (!(await enforceRateLimit(req, res, 'province-login', 8, 15 * 60))) return

  const sql = getDb()
  if (!sql || !(await initDbIfNeeded())) return res.status(503).json({ ok: false, message: 'پایگاه داده مشترک استان‌ها متصل نیست.' })

  try {
    const body = jsonObjectBody(req)
    const username = textField(body, 'username', 40, true).toLowerCase()
    const password = body.password
    if (!validUsername(username) || typeof password !== 'string' || !password || password.length > 512) {
      return res.status(401).json({ ok: false, message: 'نام کاربری یا رمز عبور نادرست است.' })
    }

    const rows = await sql`
      SELECT province_id, province_name, username, password_hash, active, allowed_sections
      FROM province_accounts
      WHERE lower(username) = ${username}
      LIMIT 1;
    `
    const account = rows[0]
    if (!account || !account.active || !(await verifyPassword(password, String(account.password_hash)))) {
      return res.status(401).json({ ok: false, message: 'نام کاربری یا رمز عبور نادرست است.' })
    }

    setSessionCookie(res, {
      role: 'ostan',
      provinceId: String(account.province_id),
      provinceName: String(account.province_name),
    })
    return res.status(200).json({
      ok: true,
      province: { id: account.province_id, name: account.province_name, username: account.username, allowedSections: normalizeAllowedSections(account.allowed_sections) },
    })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ ok: false, message: 'درخواست ورود معتبر نیست.' })
    console.error('Provincial login failed:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ ok: false, message: 'خطا در بررسی حساب استان.' })
  }
}
