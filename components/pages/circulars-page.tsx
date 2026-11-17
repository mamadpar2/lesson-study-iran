import React, { useState } from 'react'
import { Download, Eye, Search, ShieldCheck, Calendar, Hash, ScrollText } from 'lucide-react'
import { PageHeader } from './page-header'
import { circularsData, type CircularItem } from '@/src/data'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'

interface CircularsPageProps {
  onBack: () => void
  notify: (msg: string) => void
  items?: CircularItem[]
}

export const CircularsPage: React.FC<CircularsPageProps> = ({ onBack, notify, items }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('همه')
  const [previewFile, setPreviewFile] = useState<{ title: string; url: string; fileName?: string; downloadUrl?: string } | null>(null)

  const categories = ['همه', 'شیوه‌نامه', 'بخشنامه', 'فراخوان', 'تقویم اجرایی']

  const sourceData = items !== undefined ? items : circularsData
  const filtered = sourceData.filter((c: CircularItem) => {
    const matchesCat = activeCategory === 'همه' || c.category === activeCategory
    const matchesQuery =
      searchTerm.trim() === '' ||
      c.title.includes(searchTerm) ||
      c.number.includes(searchTerm) ||
      c.summary.includes(searchTerm)
    return matchesCat && matchesQuery
  })

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="circulars"
        title="بخشنامه‌ها و فراخوان‌ها"
        subtitle="مرجع رسمی اسناد ابلاغی، شیوه‌نامه‌های وزارتی و فایل پی‌دی‌اف بخشنامه‌ها و فراخوان‌های دبیرخانه کشوری"
        badge="اسناد و ابلاغیه‌ها"
        accentColor="#8b5cf6"
        onBack={onBack}
      />

      <div className="container dusk-page-content">
        <div className="dusk-search-toolbar">
          <div className="dusk-search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جست‌وجو بر اساس شماره بخشنامه، موضوع یا کلیدواژه..."
              className="dusk-search-input font-nazanin"
            />
          </div>

          <div className="dusk-filter-tabs">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`dusk-tab-btn ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="dusk-cards-grid">
          {filtered.map((item) => (
            <div key={item.id} className="dusk-card circular-card">
              <div className="dusk-card-top">
                <span className="status-pill purple">{item.category}</span>
                <span className="meta-badge">
                  <Hash size={13} />
                  شماره: {item.number}
                </span>
                <span className="meta-badge">
                  <Calendar size={13} />
                  {item.date}
                </span>
              </div>

              <h3 className="dusk-card-title font-titr">{item.title}</h3>
              <p className="dusk-card-desc">{item.summary}</p>

              <div className="circular-authority">
                <ShieldCheck size={16} className="text-purple-400" />
                <span><strong>مرجع صادرکننده:</strong> {item.authority}</span>
              </div>

              {item.pdfFile && (
                <div className="dusk-card-actions flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setPreviewFile({ title: item.title, url: item.pdfFile, fileName: item.pdfFileName || `circular-${item.number}.pdf`, downloadUrl: item.pdfDownloadUrl })}
                    className="dusk-action-btn btn-primary flex-1 justify-center"
                    aria-label={`نمایش بخشنامه ${item.number}`}
                  >
                    <Eye size={16} />
                    <span className="font-titr">نمایش فایل</span>
                  </button>
                  <a
                    href={item.pdfDownloadUrl || item.pdfFile}
                    download={item.pdfFileName || `circular-${item.number}.pdf`}
                    className="dusk-action-btn btn-secondary flex-1 justify-center"
                    onClick={() => notify(`دریافت فایل پی‌دی‌اف بخشنامه یا فراخوان شماره ${item.number} آغاز شد.`)}
                  >
                    <Download size={16} />
                    <span className="font-titr">دانلود PDF</span>
                  </a>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="dusk-card p-12 text-center my-8 col-span-full">
              <ScrollText size={42} className="mx-auto mb-3 text-slate-500 opacity-60" />
              <h3 className="font-titr text-lg text-white mb-2">هنوز بخشنامه یا فراخوانی در این بخش ثبت نشده است</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                بخشنامه‌های رسمی، شیوه‌نامه‌ها و فراخوان‌های تاییدشده کشوری پس از بارگذاری در این درگاه در دسترس قرار خواهند گرفت.
              </p>
            </div>
          )}
        </div>
      </div>
      {previewFile && (
        <FilePreviewDialog
          title={previewFile.title}
          url={previewFile.url}
          fileName={previewFile.fileName}
          downloadUrl={previewFile.downloadUrl}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}
