import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { getSession, hashPassword, validUsername } from '../lib/server-auth.js'
import { normalizeAllowedSections, validateAllowedSections } from '../src/province-access.js'
import { PROVINCE_UNITS } from '../src/provinces.js'
import { InvalidInputError, jsonObjectBody } from '../lib/input.js'

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }

function requireAdmin(req: VercelRequest, res: VercelResponse) {
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    res.status(401).json({ error: 'برای مدیریت حساب‌ها، ابتدا با حساب مدیر وارد شوید.' })
    return false
  }
  return true
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Cookie')
  if (!requireAdmin(req, res)) return
  const sql = getDb()
  if (!sql) return res.status(503).json({ error: 'پایگاه داده مشترک متصل نیست؛ حساب‌ها در سرور ذخیره نمی‌شوند.' })

  try {
    await initDbIfNeeded()
    if (req.method === 'GET') {
      const rows = await sql`SELECT province_id, username, active, allowed_sections, updated_at FROM province_accounts;`
      const byProvince = new Map(rows.map(row => [String(row.province_id), row]))
      return res.status(200).json({
        accounts: PROVINCE_UNITS.map(unit => {
          const account = byProvince.get(unit.id)
          return {
            provinceId: unit.id,
            provinceName: unit.name,
            username: account ? String(account.username) : null,
            active: account ? Boolean(account.active) : false,
            allowedSections: normalizeAllowedSections(account?.allowed_sections),
            updatedAt: account?.updated_at ? new Date(String(account.updated_at)).toISOString() : null,
          }
        }),
      })
    }

    const body = req.method === 'GET' ? {} : jsonObjectBody(req)
    const provinceId = typeof body.provinceId === 'string' ? body.provinceId : ''
    const unit = PROVINCE_UNITS.find(item => item.id === provinceId)
    if (!unit) return res.status(400).json({ error: 'استان انتخاب‌شده معتبر نیست.' })

    if (req.method === 'POST') {
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
      const password = typeof body.password === 'string' ? body.password : ''
      const allowedSections = body.allowedSections === undefined ? [] : validateAllowedSections(body.allowedSections)
      if (!allowedSections) return res.status(400).json({ error: 'فهرست بخش‌های مجاز معتبر نیست.' })
      if (!validUsername(username)) return res.status(400).json({ error: 'نام کاربری باید ۳ تا ۴۰ نویسه و فقط شامل حروف لاتین، عدد، نقطه، خط تیره یا زیرخط باشد.' })
      if (password.length < 10) return res.status(400).json({ error: 'رمز عبور باید دست‌کم ۱۰ نویسه داشته باشد.' })
      const hash = await hashPassword(password)
      const sectionsJson = JSON.stringify(allowedSections)
      try {
        await sql`
          INSERT INTO province_accounts (province_id, province_name, username, password_hash, active, allowed_sections)
          VALUES (${unit.id}, ${unit.name}, ${username}, ${hash}, TRUE, ${sectionsJson}::jsonb);
        `
      } catch (err: any) {
        if (err?.code === '23505') return res.status(409).json({ error: 'برای این استان حساب وجود دارد یا نام کاربری تکراری است.' })
        throw err
      }
      return res.status(201).json({ ok: true, allowedSections })
    }

    if (req.method === 'PATCH') {
      const currentRows = await sql`SELECT username, active, allowed_sections FROM province_accounts WHERE province_id = ${unit.id} LIMIT 1;`
      if (!currentRows[0]) return res.status(404).json({ error: 'برای این استان هنوز حسابی ساخته نشده است.' })
      const current = currentRows[0]
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : String(current.username)
      if (!validUsername(username)) return res.status(400).json({ error: 'نام کاربری معتبر نیست.' })
      const active = typeof body.active === 'boolean' ? body.active : Boolean(current.active)
      const password = typeof body.password === 'string' ? body.password : ''
      if (password && password.length < 10) return res.status(400).json({ error: 'رمز عبور باید دست‌کم ۱۰ نویسه داشته باشد.' })
      const allowedSections = body.allowedSections === undefined
        ? normalizeAllowedSections(current.allowed_sections)
        : validateAllowedSections(body.allowedSections)
      if (!allowedSections) return res.status(400).json({ error: 'فهرست بخش‌های مجاز معتبر نیست.' })
      const sectionsJson = JSON.stringify(allowedSections)
      try {
        if (password) {
          const hash = await hashPassword(password)
          await sql`UPDATE province_accounts SET username = ${username}, password_hash = ${hash}, active = ${active}, allowed_sections = ${sectionsJson}::jsonb, updated_at = CURRENT_TIMESTAMP WHERE province_id = ${unit.id};`
        } else {
          await sql`UPDATE province_accounts SET username = ${username}, active = ${active}, allowed_sections = ${sectionsJson}::jsonb, updated_at = CURRENT_TIMESTAMP WHERE province_id = ${unit.id};`
        }
      } catch (err: any) {
        if (err?.code === '23505') return res.status(409).json({ error: 'این نام کاربری قبلاً استفاده شده است.' })
        throw err
      }
      return res.status(200).json({ ok: true, allowedSections })
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM province_accounts WHERE province_id = ${unit.id};`
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'روش درخواست پشتیبانی نمی‌شود.' })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ error: err.message })
    console.error('Province account API failed:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ error: 'در ذخیره‌سازی حساب استان خطایی رخ داد.' })
  }
}
