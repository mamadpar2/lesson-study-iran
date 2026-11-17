import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { get } from '../lib/storage-local.js'
import { verifySubmissionUploadToken } from '../lib/submission-upload-token.js'
import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { getSession } from '../lib/server-auth.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { httpUrlField, InvalidInputError, jsonObjectBody, normalizeDigits, textField } from '../lib/input.js'
import { PROVINCE_UNITS } from '../src/provinces.js'

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } }

const ALLOWED_PROVINCES = new Set(PROVINCE_UNITS.map((province) => province.name))
const ALLOWED_CONTENT_GRADES = new Set([
  'ابتدایی',
  'متوسطه اول',
  'متوسطه دوم نظری',
  'متوسطه دوم فنی حرفه‌ای و کارودانش',
])
const ALLOWED_CONTENT_TYPES = new Set([
  'عکس و گزارش تصویری',
  'اینفوگراف',
  'لینک ویدیو ابری',
  'فایل آموزشی ورد',
  'فایل آموزشی پی‌دی‌اف',
  'فایل آموزشی پاورپوینت',
])

function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'روش درخواست پشتیبانی نمی‌شود.' })

  if (req.method === 'GET') {
    const session = getSession(req)
    if (!session || session.role !== 'admin') return res.status(401).json({ error: 'دریافت اطلاعات تجربه‌ها فقط برای مدیر مجاز است.' })
    res.setHeader('Cache-Control', 'private, no-store')
  } else if (!(await enforceRateLimit(req, res, 'experience-submit', 5, 10 * 60))) {
    return
  }

  const sql = getDb()
  if (!sql || !(await initDbIfNeeded())) return res.status(503).json({ error: 'پایگاه داده مشترک در دسترس نیست.' })

  try {
    if (req.method === 'GET') {
      const downloadId = queryString(req.query.downloadId)
      if (downloadId) {
        if (!/^EXP-[0-9a-f-]{36}$/i.test(downloadId)) return res.status(400).json({ error: 'شناسه فایل نامعتبر است.' })
        const rows = await sql`SELECT private_file_path, file_name FROM experiences WHERE id = ${downloadId} LIMIT 1;`
        const pathname = String(rows[0]?.private_file_path || '')
        if (!pathname) return res.status(404).json({ error: 'فایل خصوصی پیدا نشد.' })
        if (!process.env.BLOB_STORE_ID) return res.status(503).json({ error: 'Store خصوصی Blob در دسترس نیست.' })
        const blob = await get(pathname, { access: 'private', storeId: process.env.BLOB_STORE_ID })
        if (!blob || blob.statusCode !== 200) return res.status(404).json({ error: 'فایل خصوصی پیدا نشد.' })
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('X-Content-Type-Options', 'nosniff')
        const ext = String(rows[0]?.file_name || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx'
        res.setHeader('Content-Disposition', `attachment; filename="submission.${ext}"`)
        Readable.fromWeb(blob.stream as any).pipe(res)
        return
      }
      if (queryString(req.query.view) === 'content-submissions') {
        const submissions = await sql`
          SELECT id, full_name AS "fullName", national_code AS "nationalCode",
            personnel_code AS "personnelCode", province, district, grade, phone, email,
            content_type AS "contentType", title, media_link AS "mediaLink", description,
            created_at AS "createdAt"
          FROM content_submissions ORDER BY created_at DESC LIMIT 100;
        `
        res.setHeader('Cache-Control', 'private, no-store')
        return res.status(200).json({ status: 'ok', data: submissions })
      }
      const rawPage = Number(queryString(req.query.page) || '0')
      const page = Number.isSafeInteger(rawPage) && rawPage >= 0 && rawPage <= 10000 ? rawPage : 0
      const offset = page * 20
      const rows = await sql`
        SELECT id, name, national_code AS "nationalCode", personnel_code AS "personnelCode",
          service_years AS "serviceYears", school, province, district, phone, email, kind,
          title, summary, file_name AS "fileName", file_url AS "fileUrl", (private_file_path IS NOT NULL) AS "hasPrivateFile", created_at AS "savedAt"
        FROM experiences ORDER BY created_at DESC LIMIT 20 OFFSET ${offset};
      `
      res.setHeader('Cache-Control', 'private, no-store')
      return res.status(200).json({ status: 'ok', data: rows })
    }

    const body = jsonObjectBody(req)
    if (textField(body, 'submissionType', 40) === 'content-production') {
      const fullName = textField(body, 'fullName', 150, true)
      const nationalCode = normalizeDigits(textField(body, 'nationalCode', 20, true))
      if (!/^\d{10}$/.test(nationalCode)) throw new InvalidInputError('کد ملی باید ۱۰ رقم باشد.')
      const personnelCode = normalizeDigits(textField(body, 'personnelCode', 16, true))
      if (!/^\d{8}$/.test(personnelCode)) throw new InvalidInputError('کد پرسنلی باید ۸ رقم باشد.')
      const province = textField(body, 'province', 100, true)
      if (!ALLOWED_PROVINCES.has(province)) throw new InvalidInputError('استان یا واحد معتبر نیست.')
      const district = textField(body, 'district', 150, true)
      const grade = textField(body, 'grade', 100, true)
      if (!ALLOWED_CONTENT_GRADES.has(grade)) throw new InvalidInputError('مقطع معتبر نیست.')
      const phone = normalizeDigits(textField(body, 'phone', 20, true))
      if (!/^09\d{9}$/.test(phone)) throw new InvalidInputError('شماره همراه معتبر نیست.')
      const email = textField(body, 'email', 150, true)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvalidInputError('پست الکترونیک معتبر نیست.')
      const contentType = textField(body, 'contentType', 100, true)
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) throw new InvalidInputError('قالب اثر معتبر نیست.')
      const title = textField(body, 'title', 255, true)
      const mediaLink = httpUrlField(textField(body, 'mediaLink', 2048, true), 'دسترسی به اثر')
      const description = textField(body, 'description', 6000, true)
      const id = `CONT-${randomUUID()}`
      await sql`
        INSERT INTO content_submissions
          (id, full_name, national_code, personnel_code, province, district, grade, phone,
           email, content_type, title, media_link, description)
        VALUES
          (${id}, ${fullName}, ${nationalCode}, ${personnelCode}, ${province}, ${district},
           ${grade}, ${phone}, ${email}, ${contentType}, ${title}, ${mediaLink}, ${description});
      `
      return res.status(201).json({ status: 'saved', id })
    }
    const name = textField(body, 'name', 150, true)
    const nationalCode = normalizeDigits(textField(body, 'nationalCode', 20, true))
    if (!/^\d{10}$/.test(nationalCode)) throw new InvalidInputError('کد ملی باید دقیقاً ۱۰ رقم باشد.')

    const personnelCode = normalizeDigits(textField(body, 'personnelCode', 16, true))
    if (!/^\d{8}$/.test(personnelCode)) throw new InvalidInputError('کد پرسنلی باید دقیقاً ۸ رقم باشد.')

    const rawYears = body.serviceYears
    if ((typeof rawYears !== 'number' && typeof rawYears !== 'string') || rawYears === '') throw new InvalidInputError('سابقه خدمت الزامی است.')
    const serviceYears = Number(rawYears)
    if (!Number.isSafeInteger(serviceYears) || serviceYears < 0 || serviceYears > 2147483647) throw new InvalidInputError('سابقه خدمت باید یک عدد صحیح و غیرمنفی باشد.')

    const school = textField(body, 'school', 200, true)
    const province = textField(body, 'province', 100, true)
    if (!ALLOWED_PROVINCES.has(province)) throw new InvalidInputError('استان یا واحد محل خدمت معتبر نیست.')
    const district = textField(body, 'district', 150, true)
    const phone = normalizeDigits(textField(body, 'phone', 20, true))
    if (!/^09\d{9}$/.test(phone)) throw new InvalidInputError('شماره همراه باید ۱۱ رقم و با 09 آغاز شود.')

    const email = textField(body, 'email', 150, true)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InvalidInputError('نشانی پست الکترونیک معتبر نیست.')
    const kind = textField(body, 'kind', 100) || 'تجربه آموزشی'
    const title = textField(body, 'title', 255, true)
    const summary = textField(body, 'summary', 6000, true)
    const paragraphs = summary.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
    if (paragraphs.length < 2) throw new InvalidInputError('خلاصه تجربه باید دست‌کم در دو بند نوشته شود.')

    const fileName = textField(body, 'fileName', 255, true)
    const uploadToken = textField(body, 'fileUploadToken', 2048)
    const privateFilePath = uploadToken ? verifySubmissionUploadToken(uploadToken) : null
    if (uploadToken && !privateFilePath) throw new InvalidInputError('مجوز بارگذاری فایل معتبر نیست یا منقضی شده است.')
    const rawFileUrl = textField(body, 'fileUrl', 2048)
    const fileUrl = privateFilePath ? '' : httpUrlField(rawFileUrl, 'فایل')
    if (!privateFilePath && !fileUrl) throw new InvalidInputError('فایل یا پیوند فایل الزامی است.')
    const duplicate = await sql`SELECT 1 FROM experiences WHERE national_code = ${nationalCode} LIMIT 1;`
    if (duplicate.length) {
      return res.status(409).json({ error: 'این کد ملی قبلاً برای ثبت تجربه زیسته ثبت شده است.' })
    }

    const id = `EXP-${randomUUID()}`
    await sql`
      INSERT INTO experiences
        (id, name, national_code, personnel_code, service_years, school, province, district, phone,
         email, kind, title, summary, file_name, file_url, private_file_path)
      VALUES
        (${id}, ${name}, ${nationalCode}, ${personnelCode}, ${serviceYears}, ${school}, ${province}, ${district}, ${phone},
         ${email}, ${kind}, ${title}, ${summary}, ${fileName}, ${fileUrl}, ${privateFilePath});
    `
    return res.status(201).json({ status: 'saved', id })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ error: err.message })
    if ((err as { code?: string } | null)?.code === '23505') {
      return res.status(409).json({ error: 'این کد ملی قبلاً برای ثبت تجربه زیسته ثبت شده است.' })
    }
    console.error('Experience API failed:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ error: 'ثبت یا دریافت اطلاعات تجربه انجام نشد.' })
  }
}
