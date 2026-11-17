import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { getSession } from '../lib/server-auth.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { buildSettingsEtag, matchesIfNoneMatch } from '../lib/http-cache.js'
import { InvalidInputError, jsonObjectBody } from '../lib/input.js'
import campaignUploadHandler from '../lib/campaign-upload-server.js'
import { publicProvinceRecords } from '../lib/province-moderation.js'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function findUnpersistedMedia(value: unknown): 'inline' | 'temporary' | null {
  if (typeof value === 'string') {
    if (value.startsWith('blob:')) return 'temporary'
    if (value.startsWith('data:') && value.length > 5500) return 'inline'
    return null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const issue = findUnpersistedMedia(item)
      if (issue) return issue
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const issue = findUnpersistedMedia(item)
      if (issue) return issue
    }
  }
  return null
}

async function readSettingsEtag(sql: ReturnType<typeof getDb>, scope = 'public-settings-v2') {
  if (!sql) throw new Error('No Neon connection')
  const rows = await sql`
    SELECT
      (SELECT updated_at::text FROM site_settings WHERE id = 'homepage' LIMIT 1) AS settings_updated_at,
      (SELECT COUNT(*)::int FROM province_content) AS province_count,
      (SELECT MAX(updated_at)::text FROM province_content) AS province_updated_at;
  `
  const revision = rows[0] || {}
  return buildSettingsEtag(
    revision.settings_updated_at ? String(revision.settings_updated_at) : null,
    Number(revision.province_count || 0),
    revision.province_updated_at ? String(revision.province_updated_at) : null,
    scope,
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (queryString(req.query.action) === 'campaign-upload') return campaignUploadHandler(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const view = req.method === 'GET' ? queryString(req.query.view) : undefined
  const adminView = view === 'admin'
  const attendeeView = view === 'attendees'
  const privateView = adminView || attendeeView
  const webinarId = req.method === 'GET' ? queryString(req.query.webinarId) : undefined

  if (attendeeView && (!webinarId || webinarId.length > 120)) {
    return res.status(400).json({ status: 'error', error: 'شناسه وبینار معتبر نیست.' })
  }
  if (privateView || req.method === 'POST') {
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Vary', 'Cookie')
    const session = getSession(req)
    if (!session || session.role !== 'admin') {
      return res.status(401).json({ status: 'error', error: 'این اطلاعات و عملیات فقط برای مدیر دبیرخانه مجاز است.' })
    }
  } else if (req.method === 'GET') {
    res.setHeader('Cache-Control', attendeeView ? 'private, no-store' : 'public, max-age=0, must-revalidate')
  }

  const sql = getDb()
  if (!sql) {
    return res.status(503).json({
      status: 'error',
      message: 'پایگاه داده مشترک متصل نیست؛ POSTGRES_URL یا DATABASE_URL را در تنظیمات سرور تعریف کنید.',
    })
  }

  try {
    if (!(await initDbIfNeeded())) return res.status(503).json({ status: 'error', error: 'پایگاه داده مشترک در دسترس نیست.' })
    if (req.method === 'GET') {

      // Check the compact revision before selecting the settings payload.
      // Public clients receive a slim webinar-card payload; the attendee view
      // returns one webinar's list on demand using this existing Vercel function.
      const etagScope = adminView
        ? 'admin-settings-v1'
        : attendeeView
          ? `webinar-attendees-public-v4:${webinarId}`
          : 'public-settings-v4'
      const etag = await readSettingsEtag(sql, etagScope)
      res.setHeader('ETag', etag)
      if (!privateView && !attendeeView && matchesIfNoneMatch(req.headers['if-none-match'], etag)) {
        return res.status(304).end()
      }

      if (attendeeView) {
        if (!(await enforceRateLimit(req, res, 'public-webinar-attendees', 60, 60))) return
        const attendeeRows = await sql`
          SELECT
            webinar->'attendeesList' AS attendees,
            webinar->>'title' AS title,
            webinar->>'date' AS date,
            webinar->>'certificateIssueDate' AS certificate_issue_date,
            webinar->>'certificateLetterNumber' AS certificate_letter_number
          FROM site_settings AS settings
          CROSS JOIN LATERAL jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(settings.data->'webinars') = 'array' THEN settings.data->'webinars'
              ELSE '[]'::jsonb
            END
          ) AS webinar_items(webinar)
          WHERE settings.id = 'homepage'
            AND webinar->>'id' = ${webinarId}
            AND webinar->>'status' = 'recorded'
          LIMIT 1;
        `
        if (!attendeeRows.length) return res.status(404).json({ status: 'error', error: 'وبینار پیدا نشد.' })
        const row = attendeeRows[0]
        const attendees = typeof row.attendees === 'string' ? JSON.parse(row.attendees) : row.attendees
        const publicAttendees = (Array.isArray(attendees) ? attendees : [])
          .map((attendee: any) => ({
            id: String(attendee?.id || ''),
            fullName: String(attendee?.fullName || ''),
            province: String(attendee?.province || ''),
            district: String(attendee?.district || ''),
            personnelCode: String(attendee?.personnelCode || ''),
          }))
          .filter((attendee: { id: string; fullName: string }) => attendee.id && attendee.fullName)
        return res.status(200).json({
          status: 'ok',
          webinarTitle: row.title || '',
          date: row.date || '',
          certificateIssueDate: row.certificate_issue_date || '',
          certificateLetterNumber: row.certificate_letter_number || '',
          attendees: publicAttendees,
        })
      }

      const rows = adminView
        ? await sql`SELECT data FROM site_settings WHERE id = 'homepage' LIMIT 1;`
        : await sql`
          SELECT CASE
            WHEN jsonb_typeof(data->'webinars') = 'array' THEN
              jsonb_set(
                data,
                '{webinars}',
                COALESCE((
                  SELECT jsonb_agg(
                    (
                      (CASE
                        WHEN webinar->>'status' = 'upcoming'
                          THEN webinar - 'contentFiles' - 'contentUrl' - 'contentFileName' - 'recordedVideoUrl'
                        ELSE webinar - 'meetingUrl'
                      END)
                        - 'attendeesCount'
                        - 'attendeesList'
                        - 'attendeesExcelUrl'
                        - 'attendeesFileName'
                        - 'certificateTemplateUrl'
                        - 'certificateTemplateFileName'
                        - 'certificateDocxTemplateUrl'
                        - 'certificateDocxFileName'
                        - 'certificatesPdfUrl'
                        - 'certificatesPdfFileName'
                        - 'certificatesCount'
                        - 'certificateIssueDate'
                        - 'certificateLetterNumber'
                    )
                    || jsonb_build_object(
                      'attendeesCount',
                      CASE
                        WHEN webinar->>'status' = 'upcoming' THEN 0
                        WHEN jsonb_typeof(webinar->'attendeesList') = 'array'
                          THEN jsonb_array_length(webinar->'attendeesList')
                        ELSE 0
                      END
                    )
                  )
                  FROM jsonb_array_elements(data->'webinars') AS webinar_items(webinar)
                ), '[]'::jsonb)
              )
            ELSE data
          END AS data
          FROM site_settings
          WHERE id = 'homepage'
          LIMIT 1;
        `

      const contentRows = adminView
        ? await sql`SELECT id, province_id, province_name, section_id, data, created_at FROM province_content ORDER BY created_at DESC;`
        : await sql`
          SELECT id, province_id, province_name, section_id,
            CASE WHEN jsonb_typeof(data->'attachments') = 'array' THEN
              jsonb_set(data - 'internalDetails' - 'reviewNote' - 'revision', '{attachments}', COALESCE((
                SELECT jsonb_agg(attachment - 'pathname') FROM jsonb_array_elements(data->'attachments') AS attachment_items(attachment)
                WHERE (COALESCE(attachment->>'access', 'public') = 'public' AND COALESCE(attachment->>'url', '') <> '')
                   OR (attachment->>'access' = 'private' AND attachment->'publishable' = 'true'::jsonb
                       AND COALESCE(data->>'recordType','content') <> 'daily-activity'
                       AND COALESCE(attachment->>'fileName','') !~* '\\.(xlsx?|csv)$')
              ), '[]'::jsonb))
            ELSE data - 'internalDetails' - 'reviewNote' - 'revision' - 'attachments' END AS data,
            created_at
          FROM province_content WHERE COALESCE(data->>'reviewStatus', 'published') = 'published' ORDER BY created_at DESC;
        `
      const provincialContent = contentRows.map((row: any) => {
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        return {
          ...data,
          id: String(row.id),
          provinceId: String(row.province_id),
          provinceName: String(row.province_name),
          sectionId: String(row.section_id),
          createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : data.createdAt,
        }
      })
      const base = rows?.[0]?.data || null
      if (base || provincialContent.length) {
        return res.status(200).json({ status: 'ok', data: { ...(base || {}), provinceContent: adminView ? provincialContent : publicProvinceRecords(provincialContent) } })
      }
      return res.status(200).json({ status: 'empty', data: null })
    }

    if (req.method === 'POST') {
      const payload = jsonObjectBody(req)
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ status: 'error', error: 'داده‌های ارسالی معتبر نیستند.' })
      }
      // Provincial rows are stored in their own table and never overwritten by homepage edits.
      const { provinceContent: _ignoredProvinceContent, ...homepageData } = payload
      const mediaIssue = findUnpersistedMedia(homepageData)
      if (mediaIssue === 'temporary') {
        return res.status(400).json({ status: 'error', error: 'پیوند موقت مرورگر قابل ذخیره نیست؛ فایل را دوباره بارگذاری کنید.' })
      }
      if (mediaIssue === 'inline') {
        return res.status(413).json({ status: 'error', error: 'فایل حجیم نباید داخل دیتابیس Neon ذخیره شود؛ Vercel Blob را وصل کنید و دوباره ذخیره کنید.' })
      }
      const jsonStr = JSON.stringify(homepageData)
      await sql`
        INSERT INTO site_settings (id, data, updated_at)
        VALUES ('homepage', ${jsonStr}::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET data = ${jsonStr}::jsonb, updated_at = CURRENT_TIMESTAMP;
      `
      res.setHeader('ETag', await readSettingsEtag(sql, 'admin-settings-v1'))
      return res.status(200).json({ status: 'saved', success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ status: 'error', error: err.message })
    console.error('Database settings API error:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ status: 'error', error: 'خطا در خواندن یا ذخیره اطلاعات سایت.' })
  }
}
