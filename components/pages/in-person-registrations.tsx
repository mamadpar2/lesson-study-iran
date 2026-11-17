import { useEffect, useMemo, useState } from 'react'
import type { InPersonEvent } from '@/src/data'

type Row = { id: string; full_name: string; national_code: string; phone: string; school: string; province: string; created_at: string }
export function InPersonRegistrations({ events }: { events: InPersonEvent[] }) {
  const [eventId, setEventId] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let active = true
    setRows([]); setPage(0); setError('')
    if (!eventId) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/registrations?view=in-person&eventId=${encodeURIComponent(eventId)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'دریافت ثبت‌نام‌ها ناموفق بود.'); return body })
      .then(body => { if (active) setRows(body.data || []) })
      .catch(err => { if (active) setError(err.message || 'دریافت ثبت‌نام‌ها ناموفق بود.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [eventId])
  const filtered = useMemo(() => rows.filter(r => [r.full_name, r.national_code, r.phone, r.school, r.province].some(v => String(v || '').toLowerCase().includes(query.toLowerCase().trim()))), [rows, query])
  const exportRows = async () => {
    const XLSX = await import('@e965/xlsx')
    const safe = (v: unknown) => { const s = String(v ?? ''); return /^[\s]*[=+\-@\t\r]/.test(s) ? `'${s}` : s }
    const table = [['نام', 'کد ملی', 'شماره همراه', 'مدرسه', 'استان', 'زمان ثبت'], ...filtered.map(r => [r.full_name, r.national_code, r.phone, r.school, r.province, r.created_at].map(safe))]
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(table), 'Registrations')
    XLSX.writeFile(book, 'in-person-registrations.xlsx')
  }
  return <section className="dusk-card p-4 space-y-3" aria-label="ثبت‌نام نشست‌های حضوری">
    <h3 className="font-titr text-lg text-white">ثبت‌نام نشست‌های حضوری</h3>
    <p className="text-xs text-slate-300">فقط ثبت‌نام‌های ذخیره‌شده در سرور نمایش داده می‌شوند؛ داده‌های قبلی مرورگر به سرور منتقل نشده‌اند.</p>
    <label className="block">انتخاب نشست <select className="dusk-input" value={eventId} onChange={e => setEventId(e.target.value)}><option value="">انتخاب کنید</option>{events.map(e => <option key={e.id} value={e.id}>{e.title} — {e.province}</option>)}</select></label>
    {eventId && <><label className="block">جست‌وجو <input className="dusk-input" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} /></label>
      <button type="button" disabled={!filtered.length} onClick={() => void exportRows().catch(() => setError('ساخت خروجی ناموفق بود.'))} className="dusk-action-btn">خروجی Excel نتایج</button>
      {error && <p role="alert" className="text-red-300">{error}</p>}{loading ? <p>در حال دریافت…</p> : <><p>{filtered.length} ثبت‌نام</p><div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead><tr><th>نام</th><th>کد ملی</th><th>همراه</th><th>مدرسه</th><th>زمان</th></tr></thead><tbody>{filtered.slice(page * 20, (page + 1) * 20).map(r => <tr key={r.id}><td>{r.full_name}</td><td>{r.national_code}</td><td>{r.phone}</td><td>{r.school}</td><td>{new Date(r.created_at).toLocaleString('fa-IR')}</td></tr>)}</tbody></table></div>
      <div className="flex gap-3"><button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="dusk-action-btn">صفحه قبل</button><span>صفحه {page + 1}</span><button type="button" disabled={(page + 1) * 20 >= filtered.length} onClick={() => setPage(p => p + 1)} className="dusk-action-btn">صفحه بعد</button></div></>}</>}
  </section>
}
