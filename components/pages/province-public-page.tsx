import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, CalendarDays, ExternalLink, Eye, FileText, FolderOpen, MapPin, X } from 'lucide-react'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'
import { PROVINCE_SECTION_META } from '@/src/province-access'
import { PROVINCE_UNITS } from '@/src/provinces'
import provinceHeaders from '@/src/province-headers.json'
import { publicProvinceRecords } from '@/lib/province-moderation'
import type { ProvinceContentRecord, ProvinceContentSectionId } from '@/src/types'

function safeUrl(value?: string): string | null {
  if (!value) return null
  try { const url = new URL(value, window.location.origin); return ['http:', 'https:'].includes(url.protocol) ? value : null } catch { return null }
}

type Preview = { title: string; url: string; fileName?: string }
export function ProvincePublicPage({ provinceId, items, onBack }: { provinceId: string; items: ProvinceContentRecord[]; onBack: () => void }) {
  const [active, setActive] = useState<ProvinceContentSectionId | 'all'>('all')
  const [selected, setSelected] = useState<ProvinceContentRecord | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const province = PROVINCE_UNITS.find(unit => unit.id === provinceId)
  const records = useMemo(() => publicProvinceRecords(items).filter(item => item.provinceId === provinceId).sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [items, provinceId])
  const shown = active === 'all' ? records : records.filter(item => item.sectionId === active)
  useEffect(() => { setActive('all'); setSelected(null); setPreview(null) }, [provinceId])
  useEffect(() => {
    if (!selected || preview) return
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, preview])
  if (!province) return <main className="container province-public"><button className="dusk-back-btn" onClick={onBack}><ArrowRight size={18}/> بازگشت به صفحه اصلی</button><h1 className="font-titr text-xl mt-10">استان مورد نظر یافت نشد</h1></main>
  const hero = provinceHeaders[province.id as keyof typeof provinceHeaders]
  const titleFor = (id: ProvinceContentSectionId) => PROVINCE_SECTION_META.find(section => section.id === id)?.title || 'فعالیت استان'
  const files = selected ? [...(selected.attachments || []).filter(f => f.access === 'public' && safeUrl(f.url)).map(f => ({title: f.label || f.fileName, url: f.url!, fileName: f.fileName})), ...(safeUrl(selected.attachmentUrl) ? [{title:selected.attachmentName || 'پیوست', url:selected.attachmentUrl!, fileName:selected.attachmentName}] : [])] : []
  return <div className="province-public" dir="rtl">
    <header className="province-public-hero province-photo-hero" data-province-hero={province.id}>
      {hero && <img className="province-hero-image" src={hero.image} alt="" fetchPriority="high" />}
      <div className="province-hero-shade" aria-hidden="true" />
      <button className="dusk-back-btn province-hero-back" onClick={onBack}><ArrowRight size={18}/> بازگشت به صفحه اصلی</button>
      <div className="province-hero-content">
        <p className="province-overline">درس‌پژوهی و درس‌کاوی در سراسر ایران</p>
        <h1 className="font-titr">فعالیت‌های {province.name}</h1>
        <p className="province-hero-description">مطالب و مستندات منتشرشده این استان</p>
        <span className="province-total">{records.length.toLocaleString('fa-IR')} محتوای منتشرشده</span>
      </div>
      {hero && <div className="province-photo-caption"><span><MapPin size={14} aria-hidden="true"/> {hero.landmark}</span></div>}
    </header>
    <div className="container province-public-content">
    <nav className="province-tabs" aria-label="موضوعات استان"><button type="button" aria-pressed={active === 'all'} onClick={() => setActive('all')}>همه <span>{records.length.toLocaleString('fa-IR')}</span></button>{PROVINCE_SECTION_META.map(section => <button key={section.id} type="button" aria-pressed={active === section.id} onClick={() => setActive(section.id)}>{section.title}<span>{records.filter(item => item.sectionId === section.id).length.toLocaleString('fa-IR')}</span></button>)}</nav>
    <section aria-live="polite" aria-label="مطالب استان">{shown.length ? <div className="province-content-grid">{shown.map(item => <button type="button" key={item.id} className="province-content-card" data-province-content-card={item.id} onClick={() => setSelected(item)}><div className="province-card-top"><span>{titleFor(item.sectionId)}</span><ArrowRight size={16}/></div><h2 className="font-titr">{item.title}</h2>{item.description && <p>{item.description}</p>}<div className="province-card-foot">{item.date ? <span><CalendarDays size={14}/>{item.date}</span> : <span><MapPin size={14}/>{province.name}</span>}<span>مشاهده جزئیات <Eye size={14}/></span></div></button>)}</div> : <div className="province-empty"><FolderOpen size={35}/><h2 className="font-titr">هنوز محتوایی در این بخش منتشر نشده است</h2><p>پس از بررسی و انتشار مطالب استان، در اینجا نمایش داده می‌شوند.</p></div>}</section>

    </div>
    {selected && createPortal(<div className="province-modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null) }}><section className="province-modal" role="dialog" aria-modal="true" aria-label={`جزئیات ${selected.title}`}><header><div><span>{titleFor(selected.sectionId)}</span><h2 className="font-titr">{selected.title}</h2></div><button onClick={() => setSelected(null)} aria-label="بستن جزئیات"><X size={21}/></button></header><div className="province-modal-body"><p className="province-modal-meta"><MapPin size={15}/>{province.name}{selected.date && <><CalendarDays size={15}/>{selected.date}</>}</p>{selected.recordType === 'daily-activity' && <p className="text-cyan-200 text-sm mt-3">گزارش روزانه</p>}{selected.description && <p className="province-modal-description">{selected.description}</p>}{files.length > 0 && <div className="province-files"><h3 className="font-titr"><FileText size={17}/> فایل‌ها و مستندات</h3>{files.map((file, index) => <button key={`${file.url}-${index}`} onClick={() => setPreview(file)}><span>{file.title}</span><span>پیش‌نمایش و دریافت <Eye size={15}/></span></button>)}</div>}{safeUrl(selected.linkUrl) && <a className="province-related-link" href={selected.linkUrl} target="_blank" rel="noopener noreferrer">پیوند مرتبط <ExternalLink size={15}/></a>}</div></section></div>, document.body)}
    {preview && <FilePreviewDialog title={preview.title} url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)}/>}
  </div>
}
