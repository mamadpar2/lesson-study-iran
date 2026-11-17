/** Allowed formats for public campaign materials. Never use for confidential files. */
export const CAMPAIGN_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
}
export const CAMPAIGN_FILE_ACCEPT = Object.keys(CAMPAIGN_FILE_TYPES).map(ext => `.${ext}`).join(',')
export const CAMPAIGN_MAX_UPLOAD_BYTES = 250 * 1024 * 1024
export function campaignFileExtension(name: string) { return name.split('.').pop()?.toLowerCase() || '' }
export function campaignFileType(name: string): string | undefined { const ext = campaignFileExtension(name); return Object.hasOwn(CAMPAIGN_FILE_TYPES, ext) ? CAMPAIGN_FILE_TYPES[ext] : undefined }
export function campaignFileTitle(name: string) {
  const ext = campaignFileExtension(name)
  if (ext === 'pdf') return 'فایل PDF کمپین'
  if (['jpg','jpeg','png','webp','gif'].includes(ext)) return 'تصویر کمپین'
  if (['mp4','webm','mov'].includes(ext)) return 'ویدیوی کمپین'
  if (['doc','docx'].includes(ext)) return 'فایل Word کمپین'
  if (['ppt','pptx'].includes(ext)) return 'فایل PowerPoint کمپین'
  if (['xls','xlsx'].includes(ext)) return 'فایل Excel کمپین'
  return 'فایل کمپین'
}

export function campaignFileList<T extends { url: string }>(legacy?: T, files?: T[]): T[] {
  const items = Array.isArray(files) ? files.filter(file => file && typeof file.url === 'string' && file.url) : []
  return legacy?.url && !items.some(file => file.url === legacy.url) ? [legacy, ...items] : items
}
