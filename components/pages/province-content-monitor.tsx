import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, RefreshCw, Search, Loader2 } from 'lucide-react'
import { hubBoxes } from '@/src/data'
import { PROVINCE_UNITS } from '@/src/provinces'
import type { ProvinceContentRecord, ProvinceContentSectionId } from '@/src/types'
import { provinceStatus, statusLabels, type ReviewStatus } from '@/lib/province-moderation'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'

const inCategory = (item: ProvinceContentRecord, section: ProvinceContentSectionId) => item.sectionId === section || (section === 'content-production' && item.sectionId === 'book-reading')
export function ProvinceContentMonitor({notify,onReviewChanged}:{notify:(message:string)=>void;onReviewChanged:(item:ProvinceContentRecord)=>void}) {
  const [items,setItems]=useState<ProvinceContentRecord[]>([])
  const [section,setSection]=useState<ProvinceContentSectionId>('webinars')
  const [province,setProvince]=useState('')
  const [status,setStatus]=useState('')
  const [query,setQuery]=useState('')
  const [notes,setNotes]=useState<Record<string,string>>({})
  const [loading,setLoading]=useState(false)
  const [saving,setSaving]=useState('')
  const [error,setError]=useState('')
  const [preview,setPreview]=useState<{title:string;url:string;fileName:string}|null>(null)
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try {const res=await fetch('/api/province-content?all=1',{credentials:'same-origin',cache:'no-store'});const data=await res.json();if(!res.ok)throw new Error(data.error || 'دریافت محتوا انجام نشد.');setItems(data.items || []);setNotes({})}
    catch(e){setError(e instanceof Error?e.message:'دریافت محتوا انجام نشد.')} finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])
  const filtered=useMemo(()=>items.filter(item=>inCategory(item,section) && (!province || item.provinceId===province) && (!status || provinceStatus(item)===status) && (!query.trim() || `${item.title} ${item.provinceName} ${item.description}`.includes(query.trim()))),[items,section,province,status,query])
  const update=async(item:ProvinceContentRecord,next:ReviewStatus)=>{
    if(next==='published' && !window.confirm(`«${item.title}» در صفحه عمومی موضوع مربوط منتشر شود؟`))return
    setSaving(item.id);setError('')
    try {
      const res=await fetch('/api/province-content',{method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,revision:item.revision || '',reviewStatus:next,reviewNote:notes[item.id] ?? item.reviewNote ?? ''})})
      const data=await res.json();if(!res.ok)throw new Error(data.error || 'ثبت وضعیت انجام نشد.')
      setItems(previous=>previous.map(row=>row.id===item.id?data.item:row));onReviewChanged(data.item);notify(`وضعیت محتوا: ${statusLabels[next]}`)
    } catch(e){setError(e instanceof Error?e.message:'ثبت وضعیت انجام نشد.')}
    finally{setSaving('')}
  }
  return <div className="space-y-5" dir="rtl">
    <div className="dusk-card p-5 sm:p-6 border border-emerald-400/20">
      <p className="text-sm leading-7 text-slate-300">محتوای جدید استان‌ها ابتدا در انتظار بررسی است. تأیید به‌تنهایی آن را عمومی نمی‌کند؛ پس از تأیید، با دکمه انتشار در صفحه مربوط نمایش دهید. محتوای قدیمی منتشرشده حفظ شده است.</p>
      <p className="mt-2 text-xs leading-6 text-amber-200">فایل‌های Excel و گزارش روزانه خصوصی می‌مانند. پیوندهای خارجی و فایل‌های عمومی قدیمی ممکن است مستقل از سایت قابل دسترسی باشند.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="دسته‌بندی هفت موضوع">
        {hubBoxes.map(box=><button key={box.id} type="button" aria-pressed={section===box.id} onClick={()=>setSection(box.id)} className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${section===box.id?'border-emerald-400 bg-emerald-500/20 text-white':'border-white/10 bg-slate-900/60 text-slate-300'}`}>{box.title} <span>({items.filter(item=>inCategory(item,box.id)).length.toLocaleString('fa-IR')})</span></button>)}
      </div>
      {section==='content-production' && <p className="mt-2 text-xs text-slate-400">خوانش گروهی کتاب نیز در این دسته قرار دارد.</p>}
    </div>
    <div className="dusk-card p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs text-slate-300">استان<select value={province} onChange={e=>setProvince(e.target.value)} className="dusk-input mt-1 w-full"><option value="">همه استان‌ها</option>{PROVINCE_UNITS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-xs text-slate-300">وضعیت<select value={status} onChange={e=>setStatus(e.target.value)} className="dusk-input mt-1 w-full"><option value="">همه وضعیت‌ها</option>{Object.entries(statusLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
      <label className="text-xs text-slate-300">جست‌وجو<span className="relative block"><Search size={15} className="absolute left-3 top-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} className="dusk-input mt-1 w-full" placeholder="عنوان یا استان" /></span></label>
      <button onClick={()=>void load()} disabled={loading||Boolean(saving)} className="min-h-11 self-end rounded-xl border border-cyan-300/30 px-4 py-2 text-sm text-cyan-100 disabled:opacity-50 inline-flex items-center justify-center gap-2"><RefreshCw size={16} className={loading?'animate-spin':''}/> تازه‌سازی</button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
    <div className="text-sm text-slate-400">{loading?'در حال دریافت…':`${filtered.length.toLocaleString('fa-IR')} مورد`} <span className="text-xs">(حداکثر ۲۰۰۰ مورد اخیر)</span></div>
    {!loading && filtered.length===0 && <div className="dusk-card p-8 text-center text-slate-400">موردی در این دسته با فیلترهای انتخابی وجود ندارد.</div>}
    <div className="space-y-3">{filtered.map(item=>{
      const current=provinceStatus(item)
      return <article key={item.id} className="dusk-card p-4 sm:p-5 border border-white/10">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-titr text-lg text-white break-words">{item.title}</h2><p className="mt-1 text-xs text-emerald-200">{item.provinceName} · {item.sectionId==='book-reading'?'خوانش گروهی کتاب':hubBoxes.find(b=>b.id===item.sectionId)?.title} {item.date && `· ${item.date}`}</p></div><span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">{statusLabels[current]}</span></div>
        {item.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{item.description}</p>}
        {item.internalDetails && <details className="mt-3 text-sm text-slate-300"><summary className="cursor-pointer text-amber-200">مشاهده جزئیات داخلی</summary><p className="mt-2 whitespace-pre-wrap break-words leading-7">{item.internalDetails}</p></details>}
        <div className="mt-3 flex flex-wrap gap-2">{(item.attachments||[]).map(file=>{
          const url=file.access==='private'?`/api/province-content?downloadId=${encodeURIComponent(item.id)}&attachmentId=${encodeURIComponent(file.id)}`:file.url
          if(!url)return null
          return <span key={file.id} className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200"><FileText size={14}/>{file.label}: {file.fileName} {file.access==='private' && !file.publishable?'(خصوصی)':''}{(file.access !== 'private' || /\.(pdf|docx|jpe?g|png|webp|gif)$/i.test(file.fileName)) && <button type="button" onClick={()=>setPreview({title:file.label || file.fileName,url,fileName:file.fileName})} className="text-cyan-300 underline">نمایش</button>}<a href={url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">دریافت</a></span>
        })}{item.attachmentUrl && <a className="text-xs text-cyan-300 underline" href={item.attachmentUrl} target="_blank" rel="noreferrer">پیوست قدیمی</a>}{item.linkUrl && <a className="text-xs text-cyan-300 underline" href={item.linkUrl} target="_blank" rel="noreferrer">پیوند مرتبط</a>}</div>
        <label className="mt-4 block text-xs text-slate-300">نظر مدیر برای استان (اختیاری)<textarea value={notes[item.id] ?? item.reviewNote ?? ''} onChange={e=>setNotes(v=>({...v,[item.id]:e.target.value}))} maxLength={2000} rows={2} className="dusk-input mt-1 w-full" /></label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(saving)} onClick={()=>void update(item,'approved')} className="min-h-11 rounded-xl border border-emerald-400/30 px-4 text-sm text-emerald-200 disabled:opacity-40">تأیید</button>
          <button type="button" disabled={Boolean(saving)} onClick={()=>void update(item,'rejected')} className="min-h-11 rounded-xl border border-rose-400/30 px-4 text-sm text-rose-200 disabled:opacity-40">رد</button>
          <button type="button" disabled={Boolean(saving)||current!=='approved'} onClick={()=>void update(item,'published')} className="min-h-11 rounded-xl bg-cyan-400 px-4 text-sm font-bold text-slate-950 disabled:opacity-40">انتشار در صفحه موضوع</button>
          {saving===item.id && <Loader2 className="animate-spin text-cyan-200" size={18}/>}<span className="self-center text-xs text-slate-500">برای لغو انتشار، وضعیت را به تأیید یا رد تغییر دهید.</span>
        </div>
      </article>
    })}</div>
    {preview && <FilePreviewDialog title={preview.title} url={preview.url} fileName={preview.fileName} onClose={()=>setPreview(null)}/>}
  </div>
}
