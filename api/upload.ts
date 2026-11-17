import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { put } from '../lib/storage-local.js'
import { randomUUID } from 'node:crypto'
import { issueSubmissionUploadToken } from '../lib/submission-upload-token.js'
import { getDb } from '../lib/db.js'
import { getSession } from '../lib/server-auth.js'
import { enforceRateLimit } from '../lib/rate-limit.js'
import { campaignFileType, CAMPAIGN_MAX_UPLOAD_BYTES } from '../lib/campaign-files.js'

export const config = {
  api: { bodyParser: false },
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const SAFE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
}
const PRIVATE_ONLY_EXTENSIONS = new Set(['xls', 'xlsx', 'csv'])

function headerString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const accessHeader = headerString(req.headers['x-blob-access'])
  if (accessHeader !== 'public' && accessHeader !== 'private') {
    return res.status(400).json({ error: 'نوع دسترسی فایل معتبر نیست.' })
  }
  const access = accessHeader
  const uploadPurpose = headerString(req.headers['x-upload-purpose'])
  if (uploadPurpose && !['campaign-pdf', 'campaign-file', 'experience-submission'].includes(uploadPurpose)) {
    return res.status(400).json({ error: 'کاربرد بارگذاری فایل معتبر نیست.' })
  }
  const requestSession = getSession(req)
  const campaignPdfUpload = uploadPurpose === 'campaign-pdf'
  const campaignFileUpload = uploadPurpose === 'campaign-file'
  const campaignUpload = campaignPdfUpload || campaignFileUpload
  const submissionUpload = uploadPurpose === 'experience-submission'
  if (submissionUpload && access !== 'private') return res.status(400).json({ error: 'فایل تجربه فقط در فضای خصوصی پذیرفته می‌شود.' })
  if (campaignUpload && (access !== 'public' || requestSession?.role !== 'admin')) {
    return res.status(401).json({ error: 'بارگذاری فایل عمومی کمپین فقط برای مدیر مجاز است.' })
  }
  const session = access === 'private' ? requestSession : null
  if (access === 'private' && !submissionUpload) {
    if (!session || !['admin', 'ostan'].includes(session.role)) {
      return res.status(401).json({ status: 'error', error: 'آپلود به فضای خصوصی فقط برای حساب مجاز است.' })
    }
    if (session.role === 'ostan') {
      const sql = getDb()
      if (!sql) return res.status(503).json({ status: 'error', error: 'پایگاه داده حساب‌های استانی متصل نیست.' })
      try {
        const accountRows = await sql`SELECT active FROM province_accounts WHERE province_id = ${session.provinceId} LIMIT 1;`
        if (!accountRows[0]?.active) return res.status(401).json({ status: 'error', error: 'حساب استان غیرفعال است.' })
      } catch {
        return res.status(503).json({ status: 'error', error: 'بررسی مجوز بارگذاری استان انجام نشد.' })
      }
    }
  }

  let rawFilename = headerString(req.headers['x-filename']) || ''
  try {
    rawFilename = decodeURIComponent(rawFilename)
  } catch {
    return res.status(400).json({ error: 'نام فایل معتبر نیست.' })
  }
  const filename = rawFilename
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .replace(/\.\./g, '_')
    .trim()
    .slice(0, 200)
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  const contentType = campaignFileUpload ? campaignFileType(filename) : SAFE_TYPES[extension]
  if (
    !filename ||
    !contentType ||
    (access === 'public' && !campaignFileUpload && PRIVATE_ONLY_EXTENSIONS.has(extension)) ||
    (campaignPdfUpload && extension !== 'pdf') ||
    (submissionUpload && !['pdf', 'docx'].includes(extension))
  ) {
    return res.status(415).json({ error: 'نوع فایل یا مقصد بارگذاری مجاز نیست.' })
  }

  const rawLength = headerString(req.headers['content-length'])
  const contentLength = rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : NaN
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return res.status(411).json({ error: 'اندازه فایل مشخص نیست؛ بارگذاری لغو شد.' })
  }
  const maxBytes = campaignFileUpload
    ? CAMPAIGN_MAX_UPLOAD_BYTES
    : submissionUpload ? 3 * 1024 * 1024 : MAX_UPLOAD_BYTES
  if (contentLength > maxBytes) {
    return res.status(413).json({
      error: campaignFileUpload
        ? 'حداکثر اندازه فایل کمپین ۲۵۰ مگابایت است.'
        : 'حداکثر اندازه فایل در این مسیر ۴ مگابایت است.',
    })
  }

  const rateScope = submissionUpload ? 'experience-private-upload' : access === 'private'
    ? session?.role === 'admin' ? 'private-upload-admin' : 'private-upload-province'
    : getSession(req)?.role === 'admin' ? 'public-upload-admin' : 'public-upload-anonymous'
  // The authenticated admin may persist up to 200 private certificate pages in one save.
  // Allow that bounded batch while keeping other admin uploads at the normal throttle.
  const rateMax = !submissionUpload && access === 'private' && session?.role === 'admin'
    ? 240
    : rateScope.includes('admin') ? 60 : rateScope.includes('province') ? 30 : 5
  const rateWindow = rateScope.includes('admin') ? 60 : rateScope.includes('province') ? 10 * 60 : 10 * 60
  if (!(await enforceRateLimit(req, res, rateScope, rateMax, rateWindow))) return

  // Separate public and private Blob stores. Never fall back from private storage to a public store.
  const storeId = access === 'private'
    ? process.env.BLOB_STORE_ID
    : process.env.PUBLIC_BLOB_STORE_ID || process.env.BLOB_STORE_ID

  if (!storeId && !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({
      status: 'error',
      error: access === 'private'
        ? 'Store خصوصی Blob به این deployment وصل نیست؛ اتصال Store خصوصی Production را بررسی کنید.'
        : 'Store عمومی Blob به این deployment وصل نیست؛ اتصال Store عمومی Production را بررسی کنید.',
    })
  }
  if (access === 'private' && !storeId) {
    return res.status(503).json({ status: 'error', error: 'برای نگهداری خصوصی فایل اکسل، Store خصوصی Blob در دسترس نیست.' })
  }

  try {
    const uploadPath = submissionUpload ? `submissions/${randomUUID()}.${extension}` : access === 'private'
      ? `${session?.role === 'ostan' ? `province/${session.provinceId}` : 'admin'}/${filename}`
      : campaignUpload
        ? `campaign/documents/${filename}`
        : filename
    const blob = await put(uploadPath, req, {
      access,
      addRandomSuffix: !submissionUpload,
      contentType,
      ...(storeId ? { storeId } : {}),
    })
    if (submissionUpload) return res.status(200).json({ status: 'ok', uploadToken: issueSubmissionUploadToken(blob.pathname) })
    return res.status(200).json({
      status: 'ok',
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      contentType: blob.contentType,
    })
  } catch (err: unknown) {
    console.error('Blob upload failed:', err instanceof Error ? err.message : 'unknown error')
    return res.status(500).json({ error: 'بارگذاری فایل انجام نشد.' })
  }
}
