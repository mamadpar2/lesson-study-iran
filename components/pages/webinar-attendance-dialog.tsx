import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileSpreadsheet, Loader2, RotateCcw, Trash2, UsersRound, X } from 'lucide-react'
import type { WebinarItem } from '@/src/data'
import { formatTehranDateTime } from '@/lib/webinar-registration-time'

interface AttendanceRow {
  id: string
  fullName: string
  personnelCode: string
  province: string
  district: string
  createdAt: string
}

export function WebinarAttendanceDialog({ webinar, onClose, onAuthExpired, notify }: {
  webinar: WebinarItem
  onClose: () => void
  onAuthExpired: () => void
  notify: (message: string) => void
}) {
  const [rows, setRows] = useState<AttendanceRow[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const requestCounter = useRef(0)
  const deletingRef = useRef(false)
  deletingRef.current = Boolean(deletingId)
  const closeButton = useRef<HTMLButtonElement>(null)
  const authExpired = useRef(onAuthExpired)
  authExpired.current = onAuthExpired

  const loadRows = useCallback(async () => {
    const requestId = ++requestCounter.current
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/registrations?view=webinar-attendance&eventId=${encodeURIComponent(webinar.id)}`, { credentials: 'same-origin', cache: 'no-store' })
      const result = await response.json().catch(() => null)
      if (requestId !== requestCounter.current) return
      if (response.status === 401) { authExpired.current(); return }
      if (!response.ok || result?.status !== 'ok' || !Array.isArray(result?.data)) throw new Error(result?.error || 'دریافت فهرست ثبت‌حضورها ناموفق بود.')
      const mapped: AttendanceRow[] = result.data.map((row: Record<string, unknown>) => ({
        id: String(row.id || ''), fullName: String(row.full_name ?? row.fullName ?? ''),
        personnelCode: String(row.personnel_code ?? row.personnelCode ?? ''), province: String(row.province || ''),
        district: String(row.district || ''), createdAt: String(row.created_at ?? row.createdAt ?? ''),
      }))
      setRows(mapped); setLoaded(true)
    } catch (err) {
      if (requestId === requestCounter.current) setError(err instanceof Error ? err.message : 'دریافت فهرست ثبت‌حضورها ناموفق بود.')
    } finally {
      if (requestId === requestCounter.current) setLoading(false)
    }
  }, [webinar.id])

  useEffect(() => { void loadRows(); return () => { requestCounter.current += 1 } }, [loadRows])
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !deletingRef.current) onClose() }
    document.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); previousFocus?.focus() }
  }, [onClose])

  const remove = async (row: AttendanceRow) => {
    if (loading || deletingId || !row.id) return
    if (!window.confirm(`ثبت حضور «${row.fullName || 'این شخص'}» حذف شود؟ پس از حذف، در صورت باز بودن مهلت، امکان ثبت دوباره وجود دارد.`)) return
    setDeletingId(row.id); setError('')
    try {
      const response = await fetch('/api/registrations', {
        method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: webinar.id, registrationId: row.id }),
      })
      const result = await response.json().catch(() => null)
      if (response.status === 401) { onAuthExpired(); return }
      if (!response.ok || result?.status !== 'deleted') throw new Error(result?.error || 'حذف ثبت‌حضور انجام نشد.')
      setRows(previous => previous.filter(item => item.id !== row.id))
      notify('ثبت حضور حذف شد؛ ثبت دوباره در مهلت باز امکان‌پذیر است.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف ثبت‌حضور انجام نشد.')
    } finally { setDeletingId('') }
  }

  const exportRows = async () => {
    if (!loaded || loading || deletingId || exporting || !rows.length) return
    setExporting(true); setError('')
    try {
      const { createWebinarAttendanceWorkbook } = await import('@/lib/webinar-attendance-workbook')
      const blob = await createWebinarAttendanceWorkbook(webinar.title, rows)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      // ASCII filename keeps the .xlsx extension on browsers that cannot preserve Persian download names.
      const stem = webinar.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'webinar'
      link.href = url; link.download = `webinar-attendance-${stem}.xlsx`
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      notify(`فایل حضور و غیاب «${webinar.title}» با ${rows.length} ثبت‌نام آماده شد.`)
    } catch (err) { setError(err instanceof Error ? err.message : 'ساخت خروجی Excel ناموفق بود.') }
    finally { setExporting(false) }
  }
  const displayTime = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value || '—' : formatTehranDateTime(date)
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !deletingId) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="attendance-dialog-title" dir="rtl" className="flex max-h-[92dvh] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-2xl border border-violet-300/25 bg-slate-900 shadow-2xl">
        <header className="shrink-0 border-b border-slate-700 bg-gradient-to-l from-violet-950/60 via-slate-900 to-slate-900 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="mb-1 text-xs text-violet-200">گزارش محرمانه ثبت حضور</p><h2 id="attendance-dialog-title" className="break-words text-base font-bold text-white sm:text-lg">ثبت حضور: {webinar.title}</h2></div>
            <button ref={closeButton} type="button" onClick={onClose} disabled={Boolean(deletingId)} aria-label="بستن پنجره ثبت حضور" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-50"><X size={20} /></button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-violet-300/20 bg-slate-950/45 px-3 text-sm text-slate-100"><UsersRound size={17} className="text-violet-300" /><span>تعداد کل ثبت‌نام‌کنندگان:</span><strong aria-live="polite">{loaded ? rows.length.toLocaleString('fa-IR') : '—'}</strong></div>
            <button type="button" onClick={() => void loadRows()} disabled={loading || Boolean(deletingId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 text-xs font-bold text-slate-100 hover:bg-slate-800 disabled:opacity-50">{loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} تازه‌سازی</button>
            <button type="button" onClick={() => void exportRows()} disabled={!loaded || !rows.length || loading || Boolean(deletingId) || exporting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">{exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} خروجی Excel</button>
          </div>
        </header>
        {error && <p role="alert" className="mx-4 mt-3 rounded-xl border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          {loading && !loaded ? <div className="p-8 text-center text-sm text-slate-300"><Loader2 size={22} className="mx-auto mb-3 animate-spin text-violet-300" />در حال دریافت ثبت‌حضورها…</div>
            : !loaded && error ? <p className="p-6 text-center text-sm text-slate-400">برای تلاش دوباره از دکمه تازه‌سازی استفاده کنید.</p>
            : rows.length === 0 ? <div className="p-8 text-center text-sm text-slate-400"><FileSpreadsheet size={24} className="mx-auto mb-3" />هنوز ثبت حضوری برای این وبینار وجود ندارد.</div>
            : <table aria-label="فهرست ثبت حضور وبینار" className="dusk-table w-full min-w-[740px] text-right text-xs">
              <thead className="sticky top-0 bg-slate-900"><tr><th scope="col">ردیف</th><th scope="col">نام و نام خانوادگی</th><th scope="col">کد پرسنلی</th><th scope="col">استان</th><th scope="col">ناحیه</th><th scope="col">زمان ثبت</th><th scope="col">عملیات</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={row.id} className="hover:bg-white/[0.03]">
                <td>{(index + 1).toLocaleString('fa-IR')}</td><td>{row.fullName || '—'}</td><td><bdi dir="ltr">{row.personnelCode || '—'}</bdi></td><td>{row.province || '—'}</td><td>{row.district || '—'}</td><td className="whitespace-nowrap">{displayTime(row.createdAt)}</td>
                <td><button type="button" aria-label={`حذف ثبت حضور ${row.fullName}`} disabled={loading || Boolean(deletingId) || !row.id} onClick={() => void remove(row)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-400/30 px-3 text-red-200 hover:bg-red-950/50 disabled:opacity-50">{deletingId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} حذف</button></td>
              </tr>)}</tbody>
            </table>}
        </div>
        <p className="shrink-0 border-t border-slate-700 px-4 py-3 text-xs leading-5 text-slate-400">این اطلاعات فقط برای مدیر است. پس از حذف، شخص می‌تواند در مهلت فعال ثبت حضور دوباره ثبت‌نام کند.</p>
      </section>
    </div>, document.body,
  )
}
