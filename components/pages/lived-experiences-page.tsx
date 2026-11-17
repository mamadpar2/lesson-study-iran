import React, { useState } from 'react'
import { BookOpenCheck, UploadCloud, FileText, FileCode } from 'lucide-react'
import { PageHeader } from './page-header'
import { sampleNarratives, type NarrativeSample } from '@/src/data'
import { uploadToBlob, saveExperienceToNeon } from '@/lib/api-client'
import { PROVINCE_UNITS } from '@/src/provinces'
import { MiniNoticeDialog } from '@/components/ui/mini-notice-dialog'
import type { Experience } from '@/src/types'

interface LivedExperiencesPageProps {
  onBack: () => void
  notify: (msg: string) => void
  narratives?: NarrativeSample[]
}

const MAX_EXPERIENCE_FILE_BYTES = 3 * 1024 * 1024

const toEnglishDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => {
  const code = digit.charCodeAt(0)
  return String.fromCharCode(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 + 48 : code - 0x0660 + 48)
})

export const LivedExperiencesPage: React.FC<LivedExperiencesPageProps> = ({ onBack, notify, narratives }) => {
  const [showSubmitForm, setShowSubmitForm] = useState(false)
  const sourceNarratives = narratives !== undefined ? narratives : sampleNarratives

  // Personal fields are submitted to the private server endpoint and are not cached in browser storage.
  const [name, setName] = useState('')
  const [nationalCode, setNationalCode] = useState('')
  const [personnelCode, setPersonnelCode] = useState('')
  const [serviceYears, setServiceYears] = useState('')
  const [school, setSchool] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileLink, setFileLink] = useState('')
  const [fileError, setFileError] = useState('')
  const [duplicateNotice, setDuplicateNotice] = useState('')
  const [consent, setConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    setFileError('')
    if (!selected) {
      setFile(null)
      return
    }
    const lowerName = selected.name.toLowerCase()
    const isPdf = selected.type === 'application/pdf' || lowerName.endsWith('.pdf')
    const isDoc = selected.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || lowerName.endsWith('.docx')
    if (!isPdf && !isDoc) {
      setFileError('فقط فایل‌های PDF یا DOCX مجاز هستند.')
      setFile(null)
      return
    }
    if (selected.size <= 0) {
      setFileError('فایل خالی قابل بارگذاری نیست.')
      setFile(null)
      return
    }
    if (selected.size > MAX_EXPERIENCE_FILE_BYTES) {
      setFileError('حجم فایل بیشتر از ۳ مگابایت است؛ فایل را در فضای ابری قرار دهید و پیوند آن را در کادر لینک وارد کنید.')
      setFile(null)
      return
    }
    setFile(selected)
    setFileLink('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFileError('')
    if (!/^\d{10}$/.test(nationalCode)) {
      setFileError('کد ملی باید دقیقاً ۱۰ رقم باشد.')
      return
    }
    if (!/^\d{8}$/.test(personnelCode)) {
      setFileError('کد پرسنلی باید دقیقاً ۸ رقم باشد.')
      return
    }
    if (!/^09\d{9}$/.test(phone)) {
      setFileError('شماره همراه باید ۱۱ رقم و با 09 آغاز شود.')
      return
    }
    const years = Number(serviceYears)
    if (!serviceYears.trim() || !Number.isSafeInteger(years) || years < 0 || years > 2147483647) {
      setFileError('سابقه خدمت باید یک عدد صحیح و غیرمنفی باشد.')
      return
    }
    if (summary.trim().split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).length < 2) {
      setFileError('خلاصه تجربه باید دست‌کم شامل دو بند جداگانه باشد؛ بین بندها یک خط خالی بگذارید.')
      return
    }
    if (!file && !fileLink.trim()) {
      setFileError('فایل تا سقف ۳ مگابایت بارگذاری کنید یا پیوند فایل را وارد فرمایید.')
      return
    }
    if (!consent) {
      notify('لطفاً گزینه موافقت با انتشار تجربه و رعایت حریم خصوصی دانش‌آموزان را تأیید فرمایید.')
      return
    }

    setIsSubmitting(true)
    try {
      let fileUrl = fileLink.trim()
      let fileUploadToken = ''
      let fileName = fileUrl ? (fileUrl.split('/').pop()?.split('?')[0] || 'پیوند فایل') : ''
      if (file) {
        const upload = await uploadToBlob(file, 'private', 'experience-submission')
        if (!upload.uploadToken) throw new Error(upload.error || 'فایل در فضای خصوصی ذخیره نشد.')
        fileUploadToken = upload.uploadToken
        fileUrl = ''
        fileName = file.name
      }

      const submission: Experience = {
        id: '',
        name: name.trim(),
        nationalCode,
        personnelCode,
        serviceYears: years,
        school: school.trim(),
        province,
        district: district.trim(),
        phone,
        email: email.trim(),
        kind: 'درس‌پژوهی در کلاس درس',
        title: title.trim(),
        summary: summary.trim(),
        fileName,
        fileUrl,
        fileUploadToken,
        savedAt: new Date().toISOString(),
      }
      const saved = await saveExperienceToNeon(submission)
      if (saved.status === 409) {
        setDuplicateNotice(saved.error || 'این کد ملی قبلاً برای ثبت تجربه زیسته ثبت شده است.')
        return
      }
      if (!saved.ok) throw new Error(saved.error || 'اطلاعات تجربه در پایگاه داده ذخیره نشد.')

      notify(`روایت «${submission.title}» با کد پیگیری ${saved.id || 'ثبت‌شده'} برای بررسی ارسال شد.`)
      setShowSubmitForm(false)
      setName('')
      setNationalCode('')
      setPersonnelCode('')
      setServiceYears('')
      setSchool('')
      setProvince('')
      setDistrict('')
      setPhone('')
      setEmail('')
      setTitle('')
      setSummary('')
      setFile(null)
      setFileLink('')
      setConsent(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ثبت تجربه انجام نشد.'
      setFileError(message)
      notify(`ثبت تجربه انجام نشد: ${message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="lived-experiences"
        title="فراخوان تجارب زیسته"
        subtitle="درگاه ملی ثبت و دریافت آثار؛ شامل دسترسی مستقیم به فایل ورد و پی‌دی‌اف آثار منتخب استان‌ها"
        badge="روایت معلمان"
        accentColor="#d5187c"
        onBack={onBack}
      />

      <div className="container dusk-page-content">
        <div className="dusk-action-banner">
          <div>
            <h3 className="font-titr">آیا شما هم روایتی خواندنی از تغییر در کلاستان دارید؟</h3>
            <p>روایت‌های شما پس از داوری علمی، در کتاب سالانه تجارب درس‌پژوهی منتشر و به صورت فایل‌های ورد و پی‌دی‌اف در اختیار معلمان کشور قرار می‌گیرد.</p>
          </div>
          <button
            onClick={() => setShowSubmitForm(!showSubmitForm)}
            className="dusk-action-btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #d5187c 0%, #f37023 100%)' }}
          >
            <UploadCloud size={18} />
            <span className="font-titr">{showSubmitForm ? 'بستن فرم ارسال' : 'ثبت و ارسال تجربه زیسته'}</span>
          </button>
        </div>

        {showSubmitForm && (
          <div className="dusk-card submit-card-box">
            <h3 className="form-card-title font-titr">فرم ثبت تجربه و روایت زیسته معلم</h3>
            <form onSubmit={handleSubmit} className="dusk-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="exp-name">نام و نام خانوادگی:</label>
                  <input id="exp-name" required type="text" maxLength={150} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مریم کریمی" />
                </div>
                <div className="form-group">
                  <label htmlFor="exp-national-code">کد ملی (۱۰ رقم):</label>
                  <input id="exp-national-code" required type="text" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="off" value={nationalCode} onChange={(e) => setNationalCode(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 10))} placeholder="۱۰ رقم" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="exp-personnel-code">کد پرسنلی (۸ رقم):</label>
                  <input id="exp-personnel-code" required type="text" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="off" value={personnelCode} onChange={(e) => setPersonnelCode(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 8))} placeholder="۸ رقم" />
                </div>
                <div className="form-group">
                  <label htmlFor="exp-years">سابقه خدمت (سال):</label>
                  <input id="exp-years" required type="text" inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} value={serviceYears} onChange={(e) => setServiceYears(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2))} placeholder="مثلاً ۱۲" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="exp-prov">استان / واحد محل خدمت:</label>
                  <select id="exp-prov" required value={province} onChange={(e) => setProvince(e.target.value)}>
                    <option value="" disabled>انتخاب استان یا واحد</option>
                    {PROVINCE_UNITS.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="exp-district">منطقه / ناحیه:</label>
                  <input id="exp-district" required type="text" maxLength={150} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="نام منطقه یا ناحیه" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="exp-phone">شماره همراه:</label>
                  <input id="exp-phone" required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="09[0-9]{9}" maxLength={11} value={phone} onChange={(e) => setPhone(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 11))} />
                </div>
                <div className="form-group">
                  <label htmlFor="exp-email">پست الکترونیک:</label>
                  <input id="exp-email" required type="email" maxLength={150} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@example.com" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="exp-school">مدرسه:</label>
                <input id="exp-school" required type="text" maxLength={200} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="نام مدرسه" />
              </div>

              <div className="form-group">
                <label htmlFor="exp-title">عنوان روایت یا تجربه آموزشی:</label>
                <input id="exp-title" required type="text" maxLength={255} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان تجربه آموزشی" />
              </div>

              <div className="form-group">
                <label htmlFor="exp-summary">خلاصه کوتاه رخداد یادگیری و دستاورد آن (حداقل دو بند):</label>
                <textarea id="exp-summary" required rows={6} maxLength={6000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="بند اول: رخداد یادگیری، شواهد و مسئله مشاهده‌شده. سپس یک خط خالی بگذارید و بند دوم: اقدام انجام‌شده و دستاورد یادگیری را بنویسید." />
                <small className="text-xs text-slate-400">برای جداسازی بندها یک خط خالی بگذارید.</small>
              </div>

              <div className="form-group">
                <label htmlFor="exp-file">بارگذاری فایل مستند (PDF یا DOCX، حداکثر ۳ مگابایت):</label>
                <input id="exp-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileChange} />
                {file && <p className="form-file-info">فایل انتخاب‌شده: {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} مگابایت)</p>}
              </div>

              <div className="form-group">
                <label htmlFor="exp-file-link">پیوند فایل (برای فایل‌های بزرگ‌تر از ۳ مگابایت):</label>
                <p className="text-xs text-amber-200">دسترسی پیوند خارجی به تنظیمات سرویس میزبان آن بستگی دارد و سایت نمی‌تواند خصوصی‌بودن آن را تضمین کند.</p>
                <input id="exp-file-link" type="url" maxLength={2048} value={fileLink} onChange={(e) => { setFileLink(e.target.value); if (e.target.value) setFile(null) }} placeholder="https://…" />
                <small className="text-xs text-slate-400">لینک باید مستقیم و قابل دسترسی برای دبیرخانه باشد.</small>
              </div>

              {fileError && <p role="alert" className="form-error">{fileError}</p>}
              <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs leading-6 text-slate-300">
                حریم خصوصی: اطلاعات هویتی و تماس برای عموم نمایش داده نمی‌شود و فقط برای بررسی مدیران مجاز است. فایل تجربه پس از بررسی و با رعایت رضایت شما و حریم خصوصی دانش‌آموزان قابل انتشار خواهد بود.
              </p>

              <div className="form-checkbox">
                <input id="exp-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <label htmlFor="exp-consent">با بررسی تجربه و رعایت ضوابط حریم خصوصی دانش‌آموزان موافقت دارم.</label>
              </div>

              <div className="form-actions">
                <button type="submit" className="dusk-submit-btn font-titr" disabled={isSubmitting}>
                  {isSubmitting ? 'در حال ذخیره امن فایل و اطلاعات…' : 'ارسال نهایی برای داوری دبیرخانه'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Narrative samples */}
        <div className="campaign-section-title">
          <BookOpenCheck size={22} className="text-pink-400" />
          <h2 className="font-titr">فایل ورد و پی دی اف آثار منتخب استان</h2>
        </div>

        {sourceNarratives.length === 0 ? (
          <div className="dusk-card p-12 text-center my-8">
            <BookOpenCheck size={42} className="mx-auto mb-3 text-slate-500 opacity-60" />
            <h3 className="font-titr text-lg text-white mb-2">هنوز اثر برگزیده‌ای در این درگاه ثبت نشده است</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              آثار منتخب و تاییدشده استانی پس از بررسی در شورای علمی دبیرخانه همراه با فایل‌های ورد و پی‌دی‌اف در این بخش منتشر خواهند شد.
            </p>
          </div>
        ) : (
          <div className="dusk-cards-grid">
            {sourceNarratives.map((nar: NarrativeSample) => (
              <div key={nar.id} className="dusk-card narrative-card">
                <div className="dusk-card-top">
                  <span className="status-pill pink">{nar.subject}</span>
                  <span className="meta-badge">{nar.grade}</span>
                  <span className="meta-badge">{nar.province}</span>
                </div>

                <h3 className="dusk-card-title font-titr">{nar.title}</h3>
                <p className="dusk-card-desc">{nar.summary}</p>

                <div className="narrative-author-bar">
                  <span><strong>نویسنده:</strong> {nar.author} ({nar.school})</span>
                  <span>{nar.date}</span>
                </div>

                {/* Dual Downloads: Word and PDF */}
                <div className="narrative-docs-actions mt-4 pt-3 border-t border-slate-700/50 flex flex-wrap gap-2">
                  <a
                    href={nar.docxUrl}
                    download
                    className="doc-mini-btn btn-word flex-1 text-center justify-center"
                    onClick={() => notify(`دانلود فایل ورد اثر برگزیده استان ${nar.province} آغاز شد.`)}
                  >
                    <FileCode size={15} />
                    <span>فایل ورد (DOCX)</span>
                  </a>
                  <a
                    href={nar.pdfUrl}
                    download
                    className="doc-mini-btn btn-content flex-1 text-center justify-center"
                    onClick={() => notify(`دانلود فایل پی‌دی‌اف اثر برگزیده استان ${nar.province} آغاز شد.`)}
                  >
                    <FileText size={15} />
                    <span>فایل پی دی اف (PDF)</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {duplicateNotice && (
        <MiniNoticeDialog
          title="ثبت تجربه تکراری"
          message={duplicateNotice}
          onClose={() => setDuplicateNotice('')}
        />
      )}
    </div>
  )
}
