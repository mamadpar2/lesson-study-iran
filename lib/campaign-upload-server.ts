import type { VercelRequest, VercelResponse } from './vercel-types.js'

/**
 * VPS port notice.
 *
 * On Vercel, the browser uploaded large campaign files straight to Blob using a presigned
 * token minted here. On our own server that is unnecessary: files are streamed through
 * `/api/upload` (see `components/pages/admin-page.tsx`), which writes them to local disk.
 *
 * The route is kept so an old cached browser bundle gets a clear answer instead of a crash.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(410).json({
    error: 'بارگذاری مستقیم (presigned) در این نصب غیرفعال است؛ صفحه را رفرش کنید و دوباره فایل را انتخاب کنید.',
  })
}
