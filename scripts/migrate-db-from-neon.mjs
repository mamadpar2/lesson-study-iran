/**
 * One-time copy of every table from Neon to the local PostgreSQL on this server.
 *
 * Requirements
 *   - `.env` must contain DATABASE_URL (local) and NEON_URL (old Neon connection string).
 *   - Run `npx tsx scripts/init-db.mts` first, so the schema already exists locally.
 *
 * Usage
 *   node scripts/migrate-db-from-neon.mjs           # copies data
 *   node scripts/migrate-db-from-neon.mjs --dry-run # only reports row counts
 *
 * The script never deletes anything. Existing local rows are kept (ON CONFLICT DO NOTHING),
 * so it is safe to run twice.
 */
import 'dotenv/config'
import pg from 'pg'
import { neon } from '@neondatabase/serverless'

const dryRun = process.argv.includes('--dry-run')
const localUrl = process.env.DATABASE_URL
const neonUrl = process.env.NEON_URL

if (!localUrl || !neonUrl) {
  console.error('❌ هر دو DATABASE_URL و NEON_URL باید در .env باشند.')
  process.exit(1)
}

const local = new pg.Pool({ connectionString: localUrl, max: 4 })
const remote = neon(neonUrl)

/** Copy order matters only for readability; the schema has no foreign keys. */
const TABLES = [
  'site_settings',
  'experiences',
  'content_submissions',
  'registrations',
  'in_person_registrations',
  'webinar_attendance_registrations',
  'campaign_pledges',
  'province_accounts',
  'province_content',
  'api_rate_limits',
]

async function tableColumns(table) {
  const { rows } = await local.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  )
  return rows.map((row) => row.column_name)
}

async function copyTable(table) {
  let rows
  try {
    rows = await remote(`SELECT * FROM ${table}`)
  } catch (error) {
    console.warn(`⚠️  ${table}: خواندن از Neon ناموفق بود (${error.message}) — رد شد.`)
    return { copied: 0, skipped: true }
  }
  if (!rows.length) {
    console.log(`• ${table}: خالی`)
    return { copied: 0 }
  }
  if (dryRun) {
    console.log(`• ${table}: ${rows.length} ردیف (dry-run)`)
    return { copied: 0 }
  }

  const localColumns = await tableColumns(table)
  const columns = Object.keys(rows[0]).filter((column) => localColumns.includes(column))
  const missing = Object.keys(rows[0]).filter((column) => !localColumns.includes(column))
  if (missing.length) console.warn(`  ↳ ستون‌های موجود نبود و رد شدند: ${missing.join(', ')}`)
  if (!columns.length) {
    console.warn(`  ↳ ${table}: هیچ ستون مشترکی پیدا نشد — رد شد.`)
    return { copied: 0, skipped: true }
  }

  const columnList = columns.map((column) => `"${column}"`).join(', ')
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
  const statement = `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`

  let copied = 0
  for (const row of rows) {
    const values = columns.map((column) => {
      const value = row[column]
      return value !== null && typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : value
    })
    try {
      const result = await local.query(statement, values)
      copied += result.rowCount ?? 0
    } catch (error) {
      console.warn(`  ↳ ${table}: یک ردیف رد شد (${error.message})`)
    }
  }
  console.log(`• ${table}: ${copied} از ${rows.length} ردیف منتقل شد`)
  return { copied }
}

async function resetSequences() {
  const { rows } = await local.query(`
    SELECT c.relname AS table_name, a.attname AS column_name
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid
    JOIN pg_depend d ON d.objid = a.attrelid AND d.refobjid = c.oid
    WHERE c.relkind = 'S' AND a.attnum > 0
  `).catch(() => ({ rows: [] }))
  if (!rows.length) return
  for (const row of rows) {
    await local.query(
      `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX("${row.column_name}") FROM "${row.table_name}"), 1))`,
      [row.table_name, row.column_name],
    ).catch(() => undefined)
  }
  console.log('↺ شمارنده‌های سری بازنشانی شدند.')
}

let total = 0
for (const table of TABLES) {
  const result = await copyTable(table)
  total += result.copied
}
if (!dryRun) await resetSequences()

await local.end()
console.log(dryRun ? '✅ dry-run تمام شد.' : `✅ انتقال دیتابیس تمام شد (${total} ردیف).`)
