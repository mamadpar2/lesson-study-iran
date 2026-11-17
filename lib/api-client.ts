import type { HomepageSettings, Experience, InPersonRegistration, CampaignPledge } from '@/src/types'
import { CAMPAIGN_MAX_UPLOAD_BYTES } from './campaign-files.js'

export interface BackendStatus {
  ok: boolean
  neon: {
    configured: boolean
    connected: boolean
    error: string | null
    settingsCount: number
  }
  blob: {
    configured: boolean
  }
  auth: {
    passwordConfigured: boolean
  }
}

/**
 * Check Neon DB and Vercel Blob health status
 */
export async function checkBackendStatus(): Promise<BackendStatus | null> {
  try {
    const res = await fetch('/api/status')
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) return null
    return (await res.json()) as BackendStatus
  } catch {
    return null
  }
}

/**
 * Upload a file (photo, document, PDF) to Vercel Blob via /api/upload
 */
export type BlobAccess = 'public' | 'private'
export type BlobUploadPurpose = 'campaign-pdf' | 'campaign-file' | 'experience-submission'
export const MAX_BLOB_UPLOAD_BYTES = 4 * 1024 * 1024

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

export async function uploadToBlob(
  file: File,
  access: BlobAccess = 'public',
  purpose?: BlobUploadPurpose,
): Promise<{ url: string; downloadUrl?: string; pathname?: string; uploadToken?: string; contentType?: string; error?: string }> {
  if (file.size <= 0) return { url: '', error: 'فایل خالی قابل بارگذاری نیست.' }
  const maxBytes = purpose === 'campaign-file' ? CAMPAIGN_MAX_UPLOAD_BYTES : MAX_BLOB_UPLOAD_BYTES
  if (file.size > maxBytes) {
    return {
      url: '',
      error: purpose === 'campaign-file'
        ? 'حداکثر اندازه فایل کمپین ۲۵۰ مگابایت است.'
        : 'حداکثر اندازه فایل در این مسیر ۴ مگابایت است.',
    }
  }
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'x-filename': encodeURIComponent(file.name),
        'x-blob-access': access,
        ...(purpose ? { 'x-upload-purpose': purpose } : {}),
      },
      body: file,
    })

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return { url: '', error: `ذخیره پایدار فایل ممکن نشد (HTTP ${res.status}).` }
    }

    const data = await res.json()
    if (res.ok && (purpose === 'experience-submission' ? data.uploadToken : access === 'private' ? data.pathname : data.url)) {
      return {
        url: data.url || '',
        downloadUrl: data.downloadUrl,
        pathname: data.pathname,
        uploadToken: data.uploadToken,
        contentType: data.contentType,
      }
    }
    return { url: '', error: data.error || data.message || 'اتصال Vercel Blob برای ذخیره فایل فعال نیست.' }
  } catch (err) {
    console.warn('Vercel Blob upload failed:', err)
    return { url: '', error: err instanceof Error ? err.message : 'اتصال به Vercel Blob برقرار نشد.' }
  }
}

/**
 * Sync homepage settings with Neon Postgres via /api/settings
 */
const SETTINGS_ETAG_KEY = 'dars:homepage-settings-etag'

/**
 * Replace large inline data URLs with durable Blob URLs before writing settings to Neon.
 * This keeps binary files out of the database row and avoids repeated Neon egress.
 */
export async function externalizeDataUrls<T>(value: T): Promise<T> {
  const uploaded = new Map<string, Promise<unknown>>()
  let sequence = 0

  const visit = async (item: unknown, fieldName = ''): Promise<unknown> => {
    if (typeof item === 'string') {
      if (item.startsWith('blob:')) {
        throw new Error('این فایل فقط در حافظه موقت مرورگر است؛ دوباره بارگذاری‌اش کنید تا در Vercel Blob ذخیره شود.')
      }
      if (!item.startsWith('data:')) return item

      // Raw attendance workbooks, original DOCX templates, and certificate images may
      // contain personal data. Keep them in the existing private store; only public
      // presentation assets are uploaded to the public store.
      const privateFields = new Set([
        'attendeesExcelUrl',
        'certificateTemplateUrl',
        'certificateDocxTemplateUrl',
        'certificatesPdfUrl',
        'certificateImageUrl',
      ])
      const access: BlobAccess = privateFields.has(fieldName) ? 'private' : 'public'
      const cacheKey = `${access}:${item}`
      const existing = uploaded.get(cacheKey)
      if (existing) return existing

      const task = (async () => {
        const blob = await fetch(item).then(response => response.blob())
        if (blob.size < 4096) return item
        const mime = (blob.type || 'application/octet-stream').split(';')[0].trim().toLowerCase()
        const extension = MIME_EXTENSIONS[mime] || mime.split('/')[1]?.split('+')[0]?.replace(/[^a-z0-9]/gi, '') || 'bin'
        const file = new File([blob], `site-media-${Date.now()}-${sequence++}.${extension}`, { type: mime })
        const result = await uploadToBlob(file, access)
        if (access === 'private') {
          if (!result.pathname) throw new Error(result.error || 'فایل خصوصی در Store خصوصی ذخیره نشد؛ اتصال همان Store را بررسی کنید.')
          return {
            access: 'private' as const,
            pathname: result.pathname,
            contentType: result.contentType || mime,
          }
        }
        if (!result.url) throw new Error(result.error || 'برای ذخیره پایدار فایل، اتصال مناسب Vercel Blob را بررسی کنید.')
        return result.url
      })()
      uploaded.set(cacheKey, task)
      return task
    }

    if (Array.isArray(item)) {
      const result: unknown[] = []
      for (let i = 0; i < item.length; i += 3) {
        result.push(...await Promise.all(item.slice(i, i + 3).map(child => visit(child))))
      }
      return result
    }

    if (item && typeof item === 'object') {
      const entries = await Promise.all(Object.entries(item).map(async ([key, child]) => [key, await visit(child, key)] as const))
      return Object.fromEntries(entries)
    }

    return item
  }

  return await visit(value) as T
}

export async function fetchServerSettings(options: { adminFull?: boolean } = {}): Promise<HomepageSettings | null> {
  const adminFull = options.adminFull === true
  try {
    let etag: string | null = null
    if (!adminFull) {
      try {
        const cached = localStorage.getItem('dars:homepage-settings')
        const hasUsableCache = Boolean(cached && (JSON.parse(cached) as HomepageSettings)?.hubBoxes)
        if (hasUsableCache) etag = localStorage.getItem(SETTINGS_ETAG_KEY)
      } catch {}
    }
    const res = await fetch(adminFull ? '/api/settings?view=admin' : '/api/settings', {
      credentials: 'same-origin',
      cache: adminFull ? 'no-store' : 'default',
      headers: etag ? { 'If-None-Match': etag } : undefined,
    })
    if (res.status === 304) {
      if (adminFull) throw new Error('سرور برای تنظیمات کامل پاسخ 304 فرستاد؛ درخواست پنل مدیر باید بدون cache باشد.')
      return null
    }

    const contentType = res.headers.get('content-type') || ''
    if (!res.ok) {
      let detail = ''
      if (contentType.includes('application/json')) {
        const errorBody = await res.json().catch(() => null)
        const serverMessage = errorBody?.error || errorBody?.message
        if (typeof serverMessage === 'string') detail = `: ${serverMessage.slice(0, 220)}`
      }
      if (adminFull) throw new Error(`درخواست تنظیمات کامل مدیر با HTTP ${res.status} ناموفق بود${detail}`)
      return null
    }

    if (!contentType.includes('application/json')) {
      if (adminFull) throw new Error(`پاسخ API تنظیمات JSON نبود (HTTP ${res.status})؛ مسیر /api/settings را در استقرار بررسی کنید.`)
      console.warn('Expected JSON response from /api/settings, but received HTML (check vercel.json rewrites)')
      return null
    }

    const nextEtag = res.headers.get('ETag')
    if (nextEtag) {
      try { localStorage.setItem(SETTINGS_ETAG_KEY, nextEtag) } catch {}
    }
    const json = await res.json()
    if (json.status === 'ok' && json.data) {
      return json.data as HomepageSettings
    }
    if (adminFull) {
      const serverMessage = json?.error || json?.message
      throw new Error(typeof serverMessage === 'string' ? serverMessage.slice(0, 220) : 'سرور داده کامل پنل مدیر را برنگرداند.')
    }
  } catch (err) {
    if (adminFull) throw err
    console.warn('Neon DB settings fetch skipped (running offline/local):', err)
  }
  return null
}

export async function saveServerSettings(
  settings: HomepageSettings
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        error: 'مسیر API به صفحه اصلی بازنویسی شده است؛ لطفاً تنظیمات vercel.json را بررسی نمایید.',
      }
    }

    const json = await res.json()
    if (res.ok && json.status === 'saved') {
      const etag = res.headers.get('ETag')
      if (etag) {
        try { localStorage.setItem(SETTINGS_ETAG_KEY, etag) } catch {}
      }
      return { ok: true, message: 'اطلاعات با موفقیت در پایگاه داده نئون ذخیره شد.' }
    }

    return {
      ok: false,
      error: json.error || json.message || 'خطا در ثبت اطلاعات در دیتابیس نئون',
    }
  } catch (err: any) {
    console.warn('Neon DB settings save failed:', err)
    return {
      ok: false,
      error: err?.message || 'خطا در برقراری ارتباط با پایگاه داده نئون',
    }
  }
}

/**
 * Save experience to Neon DB
 */
export async function saveExperienceToNeon(exp: Experience): Promise<{ ok: boolean; error?: string; status?: number; id?: string }> {
  try {
    const res = await fetch('/api/experiences', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exp),
    })
    const data = await res.json().catch(() => null)
    return res.ok
      ? { ok: true, id: typeof data?.id === 'string' ? data.id : undefined }
      : { ok: false, status: res.status, error: data?.error || data?.message || `ثبت تجربه در پایگاه داده ناموفق بود (HTTP ${res.status}).` }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ارتباط با پایگاه داده برقرار نشد.' }
  }
}

/**
 * Save pledge to Neon DB
 */
export async function savePledgeToNeon(pledge: CampaignPledge): Promise<boolean> {
  try {
    const res = await fetch('/api/pledges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: pledge.fullName,
        personnelCode: pledge.personnelCode,
        province: pledge.province,
        grade: pledge.grade,
        district: pledge.district,
        phone: pledge.phone,
        school: pledge.school,
        pledgeText: pledge.pledgeText,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Save registration to Neon DB
 */
export async function saveRegistrationToNeon(reg: InPersonRegistration): Promise<boolean> {
  try {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reg),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Verify admin password with serverless /api/admin-auth
 */
export async function verifyAdminPassword(password: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch('/api/admin-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password }),
    })
    const contentType = res.headers.get('content-type') || ''
    const rawBody = await res.text()
    let data: any = null
    try { data = rawBody ? JSON.parse(rawBody) : null } catch {}
    if (!contentType.includes('application/json') || !data || typeof data !== 'object') {
      const requestId = res.headers.get('x-vercel-id')
      const idHint = requestId ? ` شناسه درخواست Vercel: ${requestId}.` : ''
      return {
        ok: false,
        message: `تابع /api/admin-auth به‌جای JSON پاسخ غیرمنتظره داد (HTTP ${res.status}). مسیر /admin باز شده، اما خطا در اجرای API احراز هویت یا استقرار آن است؛ گزارش Functions برای api/admin-auth را بررسی کنید.${idHint}`
      }
    }
    if (res.ok && data.ok) return { ok: true, message: data.message }
    return { ok: false, message: data.message || `ورود ناموفق بود (HTTP ${res.status}).` }
  } catch {
    return { ok: false, message: 'ارتباط با /api/admin-auth برقرار نشد؛ استقرار تابع API و گزارش Functions در Vercel را بررسی کنید.' }
  }
}
