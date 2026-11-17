import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

export function MiniNoticeDialog({
  title = 'ثبت‌نام تکراری',
  message,
  onClose,
  variant = 'warning',
}: {
  title?: string
  message: string
  onClose: () => void
  variant?: 'warning' | 'success'
}) {
  const isSuccess = variant === 'success'
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mini-notice-title"
        aria-describedby="mini-notice-message"
        dir="rtl"
        className={`w-full max-w-sm rounded-2xl border bg-slate-900 p-5 text-right shadow-2xl ${isSuccess ? 'border-emerald-400/35' : 'border-amber-400/30'}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className={`flex items-center gap-2 ${isSuccess ? 'text-emerald-300' : 'text-amber-300'}`}>
            {isSuccess ? <CheckCircle2 size={20} aria-hidden="true" /> : <AlertTriangle size={20} aria-hidden="true" />}
            <h2 id="mini-notice-title" className="text-base font-bold">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن پیام" className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700">
            <X size={17} />
          </button>
        </div>
        <p id="mini-notice-message" className="text-sm leading-7 text-slate-200">{message}</p>
        <button type="button" autoFocus onClick={onClose} className={`mt-4 min-h-11 w-full rounded-xl px-4 text-sm font-bold text-slate-950 transition-colors ${isSuccess ? 'bg-emerald-400 hover:bg-emerald-300' : 'bg-amber-500 hover:bg-amber-400'}`}>
          متوجه شدم
        </button>
      </section>
    </div>,
    document.body,
  )
}
