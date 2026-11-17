import { useState } from 'react'
import { ArrowUpLeft, Bookmark, Download, Eye, FileText } from 'lucide-react'
import type { Resource } from '@/src/data'
import { toFa } from '@/src/data'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'

export function ResourceArtwork({ resource }: { resource: Resource }) {
  const titles = {
    cycle: (
      <>
        از پرسش
        <br />
        تا بازاندیشی
      </>
    ),
    observe: (
      <>
        کلاس را
        <br />
        دوباره ببینیم
      </>
    ),
    plan: (
      <>
        ایده‌های روشن،
        <br />
        قدم‌های کوچک
      </>
    ),
  }
  return (
    <div className={`resource-art art-${resource.color}`}>
      <div className="art-grain" />
      <div className="art-copy">
        <span>دفترچه همراه معلم</span>
        <strong>{titles[resource.art]}</strong>
        <span className="art-small-line" />
      </div>
      <svg className="art-visual" viewBox="0 0 240 240" fill="none" aria-hidden="true">
        {resource.art === 'cycle' ? (
          <>
            <circle
              cx="120"
              cy="120"
              r="86"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 5"
              opacity=".55"
            />
            <circle cx="120" cy="67" r="44" fill="currentColor" opacity=".19" />
            <circle cx="74" cy="147" r="44" fill="currentColor" opacity=".35" />
            <circle cx="166" cy="147" r="44" fill="currentColor" opacity=".7" />
            <path d="M119 87v32m-28 16 28-16 28 16" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="120" cy="119" r="8" fill="currentColor" />
            <path d="m177 37 16 9-17 4m16-4c-17-23-44-31-72-27" stroke="currentColor" strokeWidth="1.5" />
          </>
        ) : resource.art === 'observe' ? (
          <>
            <rect
              x="61"
              y="43"
              width="133"
              height="169"
              rx="6"
              transform="rotate(12 61 43)"
              stroke="currentColor"
              opacity=".3"
            />
            <rect
              x="44"
              y="35"
              width="133"
              height="169"
              rx="6"
              fill="var(--art-bg)"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M67 60h83M67 76h55M67 171h83M67 184h47"
              stroke="currentColor"
              opacity=".4"
              strokeWidth="2"
            />
            <path
              d="M62 125s20-29 49-29 48 29 48 29-19 29-48 29-49-29-49-29Z"
              fill="currentColor"
              opacity=".15"
            />
            <path
              d="M62 125s20-29 49-29 48 29 48 29-19 29-48 29-49-29-49-29Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="111" cy="125" r="16" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="111" cy="125" r="6" fill="currentColor" />
            <path d="m191 63 3 10 10 3-10 3-3 10-3-10-10-3 10-3 3-10Z" fill="currentColor" opacity=".7" />
          </>
        ) : (
          <>
            <rect x="39" y="42" width="80" height="80" rx="40" stroke="currentColor" strokeWidth="1.5" />
            <path d="M129 42h80v80h-80z" fill="currentColor" opacity=".24" />
            <path d="M39 132h80v80H39z" fill="currentColor" opacity=".7" />
            <path d="M129 132h40a40 40 0 0 1 40 40v40h-80v-80Z" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="m151 65 34 34m0-34-34 34M62 155l34 34m0-34-34 34"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="169" cy="172" r="11" fill="currentColor" opacity=".65" />
          </>
        )}
      </svg>
      <span className="art-edition">مجموعه یادگیریِ جمعی</span>
    </div>
  )
}

export function ResourceCard({
  resource,
  saved,
  onSave,
  onOpen,
}: {
  resource: Resource
  saved: boolean
  onSave: () => void
  onOpen: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileUrl = `/resources/${resource.id}.pdf`
  return (
    <article className="resource-card">
      <div className="resource-cover">
        <button className="resource-art-button" onClick={onOpen} aria-label={`مشاهده ${resource.title}`}>
          <ResourceArtwork resource={resource} />
        </button>
        <button
          className={`bookmark-button ${saved ? 'is-saved' : ''}`}
          onClick={onSave}
          aria-label={saved ? `حذف نشان ${resource.title}` : `نشان‌کردن ${resource.title}`}
          aria-pressed={saved}
        >
          <Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="resource-card-content">
        <span className={`category-label label-${resource.color}`}>{resource.category}</span>
        <button className="resource-title" onClick={onOpen}>
          <h3>{resource.title}</h3>
          <ArrowUpLeft size={18} />
        </button>
        <p>{resource.subtitle}</p>
        <div className="resource-card-footer">
          <span>
            <FileText size={14} />
            <span>PDF</span>
            <i />
            {toFa(resource.pages)} صفحه
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-label={`نمایش ${resource.title}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-cyan-500/30 px-2.5 text-xs font-bold text-cyan-200 hover:bg-cyan-500/10"
            >
              <Eye size={14} /> <span>نمایش</span>
            </button>
            <a href={fileUrl} download aria-label={`دریافت ${resource.title}`}>
              <Download size={16} />
              <span>دانلود</span>
            </a>
          </div>
        </div>
      </div>
      {previewOpen && (
        <FilePreviewDialog
          title={resource.title}
          url={fileUrl}
          fileName={`${resource.id}.pdf`}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </article>
  )
}
