import { randomUUID } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { getSession } from '../lib/server-auth.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { InvalidInputError, jsonObjectBody, normalizeDigits, textField } from '../lib/input.js'
import { PROVINCE_UNITS } from '../src/provinces.js'
import { getWebinarRegistrationWindow } from '../lib/webinar-registration-time.js'

function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'POST') res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'روش درخواست پشتیبانی نمی‌شود.' })

  if (req.method === 'GET' || req.method === 'DELETE') {
    const session = getSession(req)
    if (!session || session.role !== 'admin') return res.status(401).json({ error: 'دریافت اطلاعات ثبت‌نام فقط برای مدیر مجاز است.' })
    res.setHeader('Cache-Control', 'private, no-store')
  } else if (!(await enforceRateLimit(req, res, 'registration-submit', 5, 10 * 60))) {
    return
  }

  const sql = getDb()
  if (!sql || !(await initDbIfNeeded())) return res.status(503).json({ error: 'پایگاه داده مشترک در دسترس نیست.' })

  try {
    if (req.method === 'GET') {
      if (queryString(req.query.view) === 'webinar-attendance') {
        const webinarId = queryString(req.query.eventId)?.trim() || ''
        if (!webinarId || webinarId.length > 120) return res.status(400).json({ error: 'شناسه وبینار معتبر نیست.' })
        const rows = await sql`
          SELECT id, webinar_id, full_name, personnel_code, province, district, created_at
          FROM webinar_attendance_registrations
          WHERE webinar_id = ${webinarId}
          ORDER BY created_at ASC;
        `
        return res.status(200).json({ status: 'ok', data: rows })
      }
      if (queryString(req.query.view) === 'in-person') {
        const eventId = queryString(req.query.eventId)?.trim() || ''
        if (!eventId || eventId.length > 120) return res.status(400).json({ error: 'شناسه نشست معتبر نیست.' })
        const rows = await sql`SELECT id, event_id, full_name, national_code, phone, school, province, created_at FROM in_person_registrations WHERE event_id = ${eventId} ORDER BY created_at DESC;`
        return res.status(200).json({ status: 'ok', data: rows })
      }
      const rows = await sql`SELECT id, event_id, event_type, full_name, national_code, phone, school, province, created_at FROM registrations ORDER BY created_at DESC LIMIT 100;`
      res.setHeader('Cache-Control', 'private, no-store')
      return res.status(200).json({ status: 'ok', data: rows })
    }

    const body = jsonObjectBody(req)
    if (req.method === 'DELETE') {
      const eventId = textField(body, 'eventId', 120, true)
      const registrationId = textField(body, 'registrationId', 50, true)
      if (!/^WREG-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registrationId)) {
        throw new InvalidInputError('شناسه ثبت‌حضور معتبر نیست.')
      }
      const deleted = await sql`
        DELETE FROM webinar_attendance_registrations
        WHERE id = ${registrationId} AND webinar_id = ${eventId}
        RETURNING id;
      `
      if (!deleted.length) return res.status(404).json({ error: 'ثبت‌حضور در این وبینار پیدا نشد؛ فهرست را تازه‌سازی کنید.' })
      return res.status(200).json({ status: 'deleted' })
    }
    const eventType = textField(body, 'eventType', 30, true)

    if (eventType === 'webinar-attendance') {
      const webinarId = textField(body, 'eventId', 120, true)
      const fullName = textField(body, 'fullName', 150, true)
      const personnelCode = normalizeDigits(textField(body, 'personnelCode', 12, true)).replace(/[\s-]/g, '')
      if (!/^\d{4,12}$/.test(personnelCode)) throw new InvalidInputError('کد پرسنلی باید ۴ تا ۱۲ رقم باشد.')
      const province = textField(body, 'province', 100, true)
      if (!PROVINCE_UNITS.some(unit => unit.name === province)) throw new InvalidInputError('استان یا واحد انتخاب‌شده معتبر نیست.')
      const district = textField(body, 'district', 150, true)

      // Filter and project inside Postgres: never transfer other webinars, their
      // attendee lists, or files just to validate one registration. Ordinality
      // preserves the previous Array.find behaviour if IDs are duplicated.
      const settingsRows = await sql`
        SELECT jsonb_build_object(
          'status', webinar->'status',
          'attendanceStartDate', webinar->'attendanceStartDate',
          'attendanceStartTime', webinar->'attendanceStartTime',
          'attendanceEndDate', webinar->'attendanceEndDate',
          'attendanceEndTime', webinar->'attendanceEndTime'
        ) AS webinar
        FROM site_settings AS settings
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(settings.data->'webinars') = 'array'
            THEN settings.data->'webinars' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS webinar_items(webinar, position)
        WHERE settings.id = 'homepage' AND webinar->>'id' = ${webinarId}
        ORDER BY position ASC
        LIMIT 1;
      `
      const rawWebinar = settingsRows?.[0]?.webinar
      const webinar = typeof rawWebinar === 'string' ? JSON.parse(rawWebinar) : rawWebinar
      if (!webinar || webinar.status !== 'upcoming') return res.status(404).json({ error: 'وبینار پیش‌رو پیدا نشد.' })
      const window = getWebinarRegistrationWindow(webinar)
      const now = Date.now()
      if (!window.configured || !window.start || !window.end) {
        return res.status(409).json({ error: 'زمان ثبت حضور این وبینار هنوز تنظیم نشده است.' })
      }
      if (now < window.start.getTime()) return res.status(409).json({ error: 'مهلت ثبت حضور هنوز آغاز نشده است.' })
      if (now >= window.end.getTime()) return res.status(409).json({ error: 'مهلت ثبت حضور پایان یافته است.' })

      const id = `WREG-${randomUUID()}`
      await sql`
        INSERT INTO webinar_attendance_registrations (id, webinar_id, full_name, personnel_code, province, district)
        VALUES (${id}, ${webinarId}, ${fullName}, ${personnelCode}, ${province}, ${district});
      `
      return res.status(201).json({ status: 'saved', id })
    }

    if (eventType === 'in-person') {
      const eventId = textField(body, 'eventId', 120, true)
      const fullName = textField(body, 'fullName', 150, true)
      const nationalCode = normalizeDigits(textField(body, 'nationalCode', 20, true)).replace(/[\s-]/g, '')
      const phone = normalizeDigits(textField(body, 'phone', 30, true)).replace(/[\s()-]/g, '')
      const school = textField(body, 'school', 200, true)
      if (!/^\d{10}$/.test(nationalCode)) throw new InvalidInputError('کد ملی باید ۱۰ رقم باشد.')
      if (!/^09\d{9}$/.test(phone)) throw new InvalidInputError('شماره همراه باید ۱۱ رقم و با ۰۹ آغاز شود.')
      const eventRows = await sql`SELECT data->'inPersonEvents' AS events FROM site_settings WHERE id = 'homepage' LIMIT 1;`
      const rawEvents = eventRows[0]?.events
      const events = typeof rawEvents === 'string' ? JSON.parse(rawEvents) : rawEvents
      const event = Array.isArray(events) ? events.find((item: any) => String(item?.id || '') === eventId) : null
      if (!event) return res.status(404).json({ error: 'نشست مورد نظر پیدا نشد.' })
      if (event.status !== 'open') return res.status(409).json({ error: 'ثبت‌نام این نشست فعال نیست.' })
      const province = String(event.province || '').trim().slice(0, 100)
      if (!province) return res.status(409).json({ error: 'استان نشست تنظیم نشده است.' })
      const id = `IREG-${randomUUID()}`
      await sql`INSERT INTO in_person_registrations (id, event_id, full_name, national_code, phone, school, province)
        VALUES (${id}, ${eventId}, ${fullName}, ${nationalCode}, ${phone}, ${school}, ${province});`
      return res.status(201).json({ status: 'saved', id })
    }

    const eventId = textField(body, 'eventId', 50, true)
    if (eventType !== 'webinar') throw new InvalidInputError('نوع رویداد معتبر نیست.')
    const fullName = textField(body, 'fullName', 150, true)
    const nationalCode = normalizeDigits(textField(body, 'nationalCode', 20, true)).replace(/[\s-]/g, '')
    if (!/^\d{10}$/.test(nationalCode)) throw new InvalidInputError('کد ملی باید ۱۰ رقم باشد.')
    const phone = normalizeDigits(textField(body, 'phone', 30, true))
    const normalizedPhone = phone.replace(/[\s()-]/g, '')
    if (!/^\+?\d{7,15}$/.test(normalizedPhone)) throw new InvalidInputError('شماره همراه معتبر نیست.')
    const school = textField(body, 'school', 200, true)
    const province = textField(body, 'province', 100, true)

    const id = `REG-${randomUUID()}`
    await sql`
      INSERT INTO registrations (id, event_id, event_type, full_name, national_code, phone, school, province)
      VALUES (${id}, ${eventId}, ${eventType}, ${fullName}, ${nationalCode}, ${normalizedPhone}, ${school}, ${province});
    `
    return res.status(201).json({ status: 'saved', id })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ error: err.message })
    if (err && typeof err === 'object' && ('code' in err) && String((err as { code?: unknown }).code) === '23505') {
      return res.status(409).json({ code: 'DUPLICATE_REGISTRATION', error: 'این مشخصات قبلاً برای همین رویداد ثبت شده است.' })
    }
    console.error('Registration API failed:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ error: 'ثبت یا دریافت اطلاعات ناموفق بود.' })
  }
}
