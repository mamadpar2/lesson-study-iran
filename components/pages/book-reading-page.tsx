import React from 'react'
import { BookOpen, Download, MapPin } from 'lucide-react'
import { PageHeader } from './page-header'
import type { ProvinceContentRecord } from '@/src/types'

export const BookReadingPage: React.FC<{
  onBack: () => void
  items: ProvinceContentRecord[]
}> = ({ onBack, items }) => {
  const records = items.filter(item => item.sectionId === 'book-reading')

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="book-reading"
        title="خوانش گروهی کتاب در استان‌ها"
        subtitle="عنوان کتاب‌ها و خلاصه‌های عمومی نشست‌های حلقه‌های کتاب‌خوانی استان‌ها"
        badge="حلقه‌های یادگیری"
        accentColor="#34d399"
        onBack={onBack}
      />
      <main className="container dusk-page-content">
        {records.length === 0 ? (
          <section className="dusk-card p-10 text-center">
            <BookOpen size={38} className="mx-auto mb-3 text-emerald-300" />
            <h2 className="font-titr text-lg text-white">هنوز گزارشی از حلقه‌های کتاب‌خوانی منتشر نشده است</h2>
            <p className="text-sm leading-7 text-slate-400 mt-3">خلاصه‌های تأییدشده نشست‌ها پس از ثبت توسط استان‌ها در این بخش نمایش داده می‌شوند.</p>
          </section>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {records.map(item => (
              <article key={item.id} className="dusk-card p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-titr text-lg text-white leading-7">{item.title}</h2>
                  {item.date && <time className="text-xs text-amber-200 shrink-0">{item.date}</time>}
                </div>
                <p className="text-xs text-emerald-200 mt-2 flex items-center gap-1.5"><MapPin size={13} />{item.provinceName}</p>
                {item.description && <p className="text-sm text-slate-300 leading-8 mt-4 whitespace-pre-wrap">{item.description}</p>}
                {(item.attachments || []).filter(file => file.access === 'public' && file.url).length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-5">
                    {(item.attachments || []).filter(file => file.access === 'public' && file.url).map(file => (
                      <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200">
                        <Download size={15} />{file.label || file.fileName}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
