import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileText, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, UsersRound, Power, X } from 'lucide-react'
import { PROVINCE_SECTION_META as PROVINCIAL_EDITABLE_SECTIONS } from '@/src/province-access'
import { SORTED_PROVINCE_UNITS } from '@/src/provinces'
import type { ProvinceAttachment, ProvinceContentRecord, ProvinceContentSectionId } from '@/src/types'

type AccountRow = {
  provinceId: string
  provinceName: string
  username: string | null
  active: boolean
  allowedSections: ProvinceContentSectionId[]
  updatedAt: string | null
}

export const ProvinceAccountsPanel: React.FC<{ notify: (message: string) => void }> = ({ notify }) => {
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<AccountRow | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [allowedSections, setAllowedSections] = useState<ProvinceContentSectionId[]>([])
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activePanel, setActivePanel] = useState<'accounts' | 'content'>('accounts')
  const [provinceItems, setProvinceItems] = useState<ProvinceContentRecord[]>([])
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState('')
  const [contentSearch, setContentSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/province-accounts', { credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'دریافت حساب‌ها ناموفق بود.')
      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ارتباط با سرور برقرار نشد.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshProvinceContent = useCallback(async () => {
    setContentLoading(true)
    setContentError('')
    try {
      const response = await fetch('/api/province-content?all=1', { credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'دریافت محتوای استان‌ها ناموفق بود.')
      setProvinceItems(data.items || [])
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'ارتباط با سرور برقرار نشد.')
    } finally {
      setContentLoading(false)
    }
  }, [])

  const downloadPrivateAttachment = async (item: ProvinceContentRecord, file: ProvinceAttachment) => {
    setContentError('')
    try {
      const params = new URLSearchParams({ downloadId: item.id, attachmentId: file.id })
      const response = await fetch(`/api/province-content?${params}`, { credentials: 'same-origin' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'دریافت فایل خصوصی انجام نشد.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.fileName || 'private-file'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'دریافت فایل خصوصی ناموفق بود.')
    }
  }

  useEffect(() => { void refresh() }, [refresh])

  const accountMap = useMemo(() => new Map(accounts.map(account => [account.provinceId, account])), [accounts])
  const ordered = useMemo(() => SORTED_PROVINCE_UNITS
    .map(unit => accountMap.get(unit.id) || ({ provinceId: unit.id, provinceName: unit.name, username: null, active: false, allowedSections: [], updatedAt: null }))
    .filter(account => !search.trim() || account.provinceName.includes(search.trim()) || (account.username || '').toLowerCase().includes(search.trim().toLowerCase())), [accountMap, search])
  const activeCount = accounts.filter(account => account.username && account.active).length
  const createdCount = accounts.filter(account => account.username).length

  const openEditor = (account: AccountRow) => {
    setEditing(account)
    setUsername(account.username || '')
    setPassword('')
    setAllowedSections(account.allowedSections || [])
  }

  const toggleSection = (sectionId: ProvinceContentSectionId) => {
    setAllowedSections(current => current.includes(sectionId)
      ? current.filter(id => id !== sectionId)
      : [...current, sectionId])
  }

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError('')
    try {
      const isNew = !editing.username
      const response = await fetch('/api/province-accounts', {
        method: isNew ? 'POST' : 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provinceId: editing.provinceId, username, password: password || undefined, allowedSections }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'ذخیره حساب انجام نشد.')
      setEditing(null)
      setPassword('')
      notify(isNew ? `حساب ${editing.provinceName} ساخته شد.` : `حساب ${editing.provinceName} به‌روزرسانی شد.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره حساب.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (account: AccountRow) => {
    try {
      const response = await fetch('/api/province-accounts', {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provinceId: account.provinceId, active: !account.active }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'تغییر وضعیت انجام نشد.')
      await refresh()
      notify(`دسترسی ${account.provinceName} ${account.active ? 'غیرفعال' : 'فعال'} شد.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در تغییر وضعیت حساب.')
    }
  }

  const deleteAccount = async (account: AccountRow) => {
    if (!window.confirm(`حساب ورود «${account.provinceName}» حذف شود؟ محتوای منتشرشده استان حذف نمی‌شود.`)) return
    try {
      const response = await fetch('/api/province-accounts', {
        method: 'DELETE', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provinceId: account.provinceId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'حذف حساب انجام نشد.')
      await refresh()
      notify(`حساب ${account.provinceName} حذف شد.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در حذف حساب.')
    }
  }

  const filteredProvinceItems = provinceItems.filter(item => !contentSearch.trim() || `${item.provinceName} ${item.title}`.toLowerCase().includes(contentSearch.trim().toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="مدیریت حساب‌ها و محتوای استان‌ها">
        <button type="button" role="tab" aria-selected={activePanel === 'accounts'} onClick={() => { setActivePanel('accounts'); setEditing(null) }} className={`px-4 py-2.5 rounded-xl border text-sm font-bold ${activePanel === 'accounts' ? 'bg-amber-500/15 border-amber-400/30 text-amber-100' : 'bg-white/5 border-white/10 text-slate-400'}`}><UsersRound size={15} className="inline ml-2" />حساب‌های استان‌ها</button>
        <button type="button" role="tab" aria-selected={activePanel === 'content'} onClick={() => { setActivePanel('content'); setEditing(null); if (!provinceItems.length && !contentLoading) void refreshProvinceContent() }} className={`px-4 py-2.5 rounded-xl border text-sm font-bold ${activePanel === 'content' ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-100' : 'bg-white/5 border-white/10 text-slate-400'}`}><FileText size={15} className="inline ml-2" />محتوای استانی و گزارش‌ها</button>
      </div>
      <section className={`dusk-card p-5 sm:p-7 ${activePanel === 'accounts' ? '' : 'hidden'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-titr text-xl text-white flex items-center gap-2"><UsersRound className="text-amber-400" /> حساب‌های پنل استان‌ها</h2>
            <p className="font-nazanin text-slate-400 mt-2">برای هر استان حساب مستقل بسازید. رمزها به‌صورت امن هش می‌شوند و در پنل مدیر نمایش داده نمی‌شوند.</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10" title="بارگذاری دوباره">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-4 sm:p-5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl border border-cyan-300/20 bg-cyan-400/10 flex items-center justify-center shrink-0"><ShieldCheck size={19} className="text-cyan-200" /></div>
            <div>
              <h3 className="font-titr text-base text-white">دسترسی حساب‌های استانی</h3>
              <p className="font-nazanin text-sm text-slate-300 mt-1">مجوز افزودن، ویرایش و حذف محتوا برای هر استان جداگانه از کارت همان حساب تعیین می‌شود. حساب‌های تازه و موجود به‌طور پیش‌فرض هیچ بخشی را مجاز ندارند.</p>
            </div>
          </div>
          <ul aria-label="هشت بخشی که دسترسی آن‌ها برای هر استان جداگانه تنظیم می‌شود" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 list-none m-0 p-0">
            {PROVINCIAL_EDITABLE_SECTIONS.map(section => (
              <li key={section.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs sm:text-sm text-slate-200">
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-cyan-300/70 shrink-0" />
                <span>{section.title}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><span className="text-slate-400 text-xs">کل واحدهای استانی</span><strong className="block text-white text-2xl mt-1">۳۲</strong></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><span className="text-slate-400 text-xs">حساب‌های ایجادشده</span><strong className="block text-cyan-300 text-2xl mt-1">{createdCount.toLocaleString('fa-IR')}</strong></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4"><span className="text-slate-400 text-xs">حساب‌های فعال</span><strong className="block text-emerald-300 text-2xl mt-1">{activeCount.toLocaleString('fa-IR')}</strong></div>
        </div>

        {error && <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100"><ShieldCheck size={17} className="inline ml-2 text-amber-300" />{error}</div>}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input value={search} onChange={event => setSearch(event.target.value)} className="dusk-input flex-1 min-w-56" placeholder="جست‌وجوی استان یا نام کاربری" />
          <span className="text-xs text-slate-500">تهران و شهرستان‌های تهران، مطابق الگوی مرجع، دو حساب جدا دارند.</span>
        </div>

        {loading && accounts.length === 0 ? (
          <div className="py-12 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-3 text-amber-400" />در حال دریافت فهرست حساب‌ها…</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {ordered.map(account => (
              <article key={account.provinceId} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${account.username && account.active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}><UserRound size={19} /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm">{account.provinceName}</h3>
                  <p className="text-xs text-slate-400 mt-1" dir="ltr">{account.username || 'حسابی ایجاد نشده'}</p>
                  <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-[10px] border ${!account.username ? 'text-slate-400 border-slate-700 bg-slate-800/60' : account.active ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-300 border-amber-500/30 bg-amber-500/10'}`}>
                    {!account.username ? 'بدون حساب' : account.active ? 'فعال' : 'غیرفعال'}
                  </span>
                  <p className="text-[10px] text-cyan-100/80 mt-2 leading-5">{account.username
                    ? account.allowedSections.length
                      ? `${account.allowedSections.length.toLocaleString('fa-IR')} بخش مجاز: ${PROVINCIAL_EDITABLE_SECTIONS.filter(section => account.allowedSections.includes(section.id)).map(section => section.title).join('، ')}`
                      : 'بدون دسترسی بخشی؛ محتوای قبلی حفظ می‌شود.'
                    : 'دسترسی‌ها هنگام ایجاد حساب تنظیم می‌شوند؛ پیش‌فرض بسته است.'}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {account.username && <button type="button" onClick={() => void toggleActive(account)} className="p-2 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-white/5" title={account.active ? 'غیرفعال‌کردن' : 'فعال‌کردن'}><Power size={16} /></button>}
                  {account.username && <button type="button" onClick={() => void deleteAccount(account)} className="p-2 rounded-lg text-slate-300 hover:text-red-300 hover:bg-red-500/10" title="حذف حساب"><Trash2 size={16} /></button>}
                  <button type="button" onClick={() => openEditor(account)} className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-200 text-xs font-bold hover:bg-amber-500/25 flex items-center gap-1.5"><KeyRound size={14} />{account.username ? 'مدیریت' : 'ایجاد حساب'}</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {activePanel === 'content' && (
        <section className="dusk-card p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-titr text-xl text-white">محتوای استان‌ها و جزئیات داخلی</h2>
              <p className="text-sm text-slate-400 mt-2 leading-6">خلاصه‌ها در سایت عمومی نمایش داده می‌شوند؛ جزئیات داخلی و فایل‌های Excel خصوصی فقط در این پنل مدیر دیده می‌شوند.</p>
            </div>
            <button type="button" onClick={() => void refreshProvinceContent()} disabled={contentLoading} className="p-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white"><RefreshCw size={17} className={contentLoading ? 'animate-spin' : ''} /></button>
          </div>
          {contentError && <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-100">{contentError}</div>}
          <input value={contentSearch} onChange={event => setContentSearch(event.target.value)} className="dusk-input mb-4" placeholder="جست‌وجوی استان یا عنوان محتوا" />
          {contentLoading && !provinceItems.length ? (
            <div className="py-12 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-3 text-cyan-300" />در حال دریافت محتوای استان‌ها…</div>
          ) : !filteredProvinceItems.length ? (
            <div className="py-10 text-center text-slate-400">هنوز محتوایی برای نمایش ثبت نشده است.</div>
          ) : (
            <div className="space-y-3">
              {filteredProvinceItems.map(item => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-bold text-white">{item.title}</h3><p className="text-xs text-cyan-200 mt-1">{item.provinceName} · {PROVINCIAL_EDITABLE_SECTIONS.find(section => section.id === item.sectionId)?.title || item.sectionId}{item.date ? ` · ${item.date}` : ''}</p></div>
                    {item.recordType === 'daily-activity' && <span className="text-[10px] rounded-full bg-cyan-500/10 text-cyan-200 px-2 py-1">گزارش روزانه</span>}
                  </div>
                  {item.description && <p className="text-sm text-slate-300 leading-7 mt-3 whitespace-pre-wrap">{item.description}</p>}
                  {item.internalDetails && <details className="mt-3 rounded-xl border border-amber-400/15 bg-amber-500/[0.04] p-3"><summary className="cursor-pointer text-xs font-bold text-amber-200">جزئیات داخلی دبیرخانه</summary><p className="text-sm text-slate-300 leading-7 mt-2 whitespace-pre-wrap">{item.internalDetails}</p></details>}
                  {(item.attachments || []).length > 0 && <div className="flex flex-wrap gap-2 mt-4">{item.attachments!.map(file => file.access === 'private' ? <button key={file.id} type="button" onClick={() => void downloadPrivateAttachment(item, file)} className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100 inline-flex items-center gap-2"><Download size={13} />دریافت خصوصی: {file.fileName}</button> : <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-400/20 bg-cyan-500/[0.06] px-3 py-2 text-xs text-cyan-100 inline-flex items-center gap-2"><Download size={13} />{file.label || file.fileName}</a>)}</div>}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {editing && (
        <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => !saving && setEditing(null)}>
          <form onSubmit={saveAccount} onClick={event => event.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-amber-400/30 bg-[#0b1222] shadow-2xl p-6 relative">
            <button type="button" disabled={saving} onClick={() => setEditing(null)} className="absolute left-4 top-4 p-1.5 rounded-lg text-slate-400 hover:bg-white/10"><X size={18} /></button>
            <h3 className="font-titr text-lg text-white mb-1">{editing.username ? 'مدیریت حساب' : 'ایجاد حساب'} {editing.provinceName}</h3>
            <p className="text-xs leading-6 text-slate-400 mb-5">حساب فقط به محتوای همین واحد استانی دسترسی دارد. رمز عبور حداقل ۱۰ نویسه باشد.</p>
            <label className="block text-xs text-slate-300 mb-2">نام کاربری</label>
            <input value={username} onChange={event => setUsername(event.target.value)} className="dusk-input mb-4" dir="ltr" autoComplete="off" required minLength={3} maxLength={40} pattern="[A-Za-z0-9._-]+" />
            <label className="block text-xs text-slate-300 mb-2">{editing.username ? 'رمز جدید (خالی بماند تا تغییر نکند)' : 'رمز عبور اولیه'}</label>
            <input value={password} onChange={event => setPassword(event.target.value)} className="dusk-input mb-5" type="password" dir="ltr" autoComplete="new-password" minLength={editing.username && !password ? undefined : 10} required={!editing.username} />
            <div className="mb-5 rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="font-titr text-sm text-white">مجوز بخش‌ها</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-5">انتخاب هر بخش، افزودن، ویرایش و حذف محتوای همان بخش را برای این استان مجاز می‌کند.</p>
                </div>
                <span className="text-[10px] text-amber-200 whitespace-nowrap">{allowedSections.length.toLocaleString('fa-IR')} از ۸</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PROVINCIAL_EDITABLE_SECTIONS.map(section => (
                  <label key={section.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs cursor-pointer transition ${allowedSections.includes(section.id) ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.06]'}`}>
                    <input type="checkbox" className="accent-emerald-400" checked={allowedSections.includes(section.id)} onChange={() => toggleSection(section.id)} />
                    <span>{section.title}</span>
                  </label>
                ))}
              </div>
              {!allowedSections.length && <p className="text-[10px] text-amber-200/80 mt-3">در حال حاضر دسترسی به همه بخش‌ها بسته است. محتوای قبلی حذف نمی‌شود.</p>}
            </div>
            {error && <p className="text-xs text-red-300 mb-4">{error}</p>}
            <button type="submit" disabled={saving} className="w-full rounded-xl px-4 py-3 bg-gradient-to-l from-amber-500 to-orange-500 text-slate-950 font-titr text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />}{saving ? 'در حال ذخیره…' : 'ذخیره حساب'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
