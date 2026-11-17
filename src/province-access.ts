import { hubBoxes } from './data.js'
import type { ProvinceContentSectionId } from './types.js'

export const PROVINCE_SECTION_META: { id: ProvinceContentSectionId; title: string }[] = [
  ...hubBoxes.map(({ id, title }) => ({ id, title })),
  { id: 'book-reading', title: 'خوانش گروهی کتاب' },
]

export const PROVINCE_CONTENT_SECTION_IDS: readonly ProvinceContentSectionId[] = PROVINCE_SECTION_META.map(section => section.id)

const validIds = new Set<string>(PROVINCE_CONTENT_SECTION_IDS)

export function normalizeAllowedSections(value: unknown): ProvinceContentSectionId[] {
  let parsed = value
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []
  return [...new Set(parsed.filter((id): id is ProvinceContentSectionId => typeof id === 'string' && validIds.has(id)))]
}

export function validateAllowedSections(value: unknown): ProvinceContentSectionId[] | null {
  if (!Array.isArray(value)) return null
  if (value.some(id => typeof id !== 'string' || !validIds.has(id))) return null
  return normalizeAllowedSections(value)
}
