import React from 'react'
import { ArrowUpRight, Download, MapPin, Sparkles } from 'lucide-react'
import type { ProvinceContentRecord, ProvinceContentSectionId } from '@/src/types'

export const ProvincePublishedItems: React.FC<{ sectionId: ProvinceContentSectionId; items: ProvinceContentRecord[] }> = ({ sectionId, items }) => {
  const records = items.filter(item => item.sectionId === sectionId)
  if (!records.length) return null

  return (
    <section className="container dusk-page-content mt-6" aria-label="محتوای منتشرشده استان‌ها">
      <div className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-slate-950/85 to-slate-900/65 p-5 sm:p-7 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center"><Sparkles size={19} className="text-emerald-300" /></div>
          <div>
            <h2 className="font-titr text-lg text-white">محتوای منتشرشده استان‌ها</h2>
            <p className="text-xs text-slate-400 mt-1">مطالب و مستندات ثبت‌شده توسط حساب‌های استانی</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {records.map(item => <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                {item.recordType === 'daily-activity' && <span className="inline-flex mb-1 rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">گزارش روزانه</span>}
                <h3 className="font-titr text-sm text-white leading-6">{item.title}</h3>
              </div>
              {item.date && <time className="text-[10px] text-amber-200 whitespace-nowrap">{item.date}</time>}
            </div>
            <p className="mt-2 text-[11px] text-emerald-200 flex items-center gap-1"><MapPin size={12} />{item.provinceName}</p>
            {item.description && <p className="text-xs text-slate-300/80 leading-7 mt-3 whitespace-pre-wrap">{item.description}</p>}
            <div className="flex flex-wrap gap-3 mt-4">
              {(item.attachments || []).filter(file => file.access === 'public' && file.url).map(file => (
                <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200"><Download size={14} />{file.label || file.fileName}</a>
              ))}
              {item.attachmentUrl && <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200"><Download size={14} />{item.attachmentName || 'مشاهده یا دریافت پیوست'}</a>}
              {item.linkUrl && <a href={item.linkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200">پیوند مرتبط<ArrowUpRight size={14} /></a>}
            </div>
          </article>)}
        </div>
      </div>
    </section>
  )
}
