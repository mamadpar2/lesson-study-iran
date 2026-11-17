import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

/**
 * Local replacement for `@vercel/blob`, so the app can run on a normal VPS.
 *
 * - `put()` streams the request body to disk (public or private folder).
 * - `get()` returns the private file as a web ReadableStream, shaped exactly like
 *   the object the Vercel Blob SDK returns, so existing API handlers keep working.
 *
 * Public files are served by nginx/express at /uploads/public/... ; private files are
 * never exposed statically and only reachable through the authenticated API routes.
 */

export type BlobAccess = 'public' | 'private'

export interface PutOptions {
  access?: BlobAccess
  contentType?: string
  addRandomSuffix?: boolean
  storeId?: string
}

export interface PutResult {
  url: string
  downloadUrl: string
  pathname: string
  contentType: string
}

const STORAGE_ROOT = path.resolve(
  process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage'),
)
// Optional absolute prefix (e.g. https://lesson-study-iran.ir) for stored media URLs.
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || '').replace(/\/+$/, '')

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
}

export function contentTypeForName(pathname: string): string {
  const extension = pathname.split('.').pop()?.toLowerCase() || ''
  return CONTENT_TYPES[extension] || 'application/octet-stream'
}

export function storageRoot(): string {
  return STORAGE_ROOT
}

function normalizePathname(pathnameRaw: string): string {
  const pathname = pathnameRaw.replace(/\\/g, '/')
  const parts = pathname.split('/').filter((part) => part && part !== '.' && part !== '..')
  const clean = parts.join('/')
  if (!clean) throw new Error('Invalid storage pathname')
  return clean
}

function withRandomSuffix(pathname: string): string {
  const extension = path.posix.extname(pathname)
  const base = pathname.slice(0, pathname.length - extension.length)
  return `${base}-${randomUUID().replace(/-/g, '').slice(0, 10)}${extension}`
}

function absolutePath(access: BlobAccess, pathname: string): string {
  const rooted = path.join(STORAGE_ROOT, access === 'private' ? 'private' : 'public', pathname)
  const normalizedRoot = path.join(STORAGE_ROOT, access === 'private' ? 'private' : 'public')
  if (!rooted.startsWith(normalizedRoot)) throw new Error('Invalid storage pathname')
  return rooted
}

export function publicUrlFor(pathname: string): string {
  return `${MEDIA_BASE_URL}/uploads/public/${pathname}`
}

export async function put(
  pathnameRaw: string,
  body: unknown,
  options: PutOptions = {},
): Promise<PutResult> {
  const access: BlobAccess = options.access === 'private' ? 'private' : 'public'
  let pathname = normalizePathname(pathnameRaw)
  if (options.addRandomSuffix !== false) {
    // The original code relies on Blob's default of adding a random suffix; keep it so
    // two teachers uploading "form.pdf" never overwrite each other.
    pathname = withRandomSuffix(pathname)
  }
  const target = absolutePath(access, pathname)
  await mkdir(path.dirname(target), { recursive: true })

  if (body && typeof body === 'object' && 'pipe' in (body as object)) {
    await pipeline(body as NodeJS.ReadableStream, createWriteStream(target))
  } else if (body instanceof ReadableStream) {
    await pipeline(Readable.fromWeb(body as never), createWriteStream(target))
  } else if (body && typeof (body as Blob).arrayBuffer === 'function') {
    await writeFile(target, Buffer.from(await (body as Blob).arrayBuffer()))
  } else if (typeof body === 'string') {
    await writeFile(target, body)
  } else if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
    await writeFile(target, body as Uint8Array)
  } else {
    throw new Error('Unsupported upload body type')
  }

  const contentType = options.contentType || contentTypeForName(pathname)
  // Private objects must never get a public URL: they are only reachable through the
  // authenticated API routes, which look them up by pathname.
  const url = access === 'private' ? '' : publicUrlFor(pathname)
  return { url, downloadUrl: url, pathname, contentType }
}

export interface GetResult {
  statusCode: number
  blob: { contentType: string }
  stream: ReadableStream<Uint8Array>
}

export async function get(
  pathnameRaw: string,
  options: { access?: BlobAccess; storeId?: string } = {},
): Promise<GetResult | null> {
  const access: BlobAccess = options.access === 'private' ? 'private' : 'public'
  let pathname: string
  try {
    pathname = normalizePathname(pathnameRaw)
  } catch {
    return null
  }
  const target = absolutePath(access, pathname)
  try {
    const info = await stat(target)
    if (!info.isFile()) return null
  } catch {
    return null
  }
  const stream = Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>
  return {
    statusCode: 200,
    blob: { contentType: contentTypeForName(pathname) },
    stream,
  }
}

export async function del(pathnameRaw: string, options: { access?: BlobAccess } = {}) {
  const access: BlobAccess = options.access === 'private' ? 'private' : 'public'
  const pathname = normalizePathname(pathnameRaw)
  const { unlink } = await import('node:fs/promises')
  await unlink(absolutePath(access, pathname)).catch(() => undefined)
}
