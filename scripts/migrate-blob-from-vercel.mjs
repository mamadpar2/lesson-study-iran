/**
 * One-time copy of every uploaded file from Vercel Blob to this server's disk,
 * plus rewriting the Blob URLs that are stored inside the database.
 *
 * Requirements (.env)
 *   BLOB_READ_WRITE_TOKEN   ← create it in Vercel → Storage → your store → Tokens
 *   BLOB_STORE_ID           ← the private store id (store_...)
 *   PUBLIC_BLOB_STORE_ID    ← the public store id (store_...)
 *   DATABASE_URL            ← local PostgreSQL (already migrated)
 *   STORAGE_ROOT            ← default ./storage
 *
 * Usage
 *   node scripts/migrate-blob-from-vercel.mjs --list      # only count files
 *   node scripts/migrate-blob-from-vercel.mjs             # download + rewrite URLs
 */
import 'dotenv/config'
import path from 'node:path'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { list, get } from '@vercel/blob'
import pg from 'pg'

const listOnly = process.argv.includes('--list')
const token = process.env.BLOB_READ_WRITE_TOKEN
const storageRoot = path.resolve(process.env.STORAGE_ROOT || './storage')

if (!token) {
  console.error('❌ BLOB_READ_WRITE_TOKEN لازم است (Vercel → Storage → store → Create token).')
  process.exit(1)
}

const stores = [
  { access: 'private', storeId: process.env.BLOB_STORE_ID },
  { access: 'public', storeId: process.env.PUBLIC_BLOB_STORE_ID },
].filter((store) => store.storeId)

if (!stores.length) {
  console.error('❌ BLOB_STORE_ID و PUBLIC_BLOB_STORE_ID در .env تنظیم نشده‌اند.')
  process.exit(1)
}

async function safeWrite(access, pathname, body) {
  const clean = pathname.split('/').filter((part) => part && part !== '.' && part !== '..').join('/')
  if (!clean) return false
  const target = path.join(storageRoot, access, clean)
  try {
    await stat(target)
    return false
  } catch {
    // not downloaded yet
  }
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, body)
  return true
}

let totalFiles = 0
let downloaded = 0
let bytes = 0

for (const store of stores) {
  let cursor
  do {
    const page = await list({ token, storeId: store.storeId, cursor, limit: 1000 })
    for (const blob of page.blobs) {
      totalFiles += 1
      if (listOnly) continue
      const result = await get(blob.pathname, { token, access: store.access, storeId: store.storeId })
      if (!result || result.statusCode !== 200) {
        console.warn(`✗ ${blob.pathname}: دریافت نشد`)
        continue
      }
      const chunks = []
      for await (const chunk of Readable.fromWeb(result.stream)) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)
      const wrote = await safeWrite(store.access, blob.pathname, buffer)
      if (wrote) {
        downloaded += 1
        bytes += buffer.length
      }
      if (downloaded % 50 === 0) console.log(`… ${downloaded} فایل (${(bytes / 1048576).toFixed(1)}MB)`)
    }
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
}

console.log(listOnly ? `ℹ️ ${totalFiles} فایل در Blob پیدا شد.` : `✅ ${downloaded} فایل دانلود شد (${(bytes / 1073741824).toFixed(2)}GB).`)

if (listOnly) process.exit(0)

// Older rows keep absolute Vercel Blob URLs; make them point at this server instead.
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL نبود؛ بازنویسی آدرس فایل‌ها در دیتابیس انجام نشد.')
  process.exit(0)
}

const local = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
const rewriteSql = `
  UPDATE site_settings
  SET data = regexp_replace(data::text, 'https?://[a-z0-9-]+\\.public\\.blob\\.vercel-storage\\.com/', '/uploads/public/', 'g')::jsonb
  WHERE data::text LIKE '%blob.vercel-storage.com%'
`
const { rowCount } = await local.query(rewriteSql).catch((error) => {
  console.warn('⚠️ بازنویسی آدرس‌ها انجام نشد:', error.message)
  return { rowCount: 0 }
})
await local.end()
console.log(`✅ آدرس ${rowCount ?? 0} ردیف تنظیمات به مسیر محلی تغییر کرد.`)
console.log('ℹ️ اگر ستون file_url در جدول experiences هم آدرس Blob دارد، همان regexp_replace را روی آن هم اجرا کنید.')
