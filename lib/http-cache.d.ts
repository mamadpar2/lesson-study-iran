export function buildSettingsEtag(
  settingsUpdatedAt: string | null | undefined,
  provinceCount: number | string | null | undefined,
  provinceUpdatedAt: string | null | undefined,
  scope?: string,
): string

export function matchesIfNoneMatch(
  header: string | string[] | undefined,
  etag: string,
): boolean
