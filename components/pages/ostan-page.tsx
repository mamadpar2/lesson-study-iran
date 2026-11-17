import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRightFromLine, CheckCircle2, Download, ExternalLink, Eye, EyeOff, FileUp, KeyRound, Loader2, LogIn, Plus, RefreshCw, Save, ShieldAlert, ShieldCheck, Trash2, UserRound, UsersRound, X } from 'lucide-react'
import { PROVINCE_SECTION_META } from '@/src/province-access'
import type { ProvinceAttachment, ProvinceContentRecord, ProvinceContentSectionId } from '@/src/types'
import { uploadToBlob } from '@/lib/api-client'
import { provinceStatus, statusLabels } from '@/lib/province-moderation'
import { JalaliDateInput } from '@/components/ui/jalali-date-input'

type ProvinceIdentity = { id: string; name: string; allowedSections: ProvinceContentSectionId[] }
type Draft = {
  title: string
  description: string
  date: string
  linkUrl: string
  attachments: ProvinceAttachment[]
  recordType: 'content' | 'daily-activity'
  internalDetails: string
}

const blankDraft: Draft = { title: '', description: '', date: '', linkUrl: '', attachments: [], recordType: 'content', internalDetails: '' }

const attachmentLabels: Record<ProvinceContentSectionId, string[]> = {
  webinars: ['پوستر', 'محتوا و اسلایدها', 'سایر فایل'],
  'in-person': ['پوستر', 'بخشنامه', 'محتوا', 'گزارش تصویری', 'سایر فایل'],
  circulars: ['بخشنامه یا فراخوان', 'سایر فایل'],
  campaign: ['فایل Excel تیم‌ها', 'خلاصه آماری عمومی', 'سایر فایل'],
  'lived-experiences': ['اثر Word', 'اثر PDF', 'سایر فایل'],
  'clinical-supervision': ['فرم نظارت', 'گزارش تصویری', 'فایل بازخورد', 'سایر فایل'],
  'content-production': ['عکس', 'اینفوگرافیک', 'فایل آموزشی', 'سایر فایل'],
  'book-reading': ['فایل Excel اعضا', 'فایل یا خلاصه جلسه', 'سایر فایل'],
}

function isSpreadsheet(fileName: string) {
  return /\.(xlsx?|csv)$/i.test(fileName)
}

const sectionIcon: Record<ProvinceContentSectionId, string> = {
  webinars: '◉',
  'in-person': '⌖',
  circulars: '▤',
  campaign: '✦',
  'lived-experiences': '❧',
  'clinical-supervision': '◎',
  'content-production': '▧',
  'book-reading': '◧',
}

export const OstanPage: React.FC<{ onPublishedContentChange: (items: ProvinceContentRecord[], provinceId: string) => void; notify: (message: string) => void }> = ({ onPublishedContentChange, notify }) => {
  const [province, setProvince] = useState<ProvinceIdentity | null>(null)
  const [items, setItems] = useState<ProvinceContentRecord[]>([])
  const [activeSection, setActiveSection] = useState<ProvinceContentSectionId>('webinars')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [attachmentLabel, setAttachmentLabel] = useState('')
  const [uploading, setUploading] = useState(false)

  const loadItems = useCallback(async (identity: ProvinceIdentity) => {
    const response = await fetch('/api/province-content', { credentials: 'same-origin' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'بارگذاری محتوای استان انجام نشد.')
    const loaded = (data.items || []) as ProvinceContentRecord[]
    const safeIdentity: ProvinceIdentity = {
      ...identity,
      allowedSections: Array.isArray(identity.allowedSections) ? identity.allowedSections : [],
    }
    setItems(loaded)
    onPublishedContentChange(loaded, safeIdentity.id)
    setProvince(safeIdentity)
    if (safeIdentity.allowedSections.length) {
      setActiveSection(current => safeIdentity.allowedSections.includes(current) ? current : safeIdentity.allowedSections[0])
    }
  }, [onPublishedContentChange])

  useEffect(() => {
    let active = true
    fetch('/api/session', { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) return null
        return response.json()
      })
      .then(async data => {
        if (active && data?.role === 'ostan' && data.province) {
          await loadItems(data.province)
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [loadItems])

  const counts = useMemo(() => {
    const map = new Map<ProvinceContentSectionId, number>()
    items.forEach(item => map.set(item.sectionId, (map.get(item.sectionId) || 0) + 1))
    return map
  }, [items])

  const currentItems = items.filter(item => item.sectionId === activeSection)
  const currentSection = PROVINCE_SECTION_META.find(section => section.id === activeSection)!

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!username.trim() || !password) {
      setError('نام کاربری و رمز عبور را وارد کنید.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/ostan-auth', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || data.error || 'ورود انجام نشد.')
      if (!data.province?.id || !data.province?.name) throw new Error('پاسخ ورود معتبر نیست؛ دوباره تلاش کنید.')
      await loadItems(data.province)
      setUsername('')
      setPassword('')
      setShowPassword(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ورود به پنل استان.')
    } finally {
      setBusy(false)
    }
  }

  const beginNew = (recordType: Draft['recordType'] = 'content') => {
    setEditingId(null)
    setDraft({ ...blankDraft, recordType })
    setAttachmentLabel(attachmentLabels[activeSection][0] || 'پیوست')
    setFormOpen(true)
  }

  const beginEdit = (item: ProvinceContentRecord) => {
    setFormOpen(true)
    setEditingId(item.id)
    const legacyAttachment: ProvinceAttachment[] = item.attachmentUrl
      ? [{ id: `legacy-${item.id}`, label: 'پیوست قدیمی', fileName: item.attachmentName || 'فایل پیوست', access: 'public', url: item.attachmentUrl }]
      : []
    setDraft({
      title: item.title,
      description: item.description,
      date: item.date || '',
      linkUrl: item.linkUrl || '',
      attachments: item.attachments || legacyAttachment,
      recordType: item.recordType || 'content',
      internalDetails: item.internalDetails || '',
    })
    setAttachmentLabel(attachmentLabels[item.sectionId][0] || 'پیوست')
  }

  const uploadAttachment = async (file?: File) => {
    if (!file) return
    setUploading(true)
    setError('')
    const access = 'private' as const
    const publishable = !isSpreadsheet(file.name) && draft.recordType !== 'daily-activity'
    try {
      const result = await uploadToBlob(file, access)
      if (access === 'private' ? !result.pathname : !result.url) throw new Error(result.error || 'بارگذاری فایل انجام نشد.')
      const attachment: ProvinceAttachment = {
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label: attachmentLabel || (access === 'private' ? 'فایل خصوصی' : 'پیوست'),
        fileName: file.name,
        access,
        publishable,
        ...(access === 'private' ? { pathname: result.pathname } : { url: result.url }),
        contentType: result.contentType || file.type || 'application/octet-stream',
      }
      setDraft(previous => ({ ...previous, attachments: [...previous.attachments, attachment] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بارگذاری فایل.')
    } finally {
      setUploading(false)
    }
  }

  const saveItem = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!province) return
    if (!draft.title.trim()) {
      setError('عنوان محتوا الزامی است.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = { ...draft, sectionId: activeSection, ...(editingId ? { id: editingId } : {}) }
      const response = await fetch('/api/province-content', {
        method: editingId ? 'PUT' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره محتوا انجام نشد.')
      const next = editingId
        ? items.map(item => item.id === editingId ? data.item as ProvinceContentRecord : item)
        : [data.item as ProvinceContentRecord, ...items]
      setItems(next)
      onPublishedContentChange(next, province.id)
      setDraft(blankDraft)
      setEditingId(null)
      setFormOpen(false)
      notify('محتوا ثبت شد و در انتظار بررسی مدیر است.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت محتوا.')
    } finally {
      setBusy(false)
    }
  }

  const removeItem = async (item: ProvinceContentRecord) => {
    if (!window.confirm(`«${item.title}» حذف شود؟ این محتوا از صفحه عمومی نیز برداشته می‌شود.`)) return
    try {
      const response = await fetch('/api/province-content', {
        method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'حذف محتوا انجام نشد.')
      const next = items.filter(row => row.id !== item.id)
      setItems(next)
      if (province) onPublishedContentChange(next, province.id)
      notify('محتوا از سایت حذف شد.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در حذف محتوا.')
    }
  }

  const logout = async () => {
    await fetch('/api/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }).catch(() => {})
    setProvince(null)
    setItems([])
    setUsername('')
    setPassword('')
    setShowPassword(false)
    setError('')
  }

  if (loading && !province) {
    return <div className="province-admin-shell min-h-screen flex items-center justify-center text-slate-300"><Loader2 className="animate-spin ml-3 text-amber-400" />در حال بررسی نشست استان…</div>
  }

  if (!province) {
    return (
      <main className="province-login-shell" dir="rtl">
        <div className="province-login-orbit province-login-orbit--one" aria-hidden="true" />
        <div className="province-login-orbit province-login-orbit--two" aria-hidden="true" />
        <section className="province-login-card" aria-labelledby="province-login-title">
          <div className="province-login-glow" aria-hidden="true" />
          <div className="province-login-heading">
            <div className="province-login-badge"><ShieldCheck size={14} aria-hidden="true" /><span>دبیرخانه کشوری درس‌پژوهی و درس‌کاوی</span></div>
            <div className="province-login-icon" aria-hidden="true"><KeyRound size={30} /></div>
            <h1 id="province-login-title" className="font-titr">ورود به پنل استان</h1>
            <p>برای مدیریت محتوای استان، با حساب اختصاص‌یافته از سوی دبیرخانه وارد شوید.</p>
          </div>
          <div className="province-login-divider" aria-hidden="true"><span /></div>
          <form onSubmit={handleLogin} className="province-login-form" noValidate>
            <div className="province-login-field">
              <label htmlFor="province-username">نام کاربری استان</label>
              <div className="province-login-input-wrap">
                <UserRound className="province-login-input-icon" size={19} aria-hidden="true" />
                <input id="province-username" name="username" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={40} value={username} onChange={event => setUsername(event.target.value)} placeholder="نام کاربری" aria-invalid={Boolean(error)} aria-describedby={error ? 'province-login-error' : undefined} />
              </div>
            </div>
            <div className="province-login-field">
              <label htmlFor="province-password">رمز عبور</label>
              <div className="province-login-input-wrap">
                <KeyRound className="province-login-input-icon" size={19} aria-hidden="true" />
                <input id="province-password" name="password" dir="ltr" autoComplete="current-password" type={showPassword ? 'text' : 'password'} maxLength={512} value={password} onChange={event => setPassword(event.target.value)} placeholder="رمز عبور" aria-invalid={Boolean(error)} aria-describedby={error ? 'province-login-error' : undefined} />
                <button type="button" className="province-login-eye" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'} aria-pressed={showPassword}>
                  {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                </button>
              </div>
            </div>
            {error && <div id="province-login-error" role="alert" className="province-login-error"><ShieldAlert size={17} aria-hidden="true" /><span>{error}</span></div>}
            <button type="submit" disabled={busy} aria-busy={busy} className="province-login-submit font-titr">
              {busy ? <Loader2 size={19} className="animate-spin" aria-hidden="true" /> : <LogIn size={19} aria-hidden="true" />}
              <span>{busy ? 'در حال بررسی…' : 'ورود امن به پنل'}</span>
            </button>
          </form>
          <div className="province-login-footer">
            <span><ShieldCheck size={15} aria-hidden="true" /> ورود ویژه حساب‌های استانی</span>
            <a href="/"><ArrowLeft size={16} aria-hidden="true" /> بازگشت به صفحه اصلی</a>
          </div>
        </section>
      </main>
    )
  }

  return (
    <div className="province-admin-shell min-h-screen text-slate-100">
      <div className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">
        <header className="province-panel-header rounded-3xl border border-white/10 bg-white/[0.045] backdrop-blur-xl p-5 sm:p-6 mb-6 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center"><UsersRound className="text-emerald-300" /></div>
          <div className="flex-1 min-w-52">
            <h1 className="font-titr text-xl sm:text-2xl text-white">پنل {province.name}</h1>
          </div>
          <button type="button" onClick={() => void loadItems(province).catch(() => setError('تازه‌سازی وضعیت انجام نشد.'))} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 flex items-center gap-2 text-xs"><RefreshCw size={15} />تازه‌سازی وضعیت</button>
          <button type="button" onClick={() => { window.location.href = '/' }} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center gap-2 text-xs"><ExternalLink size={15} />مشاهده سایت</button>
          <button type="button" onClick={() => void logout()} className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-400/20 text-rose-200 hover:bg-rose-500/20 flex items-center gap-2 text-xs"><ArrowRightFromLine size={15} />خروج</button>
        </header>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3 mb-6 flex items-start gap-3 text-sm text-emerald-100/90 leading-7">
          <CheckCircle2 size={18} className="text-emerald-300 mt-1 shrink-0" />
          <p>محتوای تازه و هر ویرایش دوباره برای بررسی ارسال می‌شود و فقط پس از انتشار مدیر در صفحه موضوع دیده خواهد شد. جزئیات داخلی و فایل‌های Excel خصوصی می‌مانند؛ پیوندهای خارجی ممکن است از قبل عمومی باشند.</p>
        </div>

        {province.allowedSections.length === 0 ? (
          <section className="rounded-3xl border border-amber-400/25 bg-amber-500/[0.06] p-6 sm:p-9 text-center">
            <ShieldCheck size={30} className="mx-auto mb-4 text-amber-300" />
            <h2 className="font-titr text-lg text-white">هنوز دسترسی بخشی برای این حساب فعال نشده است</h2>
            <p className="font-nazanin text-slate-300 leading-7 max-w-2xl mx-auto mt-3">برای افزودن، ویرایش یا حذف محتوا، دبیرخانه باید دسترسی یک یا چند بخش را برای استان شما فعال کند. محتوای ثبت‌شده قبلی حذف نشده و پس از اعطای مجوز دوباره در دسترس خواهد بود.</p>
          </section>
        ) : (
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <aside className="province-panel-nav w-full lg:w-80 shrink-0 rounded-3xl border border-white/10 bg-slate-950/45 backdrop-blur-xl p-4 lg:sticky lg:top-5">
            <h2 className="font-titr text-sm text-white px-2 mb-1">بخش‌های سایت</h2>
            <nav className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {PROVINCE_SECTION_META.filter(section => province.allowedSections.includes(section.id)).map(section => {
                const selected = activeSection === section.id
                const count = counts.get(section.id) || 0
                return <button key={section.id} type="button" onClick={() => { setActiveSection(section.id); setDraft(blankDraft); setAttachmentLabel(attachmentLabels[section.id][0] || 'پیوست'); setEditingId(null); setFormOpen(false) }} className={`province-section-link ${selected ? 'active' : ''} min-w-0 rounded-xl border px-3 py-3 flex items-center gap-3 text-right transition ${selected ? 'bg-emerald-500/15 border-emerald-400/35 text-white shadow-lg shadow-emerald-950/20' : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-400'}`}>{sectionIcon[section.id]}</span>
                  <span className="flex-1 min-w-0 text-xs leading-5 font-bold">{section.title}</span>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 ${count ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>{count ? count.toLocaleString('fa-IR') : 'خالی'}</span>
                </button>
              })}
            </nav>
          </aside>

          <main className="flex-1 min-w-0 w-full space-y-5">
            <section className="rounded-3xl border border-white/10 bg-white/[0.045] backdrop-blur-xl p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="font-titr text-xl sm:text-2xl text-white">{currentSection.title}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => beginNew('content')} className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-200 hover:bg-emerald-500/25 flex items-center gap-2 text-xs font-bold"><Plus size={16} />{activeSection === 'book-reading' ? 'ثبت نشست کتاب‌خوانی' : 'محتوای تازه'}</button>
                  {activeSection !== 'book-reading' && <button type="button" onClick={() => beginNew('daily-activity')} className="px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-400/20 text-cyan-100 hover:bg-cyan-500/20 flex items-center gap-2 text-xs font-bold"><Plus size={15} />گزارش روزانه</button>}
                </div>
              </div>

              {formOpen && (
                <form onSubmit={saveItem} className="rounded-2xl border border-emerald-400/20 bg-slate-950/35 p-4 sm:p-5 mb-6 space-y-4">
                  <div className="flex items-center justify-between gap-2"><h3 className="font-titr text-base text-white">{editingId ? 'ویرایش محتوا' : draft.recordType === 'daily-activity' ? 'ثبت گزارش روزانه' : activeSection === 'book-reading' ? 'ثبت نشست کتاب‌خوانی' : 'ثبت محتوای تازه'}</h3><button type="button" onClick={() => { setDraft(blankDraft); setEditingId(null); setFormOpen(false) }} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/10"><X size={17} /></button></div>
                  {error && <p className="text-xs text-rose-200 leading-6">{error}</p>}
                  <label className="block text-xs text-slate-300">{activeSection === 'book-reading' ? 'عنوان کتاب *' : draft.recordType === 'daily-activity' ? 'عنوان گزارش روزانه *' : 'عنوان محتوا *'}</label>
                  <input className="dusk-input" value={draft.title} onChange={event => setDraft(previous => ({ ...previous, title: event.target.value }))} maxLength={200} required placeholder={activeSection === 'book-reading' ? 'نام کتاب و موضوع نشست' : 'عنوانی روشن و کوتاه'} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-300 mb-2">تاریخ (اختیاری)</label>
                      <JalaliDateInput
                        value={draft.date}
                        onChange={date => setDraft(previous => ({ ...previous, date }))}
                        placeholder="انتخاب تاریخ شمسی"
                        ariaLabel="تاریخ محتوای استانی"
                      />
                    </div>
                    <div><label className="block text-xs text-slate-300 mb-2">پیوند عمومی (اختیاری)</label><input dir="ltr" className="dusk-input" value={draft.linkUrl} onChange={event => setDraft(previous => ({ ...previous, linkUrl: event.target.value }))} placeholder="https://…" /></div>
                  </div>
                  <div><label className="block text-xs text-slate-300 mb-2">{draft.recordType === 'daily-activity' ? 'خلاصه قابل انتشار برای عموم *' : activeSection === 'book-reading' ? 'خلاصه عمومی نشست‌ها' : 'شرح / توضیحات عمومی'}</label><textarea className="dusk-input min-h-28 resize-y" value={draft.description} onChange={event => setDraft(previous => ({ ...previous, description: event.target.value }))} maxLength={6000} required={draft.recordType === 'daily-activity'} placeholder="خلاصه و اطلاعاتی را بنویسید که انتشار عمومی آن‌ها مجاز است…" /></div>
                  {(draft.recordType === 'daily-activity' || activeSection === 'book-reading') && <div><label className="block text-xs text-slate-300 mb-2">{activeSection === 'book-reading' ? 'صورت‌جلسه و جزئیات داخلی نشست' : 'جزئیات داخلی گزارش — فقط دبیرخانه می‌بیند'}</label><textarea className="dusk-input min-h-32 resize-y" value={draft.internalDetails} onChange={event => setDraft(previous => ({ ...previous, internalDetails: event.target.value }))} maxLength={20000} placeholder="جزئیات تکمیلی را وارد کنید؛ این بخش در سایت عمومی منتشر نمی‌شود." /></div>}
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                      <div><label className="block text-xs text-slate-300 mb-2">نوع فایل</label><select className="dusk-input" value={attachmentLabel} onChange={event => setAttachmentLabel(event.target.value)}>{attachmentLabels[activeSection].map(label => <option key={label} value={label}>{label}</option>)}</select></div>
                      <label className={`px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs cursor-pointer flex items-center gap-2 hover:bg-white/10 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}><FileUp size={16} />{uploading ? 'در حال بارگذاری…' : 'افزودن پیوست'}<input type="file" className="hidden" onChange={event => { void uploadAttachment(event.target.files?.[0]); event.currentTarget.value = '' }} /></label>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-6">فایل‌ها تا انتشار توسط مدیر خصوصی می‌مانند. فایل‌های Excel/CSV و پیوست گزارش روزانه خصوصی‌اند و پس از انتشار نیز محرمانه می‌مانند.</p>
                    {draft.attachments.length > 0 && <ul className="space-y-2">{draft.attachments.map(file => <li key={file.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-xs"><span className="text-emerald-200 font-bold">{file.label}</span><span className="text-slate-300 break-all flex-1">{file.fileName}</span><span className={`rounded-full px-2 py-0.5 ${file.access === 'private' ? 'bg-amber-500/10 text-amber-200' : 'bg-cyan-500/10 text-cyan-200'}`}>{file.access === 'private' ? (file.publishable ? 'قابل انتشار پس از تأیید' : 'همیشه خصوصی') : 'پیوند عمومی قدیمی'}</span><button type="button" onClick={() => setDraft(previous => ({ ...previous, attachments: previous.attachments.filter(item => item.id !== file.id) }))} className="text-rose-300 hover:text-rose-200">حذف از ثبت</button></li>)}</ul>}
                  </div>
                  {error && <p className="text-xs text-amber-200 leading-6">{error}</p>}
                  <div className="flex justify-end"><button disabled={busy || uploading} className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-emerald-500 to-teal-500 text-slate-950 text-xs font-titr flex items-center gap-2 disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{busy ? 'در حال ذخیره…' : 'ثبت برای بررسی'}</button></div>
                </form>
              )}

              {error && !formOpen && <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs text-rose-100">{error}</div>}

              {currentItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/20 py-12 text-center"><div className="text-3xl text-slate-600 mb-3">{sectionIcon[activeSection]}</div><p className="font-titr text-sm text-slate-300">هنوز محتوایی در این بخش ثبت نشده است</p></div>
              ) : (
                <div className="space-y-3">
                  {currentItems.map(item => <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 flex flex-wrap items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center shrink-0">{sectionIcon[item.sectionId]}</div>
                    <div className="flex-1 min-w-48"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm text-white font-bold">{item.title}</h3>{item.recordType === 'daily-activity' && <span className="text-[10px] rounded-full bg-cyan-500/10 text-cyan-200 px-2 py-0.5">گزارش روزانه</span>}<span className="text-xs rounded-full bg-amber-500/15 text-amber-200 px-2 py-1">{statusLabels[provinceStatus(item)]}</span></div>{item.date && <p className="text-[11px] text-amber-200 mt-1">{item.date}</p>}{item.description && <p className="text-xs text-slate-400 leading-6 mt-2 whitespace-pre-wrap">{item.description}</p>}{item.reviewNote && <p className="text-xs text-amber-200 mt-2 whitespace-pre-wrap">نظر مدیر: {item.reviewNote}</p>}{item.internalDetails && <details className="mt-2 text-xs text-slate-400"><summary className="cursor-pointer text-amber-200">جزئیات داخلی</summary><p className="leading-6 mt-1 whitespace-pre-wrap">{item.internalDetails}</p></details>}
                      <div className="flex flex-wrap gap-3 mt-3">{(item.attachments || []).map(file => <span key={file.id} className="text-[11px] text-slate-300 inline-flex items-center gap-1.5"><FileUp size={12} />{file.label}: {file.fileName} {file.access === 'private' ? '(خصوصی)' : ''}</span>)}{item.attachmentUrl && <a href={item.attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1.5"><Download size={13} />{item.attachmentName || 'مشاهده / دانلود پیوست'}</a>}{item.linkUrl && <a href={item.linkUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-1.5"><ExternalLink size={13} />پیوند مرتبط</a>}</div>
                    </div>
                    <div className="flex items-center gap-1"><button type="button" onClick={() => beginEdit(item)} className="px-3 py-2 rounded-lg text-xs text-cyan-200 hover:bg-cyan-500/10">ویرایش</button><button type="button" onClick={() => void removeItem(item)} className="p-2 rounded-lg text-rose-300 hover:bg-rose-500/10" title="حذف"><Trash2 size={16} /></button></div>
                  </article>)}
                </div>
              )}
            </section>
          </main>
        </div>
        )}
        <footer className="text-center text-xs text-slate-500 mt-8 pt-5 border-t border-white/10">دبیرخانه کشوری درس پژوهی و درس کاوی</footer>
      </div>
    </div>
  )
}
