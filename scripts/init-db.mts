/**
 * Creates every table/index the app needs in the local PostgreSQL database.
 * Run it once on the server, before the first start:
 *
 *   npx tsx scripts/init-db.mts
 */
import 'dotenv/config'
import { initDbIfNeeded, getDb, closeDb } from '../lib/db.js'

const sql = getDb()
if (!sql) {
  console.error('❌ DATABASE_URL تنظیم نشده است. فایل .env را بررسی کنید.')
  process.exit(1)
}

const ok = await initDbIfNeeded()
console.log(ok ? '✅ جداول ساخته شد.' : '❌ ساخت جداول انجام نشد.')
await closeDb()
process.exit(ok ? 0 : 1)
