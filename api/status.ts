import type { VercelRequest, VercelResponse } from '../lib/vercel-types.js'
import { getDb, initDbIfNeeded } from '../lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const neonEnvFound = Boolean(
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL ||
    (process.env.POSTGRES_HOST && process.env.POSTGRES_USER)
  )

  // A connected Vercel Blob store exposes BLOB_STORE_ID and normally authenticates with OIDC.
  const blobEnvFound = Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
  const adminPassFound = Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET)

  let neonConnected = false
  let neonError: string | null = null
  let settingsCount = 0

  if (neonEnvFound) {
    try {
      const sql = getDb()
      if (sql) {
        if (!(await initDbIfNeeded())) throw new Error('Database initialization failed')
        const rows = await sql`
          SELECT count(*)::int as count FROM site_settings;
        `
        settingsCount = rows[0]?.count || 0
        neonConnected = true
      } else {
        neonError = 'تابع اتصال دیتابیس نئون با رشته اتصال مشخص‌شده راه‌اندازی نشد.'
      }
    } catch (err: unknown) {
      console.error('Backend status check failed:', err instanceof Error ? err.message : 'unknown error')
      neonError = 'اتصال پایگاه داده در دسترس نیست؛ تنظیمات سرور را بررسی کنید.'
    }
  } else {
    neonError = 'هیچ متغیر محیطی مربوط به نئون (مانند POSTGRES_URL یا DATABASE_URL) در پروژه یافت نشد.'
  }

  return res.status(200).json({
    ok: true,
    neon: {
      configured: neonEnvFound,
      connected: neonConnected,
      error: neonError,
      settingsCount,
    },
    blob: {
      configured: blobEnvFound,
    },
    auth: {
      passwordConfigured: adminPassFound,
    },
    timestamp: new Date().toISOString(),
  })
}
