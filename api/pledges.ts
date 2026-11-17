import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { getSession } from '../lib/server-auth.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { InvalidInputError, jsonObjectBody, normalizeDigits, textField } from '../lib/input.js'
import { PROVINCE_UNITS } from '../src/provinces.js'

export const config = { api: { bodyParser: { sizeLimit: '8kb' } } }

const ALLOWED_GRADES = [
  'متوسطه اول',
  'متوسطه دوم نظری',
  'متوسطه دوم فنی حرفه‌ای و کارودانش',
]
const ALLOWED_PROVINCES = new Set(PROVINCE_UNITS.map((province) => province.name))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'روش درخواست پشتیبانی نمی‌شود.' })

  const adminListRequest = req.method === 'GET' && String(req.query.view || '') === 'admin'
  if (req.method === 'GET' && adminListRequest) {
    const session = getSession(req)
    if (!session || session.role !== 'admin') {
      res.setHeader('Cache-Control', 'private, no-store')
      return res.status(401).json({ error: 'مشاهده مشخصات ثبت‌نام‌کنندگان فقط برای مدیر مجاز است.' })
    }
    res.setHeader('Cache-Control', 'private, no-store')
  }

  if (req.method === 'POST') {
    res.setHeader('Cache-Control', 'no-store')
    if (!(await enforceRateLimit(req, res, 'pledge-submit', 8, 10 * 60))) return
  }

  const sql = getDb()
  if (!sql || !(await initDbIfNeeded())) return res.status(503).json({ error: 'پایگاه داده مشترک در دسترس نیست.' })

  try {
    if (req.method === 'GET') {
      if (adminListRequest) {
        const rows = await sql`
          SELECT id,
            full_name AS "fullName",
            personnel_code AS "personnelCode",
            province,
            grade,
            district,
            phone,
            school,
            pledge_text AS "pledgeText",
            created_at AS "joinedAt"
          FROM campaign_pledges
          ORDER BY created_at DESC
          LIMIT 10000;
        `
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(200).json({ status: 'ok', data: rows })
      }

      // Public endpoint returns only an aggregate; no identifying information leaves this route.
      const countRes = await sql`SELECT COUNT(*) AS total FROM campaign_pledges;`
      const total = countRes && countRes[0] ? Number(countRes[0].total) : 0
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
      return res.status(200).json({ status: 'ok', count: total })
    }

    const body = jsonObjectBody(req)
    const fullName = textField(body, 'fullName', 150, true)
    const personnelCode = normalizeDigits(textField(body, 'personnelCode', 16, true))
    if (!/^(?:\d{8}|\d{10})$/.test(personnelCode)) throw new InvalidInputError('کد پرسنلی باید ۸ رقم یا کد ملی باید ۱۰ رقم باشد.')

    const province = textField(body, 'province', 100, true)
    if (!ALLOWED_PROVINCES.has(province)) throw new InvalidInputError('استان یا واحد محل خدمت معتبر نیست.')

    const grade = textField(body, 'grade', 100, true)
    if (!ALLOWED_GRADES.includes(grade)) throw new InvalidInputError('مقطع تحصیلی معتبر نیست.')

    const district = textField(body, 'district', 150, true)
    const phone = normalizeDigits(textField(body, 'phone', 20, true))
    if (!/^09\d{9}$/.test(phone)) throw new InvalidInputError('شماره همراه باید ۱۱ رقم و با 09 آغاز شود.')

    const school = textField(body, 'school', 200, true)
    const pledgeText = textField(body, 'pledgeText', 2000, true)
    const duplicate = await sql`SELECT 1 FROM campaign_pledges WHERE personnel_code = ${personnelCode} LIMIT 1;`
    if (duplicate.length) {
      return res.status(409).json({ error: 'این کد قبلاً در عهدنامه هم‌آموزی ثبت‌نام کرده است.' })
    }
    const id = `PLG-${randomUUID()}`
    await sql`
      INSERT INTO campaign_pledges
        (id, full_name, personnel_code, province, grade, district, phone, school, pledge_text)
      VALUES
        (${id}, ${fullName}, ${personnelCode}, ${province}, ${grade}, ${district}, ${phone}, ${school}, ${pledgeText});
    `
    return res.status(201).json({ status: 'saved', id })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ error: err.message })
    if ((err as { code?: string } | null)?.code === '23505') {
      return res.status(409).json({ error: 'این کد قبلاً در عهدنامه هم‌آموزی ثبت‌نام کرده است.' })
    }
    console.error('Pledge API failed:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ error: 'ثبت تعهد انجام نشد.' })
  }
}
