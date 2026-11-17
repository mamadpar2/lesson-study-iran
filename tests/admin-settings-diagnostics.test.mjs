import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const apiClient = readFileSync(new URL('../lib/api-client.ts', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../components/pages/admin-page.tsx', import.meta.url), 'utf8')

test('admin settings failures surface HTTP status and safe API error instead of silently appearing as empty settings', () => {
  assert.match(apiClient, /درخواست تنظیمات کامل مدیر با HTTP \$\{res\.status\} ناموفق بود/)
  assert.match(apiClient, /if \(adminFull\) throw err/)
  assert.match(apiClient, /پاسخ API تنظیمات JSON نبود/)
})

test('admin editor remains fail-closed and displays the settings-load diagnostic', () => {
  assert.match(adminPage, /setAdminSettingsLoadError\(`دریافت تنظیمات کامل مدیر از سرور ممکن نشد؛ دوباره تلاش کنید\.\$\{detail\}`\)/)
  assert.match(adminPage, /if \(!fullSettings\)/)
})
