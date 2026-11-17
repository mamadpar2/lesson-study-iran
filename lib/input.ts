import type { VercelRequest } from './vercel-types.js'

export class InvalidInputError extends Error {}

export function jsonObjectBody(req: VercelRequest): Record<string, unknown> {
  const contentType = String(req.headers['content-type'] || '').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    throw new InvalidInputError('درخواست باید با قالب JSON ارسال شود.')
  }

  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      throw new InvalidInputError('قالب داده ارسالی معتبر نیست.')
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InvalidInputError('داده ارسالی معتبر نیست.')
  }
  return body as Record<string, unknown>
}

export function textField(
  body: Record<string, unknown>,
  name: string,
  maxLength: number,
  required = false,
): string {
  const value = body[name]
  if (value === undefined || value === null || value === '') {
    if (required) throw new InvalidInputError(`فیلد ${name} الزامی است.`)
    return ''
  }
  if (typeof value !== 'string') throw new InvalidInputError(`فیلد ${name} معتبر نیست.`)
  const result = value.trim()
  if (result.length > maxLength || (required && !result)) {
    throw new InvalidInputError(`فیلد ${name} معتبر نیست.`)
  }
  return result
}

export function httpUrlField(value: string, name: string): string {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error()
    return url.toString()
  } catch {
    throw new InvalidInputError(`پیوند ${name} معتبر نیست.`)
  }
}

export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, digit => {
    const code = digit.charCodeAt(0)
    return String(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 : code - 0x0660)
  })
}
