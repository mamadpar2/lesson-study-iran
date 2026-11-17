import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'

import adminAuth from '../api/admin-auth.js'
import certificateMedia from '../api/certificate-media.js'
import experiences from '../api/experiences.js'
import ostanAuth from '../api/ostan-auth.js'
import pledges from '../api/pledges.js'
import provinceAccounts from '../api/province-accounts.js'
import provinceContent from '../api/province-content.js'
import registrations from '../api/registrations.js'
import session from '../api/session.js'
import settings from '../api/settings.js'
import status from '../api/status.js'
import upload from '../api/upload.js'
import { storageRoot } from '../lib/storage-local.js'

/**
 * Self-hosted entry point.
 *
 * The project was written as Vite (static frontend) + Vercel serverless functions (api/*.ts).
 * This server re-creates that contract on a plain VPS:
 *   /            -> built SPA in dist/ (with the SPA fallbacks from vercel.json)
 *   /api/<name>  -> the corresponding api/<name>.ts handler (same req/res signatures)
 *   /uploads/*   -> public uploaded files, streamed from ./storage/public
 *
 * Run it with PM2 (or the panel's supervisor) so it stays alive and restarts on reboot.
 */

type VercelLikeHandler = (req: any, res: any) => unknown

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.resolve(process.env.WEB_ROOT || path.join(projectRoot, 'dist'))
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '127.0.0.1'
const bodyLimit = process.env.JSON_BODY_LIMIT || '12mb'

const routes: Record<string, VercelLikeHandler> = {
  'admin-auth': adminAuth,
  'certificate-media': certificateMedia,
  experiences,
  'ostan-auth': ostanAuth,
  pledges,
  'province-accounts': provinceAccounts,
  'province-content': provinceContent,
  registrations,
  session,
  settings,
  status,
  upload,
}

const app = express()
app.set('trust proxy', true)
app.disable('x-powered-by')

async function runHandler(handler: VercelLikeHandler, req: IncomingMessage, res: ServerResponse) {
  try {
    await handler(req as any, res as any)
  } catch (error) {
    console.error(`API error on ${req.method} ${req.url}:`, error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'خطای داخلی سرور رخ داد.' }))
    }
  }
}

// The upload route reads the raw request stream, so it must be mounted before any body parser.
app.all('/api/upload', (req, res) => {
  void runHandler(upload, req, res)
})

app.use(express.json({ limit: bodyLimit }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

app.all('/api/:name', (req, res) => {
  const name = String(req.params.name || '')
  const handler = routes[name]
  if (!handler) {
    res.status(404).json({ error: 'مسیر API یافت نشد.' })
    return
  }
  void runHandler(handler, req, res)
})

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

// Public uploads. Private uploads live outside this folder and stay behind /api routes.
app.use(
  '/uploads',
  express.static(path.join(storageRoot(), 'public'), {
    index: false,
    fallthrough: true,
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff')
    },
  }),
)

app.use(
  express.static(distDir, {
    index: false,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (/[/\\]assets[/\\]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    },
  }),
)

// SPA fallback mirroring vercel.json rewrites (/admin, /ostan, /province/*, /webinar-registration/*).
app.use((req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next()
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path === '/healthz') return next()
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(distDir, 'index.html'), (error) => {
    if (error) next(error)
  })
})

async function main() {
  await mkdir(path.join(storageRoot(), 'public'), { recursive: true })
  await mkdir(path.join(storageRoot(), 'private'), { recursive: true })
  app.listen(port, host, () => {
    console.log(`[lesson-study] listening on http://${host}:${port}`)
    console.log(`[lesson-study] web root: ${distDir}`)
    console.log(`[lesson-study] storage root: ${storageRoot()}`)
  })
}

void main()
