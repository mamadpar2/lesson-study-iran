import { Readable } from 'node:stream'
import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { get } from '../lib/storage-local.js'
import { getSession } from '../lib/server-auth.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { renderPublicCertificateSvg } from '../lib/public-certificate-svg.js'
import { BUILTIN_CERTIFICATE_TEMPLATE_BASE64 } from '../lib/private-certificate-template.js'
import { normalizeCertificateProvince } from '../lib/certificate-lookup.js'
import { PROVINCE_UNITS } from '../src/provinces.js'
import { BUILTIN_CERTIFICATE_SOURCE_TEMPLATE_BASE64 } from '../lib/private-certificate-source-template.js'

const PRIVATE_CERTIFICATE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Streams private source assets only to an authenticated admin. Public callers can
 * request a personalized certificate only for an attendee record that exists in Neon;
 * the blank source template is never served by that public route.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body) } catch { return null } })() : req.body
    const webinarId = typeof body?.webinarId === 'string' ? body.webinarId.trim() : ''
    const province = typeof body?.province === 'string' ? body.province.trim() : ''
    const personnelCode: string = (typeof body?.personnelCode === 'string' ? String(body.personnelCode) : '').replace(/[۰-۹]/g, (digit: string) => String(digit.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (digit: string) => String(digit.charCodeAt(0) - 0x0660)).replace(/[\s-]/g, '')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Vary', 'Cookie')
    if (!webinarId || webinarId.length > 120 || !PROVINCE_UNITS.some(unit => unit.name === province) || !/^\d{4,12}$/.test(personnelCode)) {
      return res.status(400).json({ error: 'شناسه وبینار، استان یا کد پرسنلی معتبر نیست.' })
    }

    const sql = getDb()
    if (!sql || !(await initDbIfNeeded())) {
      return res.status(503).json({ error: 'پایگاه داده برای صدور گواهی در دسترس نیست.' })
    }
    if (!(await enforceRateLimit(req, res, 'public-certificate-lookup', 20, 600))) return

    try {
      const rows = await sql`
        SELECT
          webinar->>'title' AS webinar_title,
          webinar->>'date' AS webinar_date,
          webinar->>'certificateIssueDate' AS certificate_issue_date,
          webinar->>'certificateLetterNumber' AS certificate_letter_number,
          attendee_items.attendee AS attendee
        FROM site_settings AS settings
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(settings.data->'webinars') = 'array' THEN settings.data->'webinars'
            ELSE '[]'::jsonb
          END
        ) AS webinar_items(webinar)
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(webinar->'attendeesList') = 'array' THEN webinar->'attendeesList'
            ELSE '[]'::jsonb
          END
        ) AS attendee_items(attendee)
        WHERE settings.id = 'homepage'
          AND webinar->>'id' = ${webinarId}
          AND regexp_replace(translate(COALESCE(attendee_items.attendee->>'personnelCode', ''), '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'), '[[:space:]-]', '', 'g') = ${personnelCode}
          AND COALESCE(webinar->>'status', 'recorded') = 'recorded'
        LIMIT 100;
      `
      // Never pick a partial result if an unexpectedly large duplicate set exists.
      if (rows.length >= 100) return res.status(404).json({ error: 'گواهی قابل صدور یافت نشد؛ با دبیرخانه تماس بگیرید.' })
      const matching = rows.filter((row: any) => {
        const person = typeof row.attendee === 'string' ? JSON.parse(row.attendee) : row.attendee
        return normalizeCertificateProvince(person?.province) === normalizeCertificateProvince(province)
      })
      if (matching.length !== 1) return res.status(404).json({ error: 'گواهی قابل صدور یافت نشد؛ استان و کد را بررسی کنید یا با دبیرخانه تماس بگیرید.' })

      const row = matching[0]
      const attendee = typeof row.attendee === 'string' ? JSON.parse(row.attendee) : row.attendee
      if (!attendee || typeof attendee !== 'object' || !String(attendee.fullName || '').trim()) {
        return res.status(404).json({ error: 'اطلاعات لازم برای صدور گواهی کامل نیست.' })
      }
      const svg = renderPublicCertificateSvg({
        fullName: String(attendee.fullName || ''),
        personnelCode: String(attendee.personnelCode || ''),
        province: String(attendee.province || ''),
        district: String(attendee.district || ''),
        webinarTitle: String(row.webinar_title || ''),
        webinarDate: String(row.webinar_date || ''),
        issueDate: String(row.certificate_issue_date || ''),
        letterNumber: String(row.certificate_letter_number || ''),
      }, BUILTIN_CERTIFICATE_TEMPLATE_BASE64)
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8')
      res.setHeader('Content-Disposition', 'inline; filename="certificate.svg"')
      return res.status(200).end(svg)
    } catch (error) {
      console.error('Public certificate image render failed:', error instanceof Error ? error.message : 'unknown error')
      return res.status(500).json({ error: 'ساخت تصویر گواهی انجام نشد؛ کمی بعد دوباره تلاش کنید.' })
    }
  }

  // The blank built-in template and private source-file URLs remain admin-only.
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Cookie')
  const session = getSession(req)
  if (!session || session.role !== 'admin') {
    return res.status(401).json({ error: 'دریافت فایل خام گواهی فقط برای مدیر دبیرخانه مجاز است.' })
  }
  if (!(await enforceRateLimit(req, res, 'private-certificate-media', 120, 60))) return

  if (queryString(req.query.template) === 'webinar-v2') {
    const template = Buffer.from(BUILTIN_CERTIFICATE_SOURCE_TEMPLATE_BASE64, 'base64')
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Length', template.length)
    res.setHeader('Content-Disposition', 'inline; filename="certificate-template-a4.png"')
    return res.status(200).end(template)
  }

  const pathname = queryString(req.query.pathname)?.trim() || ''
  if (
    pathname.length > 240 ||
    !/^admin\/[A-Za-z0-9._-]+$/.test(pathname) ||
    pathname.includes('..')
  ) {
    return res.status(400).json({ error: 'شناسه فایل خصوصی معتبر نیست.' })
  }

  const storeId = process.env.BLOB_STORE_ID
  if (!storeId) return res.status(503).json({ error: 'Store خصوصی Blob در دسترس نیست.' })

  try {
    const blob = await get(pathname, { access: 'private', storeId })
    if (!blob || blob.statusCode !== 200) return res.status(404).json({ error: 'فایل خصوصی پیدا نشد.' })
    const contentType = (blob.blob.contentType || '').split(';')[0].trim().toLowerCase()
    if (!PRIVATE_CERTIFICATE_TYPES.has(contentType)) {
      return res.status(415).json({ error: 'این نوع فایل برای نمایش گواهی مجاز نیست.' })
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'inline')
    Readable.fromWeb(blob.stream as any).pipe(res)
  } catch (error) {
    console.error('Private certificate media read failed:', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ error: 'دریافت فایل خصوصی انجام نشد.' })
  }
}
