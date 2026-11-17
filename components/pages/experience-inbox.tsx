import { useEffect, useState } from 'react'

type Row = { id: string; name: string; province: string; title: string; summary: string; school: string; phone?: string; email?: string; fileName?: string; fileUrl?: string; hasPrivateFile?: boolean; savedAt?: string }

export function ExperienceInbox() {
  const [rows, setRows] = useState<Row[]>([])
  const [page, setPage] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    fetch(`/api/experiences?page=${page}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'دریافت آثار ناموفق بود.'); return body })
      .then(body => { if (active) setRows(body.data || []) })
      .catch(err => { if (active) { setRows([]); setError(err.message || 'دریافت آثار ناموفق بود.') } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [page])
  return <section className="dusk-card p-4 space-y-3" aria-label="صندوق تجارب ارسالی">
    <h3 className="font-titr text-lg text-white">صندوق تجارب زیسته ارسالی</h3>
    <p className="text-xs text-amber-200">آثار این صندوق خودکار منتشر نمی‌شوند. فایل‌های قدیمی ممکن است قبلاً عمومی بارگذاری شده باشند.</p>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {loading ? <p>در حال دریافت…</p> : rows.length === 0 ? <p>در این صفحه اثری یافت نشد.</p> : rows.map(row => <article key={row.id} className="rounded-xl border border-slate-700 p-4 space-y-2 text-sm">
      <h4 className="font-bold text-white">{row.title}</h4>
      <p>{row.name} — {row.province} — {row.school}</p>
      <p>{row.phone} {row.email}</p><p className="whitespace-pre-wrap break-words">{row.summary}</p>
      {row.hasPrivateFile ? <a className="text-amber-300 underline" href={`/api/experiences?downloadId=${encodeURIComponent(row.id)}`}>دریافت فایل خصوصی: {row.fileName}</a>
        : row.fileUrl && /^https?:\/\//i.test(row.fileUrl) ? <a className="text-amber-300 underline break-all" href={row.fileUrl} target="_blank" rel="noopener noreferrer">پیوند ثبت‌شده (ممکن است عمومی باشد)</a> : null}
    </article>)}
    <div className="flex gap-3"><button type="button" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)} className="dusk-action-btn">صفحه قبل</button><span>صفحه {page + 1}</span><button type="button" disabled={rows.length < 20 || loading} onClick={() => setPage(p => p + 1)} className="dusk-action-btn">صفحه بعد</button></div>
  </section>
}
