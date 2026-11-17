import pg from 'pg'

/**
 * VPS port: the app was written for Neon's HTTP driver. On our own server we talk to a
 * local PostgreSQL instance with node-postgres, keeping the exact same tagged-template
 * API (`sql\`...\`` -> rows[]) so none of the queries in the app had to change.
 */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<any[]>

let pool: pg.Pool | null = null
let poolConnectionString = ''
let sqlClient: SqlClient | null = null

function resolveConnectionString(): string | null {
  let connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.NEON_DATABASE_URL

  // Separate PG* variables are still supported (for example PGHOST/PGUSER from a panel).
  if (!connectionString && process.env.POSTGRES_HOST && process.env.POSTGRES_USER) {
    const user = encodeURIComponent(process.env.POSTGRES_USER)
    const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || '')
    const host = process.env.POSTGRES_HOST
    const db = process.env.POSTGRES_DATABASE || 'postgres'
    const ssl = process.env.DATABASE_SSL === 'false' ? '' : '?sslmode=require'
    connectionString = `postgres://${user}:${pass}@${host}/${db}${ssl}`
  }

  if (!connectionString) {
    // A local install usually has everything on the same socket/host: fall back to PG defaults.
    if (process.env.PGDATABASE) {
      connectionString = `postgres://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(process.env.PGPASSWORD || '')}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || '5432'}/${process.env.PGDATABASE}`
    }
  }

  return connectionString || null
}

function buildSqlClient(connectionString: string): SqlClient {
  if (!pool || poolConnectionString !== connectionString) {
    if (pool) void pool.end().catch(() => undefined)
    pool = new pg.Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ...(process.env.DATABASE_SSL === 'false' ? { ssl: false } : {}),
    })
    pool.on('error', (error) => {
      console.error('PostgreSQL pool error:', error instanceof Error ? error.message : 'unknown error')
    })
    poolConnectionString = connectionString
  }
  const activePool = pool

  return async function sql(strings: TemplateStringsArray, ...values: unknown[]) {
    let text = strings[0]
    for (let index = 0; index < values.length; index += 1) {
      text += `$${index + 1}${strings[index + 1]}`
    }
    // Without parameters, node-postgres uses the simple protocol, which allows the
    // multi-statement DDL blocks used by initDbIfNeeded(). Passing an empty values array
    // would switch to the extended protocol and reject those blocks.
    const result = values.length
      ? await activePool.query(text, values as any[])
      : await activePool.query(text)
    // node-postgres returns an array of results when the text holds several statements.
    if (Array.isArray(result)) {
      const last = result[result.length - 1] as pg.QueryResult | undefined
      return (last?.rows ?? []) as any[]
    }
    return ((result as pg.QueryResult).rows ?? []) as any[]
  }
}

export function getDb(): SqlClient | null {
  const connectionString = resolveConnectionString()
  if (!connectionString) return null
  try {
    sqlClient = buildSqlClient(connectionString)
    return sqlClient
  } catch (err) {
    console.error('Failed to create PostgreSQL client:', err)
    return null
  }
}

export async function closeDb() {
  if (pool) {
    await pool.end().catch(() => undefined)
    pool = null
    sqlClient = null
  }
}

let dbInitialized = false

export async function initDbIfNeeded() {
  if (dbInitialized) return true

  const sql = getDb()
  if (!sql) return false

  try {
    // 1. Settings table with JSONB data
    await sql`
      CREATE TABLE IF NOT EXISTS site_settings (
        id VARCHAR(50) PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `

    // 2. Experiences table
    await sql`
      CREATE TABLE IF NOT EXISTS experiences (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        school VARCHAR(200) NOT NULL,
        province VARCHAR(100) NOT NULL,
        email VARCHAR(150),
        kind VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        summary TEXT,
        file_name VARCHAR(255),
        file_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
    // Safe additions for expanded lived-experience submissions; older records remain intact.
    await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS national_code VARCHAR(10);`
    await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS personnel_code VARCHAR(8);`
    await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS service_years INTEGER;`
    await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS district VARCHAR(150);`
    await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS phone VARCHAR(11);`
    await sql`ALTER TABLE experiences ADD COLUMN IF NOT EXISTS private_file_path TEXT;`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS experiences_national_code_unique ON experiences (national_code) WHERE national_code IS NOT NULL;`

    // Private submissions for the public content-production form; reads are admin-only.
    await sql`
      CREATE TABLE IF NOT EXISTS content_submissions (
        id VARCHAR(50) PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        national_code VARCHAR(10) NOT NULL,
        personnel_code VARCHAR(8) NOT NULL,
        province VARCHAR(100) NOT NULL,
        district VARCHAR(150) NOT NULL,
        grade VARCHAR(100) NOT NULL,
        phone VARCHAR(11) NOT NULL,
        email VARCHAR(150) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        media_link TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
    await sql`CREATE INDEX IF NOT EXISTS content_submissions_created_at_idx ON content_submissions (created_at DESC);`

    // 3. Registrations table (webinars & in-person)
    await sql`
      CREATE TABLE IF NOT EXISTS registrations (
        id VARCHAR(50) PRIMARY KEY,
        event_id VARCHAR(50) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        national_code VARCHAR(20) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        school VARCHAR(200),
        province VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `

    // In-person registrations are server-owned; never store personal information in the browser.
    await sql`
      CREATE TABLE IF NOT EXISTS in_person_registrations (
        id VARCHAR(50) PRIMARY KEY,
        event_id VARCHAR(120) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        national_code VARCHAR(10) NOT NULL,
        phone VARCHAR(30) NOT NULL,
        school VARCHAR(200) NOT NULL,
        province VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (event_id, national_code)
      );
    `
    await sql`CREATE INDEX IF NOT EXISTS in_person_registrations_event_created_idx ON in_person_registrations (event_id, created_at DESC);`

    // Private public-form attendance registrations for individual webinars.
    // These records are intentionally separate from the legacy registrations table and are never included in public settings.
    await sql`
      CREATE TABLE IF NOT EXISTS webinar_attendance_registrations (
        id VARCHAR(50) PRIMARY KEY,
        webinar_id VARCHAR(120) NOT NULL,
        full_name VARCHAR(150) NOT NULL,
        personnel_code VARCHAR(12) NOT NULL,
        province VARCHAR(100) NOT NULL,
        district VARCHAR(150) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (webinar_id, personnel_code)
      );
    `
    await sql`CREATE INDEX IF NOT EXISTS webinar_attendance_registrations_created_idx ON webinar_attendance_registrations (webinar_id, created_at ASC);`

    // 4. Campaign Pledges table
    await sql`
      CREATE TABLE IF NOT EXISTS campaign_pledges (
        id VARCHAR(50) PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        province VARCHAR(100) NOT NULL,
        school VARCHAR(200),
        pledge_text TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
    // Keep existing registrations and their unique index; expand only columns
    // narrower than ten characters, never shrink an existing wider column.
    await sql`ALTER TABLE campaign_pledges ADD COLUMN IF NOT EXISTS personnel_code VARCHAR(10);`
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'campaign_pledges'
            AND column_name = 'personnel_code' AND data_type = 'character varying'
            AND character_maximum_length < 10
        ) THEN
          ALTER TABLE campaign_pledges ALTER COLUMN personnel_code TYPE VARCHAR(10);
        END IF;
      END $$;
    `
    await sql`ALTER TABLE campaign_pledges ADD COLUMN IF NOT EXISTS grade VARCHAR(100);`
    await sql`ALTER TABLE campaign_pledges ADD COLUMN IF NOT EXISTS district VARCHAR(150);`
    await sql`ALTER TABLE campaign_pledges ADD COLUMN IF NOT EXISTS phone VARCHAR(11);`
    await sql`CREATE INDEX IF NOT EXISTS campaign_pledges_created_at_idx ON campaign_pledges (created_at DESC);`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS campaign_pledges_personnel_code_unique ON campaign_pledges (personnel_code) WHERE personnel_code IS NOT NULL;`

    // 5. Provincial user accounts (passwords are stored only as scrypt hashes)
    await sql`
      CREATE TABLE IF NOT EXISTS province_accounts (
        province_id VARCHAR(80) PRIMARY KEY,
        province_name VARCHAR(160) NOT NULL,
        username VARCHAR(80) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        allowed_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
    // Safe migration for account tables created before per-province section permissions.
    await sql`ALTER TABLE province_accounts ADD COLUMN IF NOT EXISTS allowed_sections JSONB NOT NULL DEFAULT '[]'::jsonb;`

    // 6. Direct-published content submitted by provincial accounts
    await sql`
      CREATE TABLE IF NOT EXISTS province_content (
        id VARCHAR(80) PRIMARY KEY,
        province_id VARCHAR(80) NOT NULL,
        province_name VARCHAR(160) NOT NULL,
        section_id VARCHAR(80) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
    await sql`CREATE INDEX IF NOT EXISTS province_content_section_idx ON province_content(section_id, created_at DESC);`

    // Store only HMACs of client addresses; never persist raw IP addresses.
    await sql`
      CREATE TABLE IF NOT EXISTS api_rate_limits (
        scope VARCHAR(80) NOT NULL,
        subject_hash CHAR(64) NOT NULL,
        window_start BIGINT NOT NULL,
        hit_count INTEGER NOT NULL CHECK (hit_count > 0),
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        PRIMARY KEY (scope, subject_hash, window_start)
      );
    `
    await sql`CREATE INDEX IF NOT EXISTS api_rate_limits_expiry_idx ON api_rate_limits(expires_at);`

    dbInitialized = true
    return true
  } catch (err) {
    console.error('Database initialization error:', err)
    return false
  }
}
