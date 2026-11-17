import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, ExternalLink, FileText, X } from 'lucide-react'
import { DocumentPreview } from '@/components/ui/document-preview'

export interface FilePreviewDialogProps {
  title: string
  url: string
  fileName?: string
  downloadUrl?: string
  onClose: () => void
}

const getExtension = (url: string, fileName?: string) => {
  const value = fileName || url.split(/[?#]/)[0]
  return value.split('.').pop()?.toLowerCase() || ''
}

/** Public-file preview for PDFs, media, and Office documents. */
export function FilePreviewDialog({ title, url, fileName, downloadUrl, onClose }: FilePreviewDialogProps) {
  const extension = getExtension(url, fileName)
  const isOffice = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extension)
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(extension)
  const isAudio = ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(extension)
  const absoluteUrl = (() => {
    try { return new URL(url, window.location.href).href } catch { return url }
  })()
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = oldOverflow
    }
  }, [onClose])

  const content = isImage ? (
    <div className="flex h-full items-center justify-center overflow-auto bg-slate-950 p-3">
      <img src={url} alt={title} className="max-h-full max-w-full rounded-lg object-contain" />
    </div>
  ) : isVideo ? (
    <div className="flex h-full items-center justify-center bg-black p-2">
      <video src={url} controls playsInline className="max-h-full max-w-full" />
    </div>
  ) : isAudio ? (
    <div className="flex h-full items-center justify-center bg-slate-950 p-6">
      <audio src={url} controls className="w-full max-w-xl" />
    </div>
  ) : extension === 'pdf' || extension === 'docx' ? (
    <DocumentPreview url={url} type={extension} />
  ) : isOffice ? (
    <iframe
      src={officeViewerUrl}
      title={`پیش‌نمایش ${title}`}
      className="h-full w-full border-0 bg-white"
      allowFullScreen
    />
  ) : (
    <iframe
      src={`${url}${extension === 'pdf' ? '#toolbar=1&navpanes=0' : ''}`}
      title={`پیش‌نمایش ${title}`}
      className="h-full w-full border-0 bg-white"
      allow="fullscreen"
    />
  )

  return createPortal(
    <div
      className="file-preview-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`پیش‌نمایش فایل: ${title}`}
        dir="rtl"
        className="file-preview-dialog flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header className="file-preview-header flex min-h-14 items-center justify-between gap-3 border-b border-slate-700 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 text-white">
            <FileText size={18} className="shrink-0 text-cyan-300" aria-hidden="true" />
            <h2 className="truncate text-sm font-bold sm:text-base">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={downloadUrl || url}
              download={fileName || undefined}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 text-xs font-bold text-white hover:bg-cyan-500 sm:text-sm"
            >
              <Download size={15} /> <span>دانلود</span>
            </a>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="باز کردن فایل در زبانه جدید"
              title="باز کردن در زبانه جدید"
              className="inline-flex min-h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <ExternalLink size={16} />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن پیش‌نمایش"
              className="inline-flex min-h-11 w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="file-preview-body min-h-0 flex-1 bg-slate-950">
          {content}
        </div>
        {isOffice && extension !== 'docx' && (
          <p className="border-t border-slate-700 px-3 py-1.5 text-center text-[11px] text-slate-400">
            پیش‌نمایش Word، PowerPoint و Excel از نمایشگر آنلاین Microsoft استفاده می‌کند؛ اگر نمایش ممکن نبود، فایل را دانلود کنید.
          </p>
        )}
      </section>
    </div>,
    document.body,
  )
}
