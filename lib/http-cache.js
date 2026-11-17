import { createHash } from 'node:crypto'

export function buildSettingsEtag(settingsUpdatedAt, provinceCount, provinceUpdatedAt, scope = 'settings-v1') {
  const revision = [scope, settingsUpdatedAt || '', String(provinceCount || 0), provinceUpdatedAt || ''].join('|')
  return `"${createHash('sha256').update(revision).digest('base64url')}"`
}

export function matchesIfNoneMatch(header, etag) {
  const values = Array.isArray(header) ? header : [header || '']
  return values
    .flatMap(value => String(value).split(','))
    .some(value => {
      const candidate = value.trim().replace(/^W\//, '')
      return candidate === '*' || candidate === etag
    })
}
