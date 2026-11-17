import type { ProvinceContentRecord } from '../src/types.js'
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'published'
export function provinceStatus(item: { reviewStatus?: string }): ReviewStatus {
  return item.reviewStatus == null ? 'published' : ['pending','approved','rejected','published'].includes(item.reviewStatus) ? item.reviewStatus as ReviewStatus : 'pending'
}
export const statusLabels: Record<ReviewStatus, string> = {pending:'در انتظار بررسی',approved:'تأیید شده',rejected:'رد شده',published:'تأیید و منتشر شده'}
/** Strip all internal detail and private file paths. Old records without a status stay published. */
export function publicProvinceRecords(items: ProvinceContentRecord[]): ProvinceContentRecord[] {
 return items.filter(item => provinceStatus(item) === 'published').map(item => {
  const {internalDetails: _internal, reviewNote: _note, revision: _revision, attachments, ...rest} = item
  return {...rest, attachments:(Array.isArray(attachments) ? attachments : []).flatMap(file => {
   if (!file || typeof file !== 'object' || typeof file.fileName !== 'string') return []
   if(file.access === 'public' && file.url) { const {pathname: _path, ...safe}=file; return [safe] }
   if(file.access === 'private' && file.publishable && !/\.(xlsx?|csv)$/i.test(file.fileName) && item.recordType !== 'daily-activity') return [{id:file.id,label:file.label,fileName:file.fileName,access:'public' as const,url:`/api/province-content?publicId=${encodeURIComponent(item.id)}&attachmentId=${encodeURIComponent(file.id)}`,contentType:file.contentType}]
   return []
  })}
 })
}
