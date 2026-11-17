import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { get } from '../lib/storage-local.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'
import { getSession } from '../lib/server-auth.js'
import { normalizeAllowedSections, PROVINCE_CONTENT_SECTION_IDS } from '../src/province-access.js'
import { PROVINCE_UNITS } from '../src/provinces.js'
import type { ProvinceAttachment, ProvinceContentSectionId } from '../src/types.js'
import { InvalidInputError, jsonObjectBody } from '../lib/input.js'
import { provinceStatus } from '../lib/province-moderation.js'

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } }

const SECTIONS = new Set<ProvinceContentSectionId>(PROVINCE_CONTENT_SECTION_IDS)

function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function allowedUrl(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.length > 2048) throw new Error('پیوند فایل یا صفحه معتبر نیست.')
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error()
    return url.toString()
  } catch {
    throw new Error('فقط پیوندهای معتبر http یا https پذیرفته می‌شوند.')
  }
}

function normalizeAttachment(value: any, recordType: string, provinceId: string): ProvinceAttachment {
  if (!value || typeof value !== 'object') throw new Error('ساختار پیوست معتبر نیست.')
  const id = typeof value.id === 'string' && value.id.length <= 80 ? value.id : randomUUID()
  const label = typeof value.label === 'string' ? value.label.trim().slice(0, 100) : ''
  const fileName = typeof value.fileName === 'string' ? value.fileName.trim().slice(0, 200) : ''
  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  const access = value.access === 'private' ? 'private' : 'public'
  if (!fileName) throw new Error('نام فایل پیوست الزامی است.')
  if (['xls', 'xlsx', 'csv'].includes(extension) && access !== 'private') {
    throw new Error('فایل‌های جدولی Excel/CSV باید خصوصی بارگذاری شوند.')
  }
  if (recordType === 'daily-activity' && access !== 'private') {
    throw new Error('پیوست‌های گزارش روزانه باید خصوصی باشند؛ خلاصه متنی برای انتشار عمومی نمایش داده می‌شود.')
  }

  if (access === 'private') {
    const pathname = typeof value.pathname === 'string' ? value.pathname.trim().slice(0, 2048) : ''
    if (!pathname || pathname.includes('://') || pathname.includes('..') || !pathname.startsWith(`province/${provinceId}/`)) throw new Error('شناسه فایل خصوصی معتبر نیست.')
    return {
      id,
      label: label || 'پیوست خصوصی',
      fileName,
      access,
      pathname,
      contentType: typeof value.contentType === 'string' ? value.contentType.slice(0, 160) : 'application/octet-stream',
      publishable: value.publishable === true && recordType !== 'daily-activity' && ['pdf','jpg','jpeg','png','webp','gif','doc','docx','ppt','pptx'].includes(extension) && pathname.split('.').pop()?.toLowerCase() === extension,
    }
  }

  const url = allowedUrl(value.url)
  if (!url) throw new Error('پیوند فایل عمومی پیوست الزامی است.')
  return { id, label: label || fileName, fileName, access, url, contentType: typeof value.contentType === 'string' ? value.contentType.slice(0, 160) : undefined }
}

function normalizeRecord(row: any) {
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
  return {
    ...data,
    id: String(row.id),
    provinceId: String(row.province_id),
    provinceName: String(row.province_name),
    sectionId: String(row.section_id),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : data.createdAt,
  }
}

function provinceSafeRecord(item: any) {
  return {
    ...item,
    attachments: Array.isArray(item.attachments)
      ? item.attachments.map((attachment: any) => attachment.access === 'private'
        ? { id: attachment.id, label: attachment.label, fileName: attachment.fileName, access: 'private', publishable: attachment.publishable === true }
        : attachment)
      : [],
  }
}

function parsePayload(body: any, provinceId: string, provinceName: string, id: string, createdAt: string) {
  const sectionId = body?.sectionId as ProvinceContentSectionId
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 200) : ''
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 6000) : ''
  const internalDetails = typeof body?.internalDetails === 'string' ? body.internalDetails.trim().slice(0, 20000) : ''
  const date = typeof body?.date === 'string' ? body.date.trim().slice(0, 80) : ''
  const recordType = body?.recordType === 'daily-activity' ? 'daily-activity' : 'content'
  const attachmentsInput = Array.isArray(body?.attachments) ? body.attachments : []
  if (attachmentsInput.length > 12) throw new Error('برای هر مورد حداکثر ۱۲ پیوست مجاز است.')
  if (!SECTIONS.has(sectionId)) throw new Error('بخش انتخاب‌شده معتبر نیست.')
  if (!title) throw new Error('عنوان محتوا الزامی است.')
  if (recordType === 'daily-activity' && !description) throw new Error('خلاصه عمومی گزارش روزانه الزامی است.')
  const attachments = attachmentsInput.map((item: any) => normalizeAttachment(item, recordType, provinceId))

  return {
    id,
    provinceId,
    provinceName,
    sectionId,
    title,
    description,
    date,
    recordType,
    internalDetails,
    attachments,
    // Legacy single-file records remain readable. New records use attachments[].
    attachmentUrl: allowedUrl(body?.attachmentUrl),
    attachmentName: typeof body?.attachmentName === 'string' ? body.attachmentName.trim().slice(0, 200) : '',
    linkUrl: allowedUrl(body?.linkUrl),
    createdAt,
    reviewStatus: 'pending' as const,
    revision: randomUUID(),
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end()
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Cookie')
  const publicId = req.method === 'GET' ? queryString(req.query.publicId) : undefined
  const session = getSession(req)
  if (!session && !publicId) return res.status(401).json({ error: 'برای ادامه ابتدا وارد شوید.' })
  const sql = getDb()
  if (!sql) return res.status(503).json({ error: 'پایگاه داده مشترک استان‌ها متصل نیست.' })

  try {
    await initDbIfNeeded()
    if (publicId) {
      const attachmentId = queryString(req.query.attachmentId)
      if (!attachmentId) return res.status(400).json({ error: 'شناسه فایل کامل نیست.' })
      const rows = await sql`SELECT data FROM province_content WHERE id = ${publicId} LIMIT 1;`
      const data = typeof rows[0]?.data === 'string' ? JSON.parse(rows[0].data) : rows[0]?.data
      const attachment = data && provinceStatus(data) === 'published' && data.recordType !== 'daily-activity' && Array.isArray(data.attachments) ? data.attachments.find((a: any) => a.id === attachmentId && a.access === 'private' && a.publishable === true && /\.(pdf|jpe?g|png|webp|gif|docx?|pptx?)$/i.test(a.fileName || '') && String(a.pathname || '').split('.').pop()?.toLowerCase() === String(a.fileName || '').split('.').pop()?.toLowerCase()) : null
      if (!attachment?.pathname) return res.status(404).json({ error: 'فایل منتشرشده پیدا نشد.' })
      const storeId = process.env.BLOB_STORE_ID
      if (!storeId) return res.status(503).json({ error: 'Store خصوصی Blob در دسترس نیست.' })
      const blob = await get(String(attachment.pathname), { access: 'private', storeId })
      if (!blob || blob.statusCode !== 200) return res.status(404).json({ error: 'فایل پیدا نشد.' })
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', blob.blob.contentType || 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(String(attachment.fileName || 'file').replace(/[\r\n"\\]/g, '_'))}`)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      Readable.fromWeb(blob.stream as any).pipe(res)
      return
    }
    if (!session) return res.status(401).json({ error: 'برای ادامه ابتدا وارد شوید.' })
    let allowedSections: ProvinceContentSectionId[] | null = null
    if (session.role === 'ostan') {
      const accountRows = await sql`SELECT active, allowed_sections FROM province_accounts WHERE province_id = ${session.provinceId} LIMIT 1;`
      const account = accountRows[0]
      if (!account || !account.active) return res.status(401).json({ error: 'حساب استان غیرفعال است.' })
      allowedSections = normalizeAllowedSections(account.allowed_sections)
    }

    if (req.method === 'GET') {
      const downloadId = queryString(req.query.downloadId)
      const attachmentId = queryString(req.query.attachmentId)
      if (downloadId || attachmentId) {
        if (session.role !== 'admin') return res.status(403).json({ error: 'دریافت فایل‌های خصوصی فقط برای دبیرخانه مجاز است.' })
        if (!downloadId || !attachmentId) return res.status(400).json({ error: 'شناسه فایل کامل نیست.' })
        const rows = await sql`SELECT data FROM province_content WHERE id = ${downloadId} LIMIT 1;`
        if (!rows[0]) return res.status(404).json({ error: 'محتوا پیدا نشد.' })
        const data = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data
        const attachment = Array.isArray(data.attachments)
          ? data.attachments.find((item: any) => item.id === attachmentId && item.access === 'private')
          : null
        if (!attachment?.pathname) return res.status(404).json({ error: 'فایل خصوصی پیدا نشد.' })
        const storeId = process.env.BLOB_STORE_ID
        if (!storeId) return res.status(503).json({ error: 'Store خصوصی Blob در دسترس نیست.' })
        const blob = await get(String(attachment.pathname), { access: 'private', storeId })
        if (!blob || blob.statusCode !== 200) return res.status(404).json({ error: 'فایل خصوصی پیدا نشد.' })
        const safeName = String(attachment.fileName || 'private-file').replace(/[\r\n"\\]/g, '_')
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('Content-Type', blob.blob.contentType || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`)
        res.setHeader('X-Content-Type-Options', 'nosniff')
        Readable.fromWeb(blob.stream as any).pipe(res)
        return
      }

      if (session.role === 'admin' && queryString(req.query.all) === '1') {
        const rows = await sql`SELECT id, province_id, province_name, section_id, data, created_at FROM province_content ORDER BY created_at DESC LIMIT 2000;`
        return res.status(200).json({ items: rows.map(normalizeRecord) })
      }

      const queryId = queryString(req.query.provinceId)
      const provinceId = session.role === 'admin' ? queryId : String(session.provinceId)
      if (!provinceId || !PROVINCE_UNITS.some(unit => unit.id === provinceId)) {
        return res.status(400).json({ error: 'شناسه استان معتبر نیست.' })
      }
      const rows = await sql`SELECT id, province_id, province_name, section_id, data, created_at FROM province_content WHERE province_id = ${provinceId} ORDER BY created_at DESC;`
      // Province accounts may read and maintain their own internal details; public settings expose only summaries and public attachments.
      const items = rows.map(normalizeRecord)
      return res.status(200).json({ items: session.role === 'ostan' ? items.map(provinceSafeRecord) : items })
    }

    if (req.method === 'PATCH') {
      if (session.role !== 'admin') return res.status(403).json({ error: 'بررسی محتوا فقط برای مدیر مجاز است.' })
      const body = jsonObjectBody(req)
      const id = typeof body.id === 'string' ? body.id : ''
      const revision = typeof body.revision === 'string' ? body.revision : ''
      const status = typeof body.reviewStatus === 'string' ? body.reviewStatus : ''
      const reviewNote = typeof body.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 2000) : ''
      if (!id || !['approved','rejected','published'].includes(status)) return res.status(400).json({ error: 'وضعیت بررسی معتبر نیست.' })
      const patch = JSON.stringify({ reviewStatus: status, reviewNote, reviewedAt: new Date().toISOString(), revision: randomUUID() })
      const rows = await sql`UPDATE province_content SET data = data || ${patch}::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = ${id} AND COALESCE(data->>'revision', '') = ${revision} AND (${status} <> 'published' OR COALESCE(data->>'reviewStatus', 'published') IN ('approved', 'published')) RETURNING id, province_id, province_name, section_id, data, created_at;`
      if (!rows.length) return res.status(409).json({ error: 'محتوا تغییر کرده یا هنوز تأیید نشده است؛ فهرست را تازه‌سازی کنید.' })
      return res.status(200).json({ item: normalizeRecord(rows[0]) })
    }

    if (session.role !== 'ostan' || !session.provinceId || !session.provinceName || !allowedSections) {
      return res.status(403).json({ error: 'این عملیات فقط از حساب استانی مجاز است.' })
    }
    const body = jsonObjectBody(req)

    if (req.method === 'POST') {
      const id = randomUUID()
      const item = parsePayload(body, session.provinceId, session.provinceName, id, new Date().toISOString())
      if (!allowedSections.includes(item.sectionId)) return res.status(403).json({ error: 'مدیر برای این استان دسترسی افزودن محتوا به این بخش را فعال نکرده است.' })
      const json = JSON.stringify(item)
      await sql`INSERT INTO province_content (id, province_id, province_name, section_id, data) VALUES (${id}, ${session.provinceId}, ${session.provinceName}, ${item.sectionId}, ${json}::jsonb);`
      return res.status(201).json({ item: provinceSafeRecord(item) })
    }

    if (req.method === 'PUT') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return res.status(400).json({ error: 'شناسه محتوا ارسال نشده است.' })
      const previousRows = await sql`SELECT data, section_id, created_at FROM province_content WHERE id = ${id} AND province_id = ${session.provinceId} LIMIT 1;`
      if (!previousRows[0]) return res.status(404).json({ error: 'محتوا پیدا نشد.' })
      const previous = typeof previousRows[0].data === 'string' ? JSON.parse(previousRows[0].data) : previousRows[0].data
      const originalSection = String(previousRows[0].section_id) as ProvinceContentSectionId
      if (!allowedSections.includes(originalSection)) return res.status(403).json({ error: 'مدیر دسترسی این استان به بخش اصلی محتوا را غیرفعال کرده است.' })
      const previousAttachments = Array.isArray(previous.attachments) ? previous.attachments : []
      const incomingAttachments = Array.isArray(body.attachments) ? body.attachments.map((attachment: any) => {
        if (attachment?.access !== 'private') return attachment
        const stored = previousAttachments.find((old: any) => old.id === attachment.id && old.access === 'private')
        return stored ? { ...attachment, pathname: stored.pathname, contentType: stored.contentType } : attachment
      }) : previousAttachments
      const item = parsePayload({ ...previous, ...body, attachments: incomingAttachments }, session.provinceId, session.provinceName, id, new Date(String(previousRows[0].created_at)).toISOString())
      if (!allowedSections.includes(item.sectionId)) return res.status(403).json({ error: 'مدیر برای این استان دسترسی ویرایش در بخش مقصد را فعال نکرده است.' })
      const json = JSON.stringify(item)
      const previousRevision = typeof previous.revision === 'string' ? previous.revision : ''
      const updated = await sql`UPDATE province_content SET province_name = ${session.provinceName}, section_id = ${item.sectionId}, data = ${json}::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = ${id} AND province_id = ${session.provinceId} AND COALESCE(data->>'revision', '') = ${previousRevision} RETURNING id;`
      if (!updated.length) return res.status(409).json({ error: 'محتوا هنگام ویرایش تغییر کرد؛ وضعیت را تازه‌سازی و دوباره تلاش کنید.' })
      return res.status(200).json({ item: provinceSafeRecord(item) })
    }

    if (req.method === 'DELETE') {
      const id = typeof body.id === 'string' ? body.id : ''
      if (!id) return res.status(400).json({ error: 'شناسه محتوا ارسال نشده است.' })
      const existing = await sql`SELECT section_id FROM province_content WHERE id = ${id} AND province_id = ${session.provinceId} LIMIT 1;`
      if (!existing[0]) return res.status(404).json({ error: 'محتوا پیدا نشد.' })
      if (!allowedSections.includes(String(existing[0].section_id) as ProvinceContentSectionId)) {
        return res.status(403).json({ error: 'مدیر دسترسی این استان به حذف محتوا از این بخش را غیرفعال کرده است.' })
      }
      const removed = await sql`DELETE FROM province_content WHERE id = ${id} AND province_id = ${session.provinceId} RETURNING id;`
      if (!removed.length) return res.status(404).json({ error: 'محتوا پیدا نشد.' })
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'روش درخواست پشتیبانی نمی‌شود.' })
  } catch (err: unknown) {
    if (err instanceof InvalidInputError) return res.status(400).json({ error: err.message })
    const message = err instanceof Error ? err.message : 'خطا در پردازش محتوا.'
    const status = /عنوان|پیوند|بخش|معتبر|پیوست|گزارش روزانه|Excel/i.test(message) ? 400 : 500
    if (status === 500) {
      console.error('Province content API failed:', err instanceof Error ? err.message : 'unknown error')
      return res.status(500).json({ error: 'پردازش محتوای استان انجام نشد.' })
    }
    return res.status(status).json({ error: message })
  }
}
