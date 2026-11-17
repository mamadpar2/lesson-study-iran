import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Video,
  Calendar,
  Clock,
  User,
  Download,
  CheckCircle,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  PlayCircle,
  ExternalLink,
  X,
  Award,
  FileStack,
  Eye,
  Loader2,
  IdCard,
  MapPin,
  Building2,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react'
import { PageHeader } from './page-header'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'
import { MiniNoticeDialog } from '@/components/ui/mini-notice-dialog'
import {
  webinarsData,
  type WebinarItem,
  type WebinarContentFile,
} from '@/src/data'
import { PROVINCE_UNITS } from '@/src/provinces'
import { formatTehranDateTime, getRegistrationWindowPhase, getWebinarRegistrationWindow } from '@/lib/webinar-registration-time'
import { sortByJalaliDateNewestFirst, toPersianDigits } from '@/lib/jalali-date'

interface WebinarsPageProps {
  onBack: () => void
  notify: (msg: string) => void
  items?: WebinarItem[]
  registrationWebinarId?: string | null
  registrationLoading?: boolean
  onOpenRegistration?: (webinar: WebinarItem) => void
}

/** Render modal overlays at document level so transformed page wrappers cannot offset them. */
const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(children, document.body)

/**
 * Helper to determine embed URL for video links (Aparat, YouTube, Direct video, etc.)
 */
function getEmbedVideoInfo(url: string): {
  type: 'aparat' | 'youtube' | 'direct' | 'other'
  embedUrl?: string
  rawUrl: string
} {
  if (!url) return { type: 'other', rawUrl: '' }
  const cleanUrl = url.trim()

  // Aparat URL patterns: aparat.com/v/XXXXX
  const aparatMatch = cleanUrl.match(/aparat\.com\/v\/([a-zA-Z0-9_-]+)/i)
  if (aparatMatch && aparatMatch[1]) {
    return {
      type: 'aparat',
      embedUrl: `https://www.aparat.com/video/video/embed/videohash/${aparatMatch[1]}/vt/frame`,
      rawUrl: cleanUrl,
    }
  }

  // YouTube URL patterns
  const ytMatch = cleanUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/i
  )
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
      rawUrl: cleanUrl,
    }
  }

  // Direct video file (.mp4, .webm, data URL, blob URL)
  if (
    /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(cleanUrl) ||
    cleanUrl.startsWith('data:video/')
  ) {
    return {
      type: 'direct',
      rawUrl: cleanUrl,
    }
  }

  return {
    type: 'other',
    rawUrl: cleanUrl,
  }
}


function safeHttpUrl(value?: string): string {
  try {
    const url = new URL(String(value || ''))
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  } catch {
    return ''
  }
}

/**
 * Certificate Modal Dialog with JPG download only
 */
interface CertificateModalDialogProps {
  personnelCode: string
  province: string
  webinarId: string
  onClose: () => void
}

const CertificateModalDialog: React.FC<CertificateModalDialogProps> = ({ personnelCode, province, webinarId, onClose }) => {
  const [certJpgUrl, setCertJpgUrl] = useState<string>('')
  const [certificateError, setCertificateError] = useState('')
  const [isGenerating, setIsGenerating] = useState(true)

  useEffect(() => {
    let active = true
    setIsGenerating(true)
    setCertJpgUrl('')
    setCertificateError('')

    const render = async () => {
      const { renderFixedCertificateImage } = await import('@/lib/fixed-certificate-renderer')
      return renderFixedCertificateImage({
        webinarId,
        personnelCode,
        province,
      })
    }

    render()
      .then((url) => {
        if (active) {
          setCertJpgUrl(url)
          setIsGenerating(false)
        }
      })
      .catch((err) => {
        console.error('Certificate generation error:', err)
        if (active) {
          setCertificateError(
            err instanceof Error && err.message
              ? err.message
              : 'بارگذاری یا تولید تصویر گواهی ناموفق بود.'
          )
          setIsGenerating(false)
        }
      })

    return () => {
      active = false
    }
  }, [personnelCode, province, webinarId])

  const jpgFileName = 'گواهی-حضور.jpg'


  return (
    <ModalPortal>
      <div
        className="certificate-modal-overlay fixed inset-0 z-[90] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
    >
      <div
        className="bg-[#0b1222] rounded-2xl border border-amber-500/40 shadow-2xl p-4 sm:p-5 flex flex-col max-h-[86dvh] min-h-0 max-w-3xl w-full relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <Award size={20} className="text-amber-400" />
            <h3 className="font-titr text-base sm:text-lg leading-relaxed text-white break-words">
              گواهی حضور رسمی
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-auto text-center p-2 flex items-center justify-center bg-slate-950 rounded-xl my-3 min-h-0">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3 text-slate-400 text-xs py-10">
              <Loader2 className="animate-spin text-amber-400" size={32} />
              <span>در حال تولید و صدور تصویر گواهی رسمی...</span>
            </div>
          ) : certJpgUrl ? (
            <img
              src={certJpgUrl}
              alt="گواهی حضور"
              className="max-h-[44vh] max-w-full object-contain rounded-lg border border-amber-500/20 shadow-2xl"
            />
          ) : (
            <span className="max-w-full break-words text-xs leading-6 text-red-300">
              {certificateError || 'خطا در بارگذاری تصویر گواهی'}
            </span>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">


          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {certJpgUrl && (
                <a
                  href={certJpgUrl}
                  download={jpgFileName}
                  className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg transition cursor-pointer"
                >
                  <Download size={15} />
                  <span>دانلود JPG</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

function WebinarRegistrationSuccessDialog({ fullName, webinarTitle, onClose }: { fullName: string; webinarTitle: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="registration-success-message" dir="rtl" className="relative w-full max-w-lg rounded-2xl border border-emerald-400/35 bg-slate-900 px-6 pb-7 pt-14 text-center shadow-2xl">
          <button type="button" autoFocus aria-label="بستن پیام موفقیت" onClick={onClose} className="absolute left-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800"><X size={20} /></button>
          <p id="registration-success-message" className="font-titr break-words text-xl leading-[2] text-emerald-100 sm:text-2xl">همکار گرامی {fullName}، حضور شما در وبینار «{webinarTitle}» با موفقیت ثبت شد.</p>
        </section>
      </div>
    </ModalPortal>
  )
}

function RegistrationCountdown({ milliseconds, label }: { milliseconds: number; label: string }) {
  const total = Math.max(0, Math.floor(milliseconds / 1000))
  const units = [
    { value: toPersianDigits(String(Math.floor(total / 86_400))), label: 'روز' },
    { value: toPersianDigits(String(Math.floor(total / 3_600) % 24).padStart(2, '0')), label: 'ساعت' },
    { value: toPersianDigits(String(Math.floor(total / 60) % 60).padStart(2, '0')), label: 'دقیقه' },
    { value: toPersianDigits(String(total % 60).padStart(2, '0')), label: 'ثانیه' },
  ]

  return (
    <div className="relative mx-auto w-full max-w-[440px] overflow-hidden rounded-2xl border border-amber-100/15 bg-gradient-to-b from-slate-800/90 via-slate-900/95 to-slate-950/95 p-1 shadow-[0_16px_40px_rgba(2,6,23,0.5),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-md" role="timer" aria-live="off" aria-label={label}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/55 to-transparent" />
      <span aria-hidden="true" className="pointer-events-none absolute -top-14 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-amber-300/10 blur-2xl" />
      <div className="relative grid grid-cols-4" dir="rtl">
        {units.map((unit, index) => (
          <div key={unit.label} className={`min-w-0 px-1 py-3 text-center sm:py-3.5 ${index ? 'border-r border-amber-100/10' : ''}`}>
            <b className="block text-[clamp(1.35rem,5vw,2.3rem)] font-semibold leading-none tracking-tight text-amber-100 [font-variant-numeric:tabular-nums] [text-shadow:0_0_16px_rgba(251,191,36,0.18)]">{unit.value}</b>
            <span className="mt-2 block text-[10px] font-medium tracking-wide text-slate-400 sm:text-[11px]">{unit.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const WebinarRegistrationPage: React.FC<{
  item: WebinarItem
  notify: (message: string) => void
}> = ({ item, notify }) => {
  const [now, setNow] = useState(() => Date.now())
  const [fullName, setFullName] = useState('')
  const [personnelCode, setPersonnelCode] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const phase = getRegistrationWindowPhase(item, now)
  const scheduleWindow = getWebinarRegistrationWindow(item)
  const timerLabel = phase === 'before' ? 'تا آغاز ثبت حضور' : 'تا پایان ثبت حضور'

  const submitAttendance = async (event: React.FormEvent) => {
    event.preventDefault()
    if (phase !== 'open' || isSubmitting || registrationComplete) return
    setIsSubmitting(true)
    setFormError('')
    if (!fullName.trim() || !personnelCode.trim() || !province.trim() || !district.trim()) {
      setFormError('برای ثبت حضور، لطفاً همه کادرهای فرم را تکمیل کنید.')
      setIsSubmitting(false)
      return
    }
    try {
      const response = await fetch('/api/registrations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'webinar-attendance',
          eventId: item.id,
          fullName: fullName.trim(),
          personnelCode: personnelCode.trim(),
          province,
          district: district.trim(),
        }),
      })
      const result = await response.json().catch(() => null)
      const legacyDuplicateMessages = new Set([
        'این مشخصات قبلاً برای همین رویداد ثبت شده است.',
        'این کد پرسنلی قبلاً برای همین وبینار ثبت شده است.',
        'این کد پرسنلی قبلاً ثبت شده است.',
      ])
      if (response.status === 409 && (result?.code === 'DUPLICATE_REGISTRATION' || legacyDuplicateMessages.has(result?.error))) {
        setShowDuplicateDialog(true)
        return
      }
      if (!response.ok || result?.status !== 'saved') throw new Error(result?.error || 'ثبت اطلاعات ناموفق بود؛ دوباره تلاش کنید.')
      setRegistrationComplete(true)
      setShowSuccessDialog(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ثبت اطلاعات ناموفق بود.'
      setFormError(message)
      notify(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="dusk-page-wrapper registration-page" aria-label={`فرم ثبت حضور در وبینار ${item.title}`} dir="rtl">
      <div className="registration-shell">
        <header className="registration-brandbar">
          <div className="registration-brand">
            <span className="registration-brand-mark"><img src="/images/secretariat-symbol.png" alt="" /></span>
            <span className="registration-brand-text">دبیرخانه کشوری درس‌پژوهی و درس‌کاوی</span>
          </div>
          <span className="registration-brand-tag"><Video size={15} aria-hidden="true" /> وبینارهای آموزشی</span>
        </header>

        <section className="registration-intro" aria-labelledby="registration-title">
          <div className="registration-intro-copy">
            <h1 id="registration-title" className="font-titr text-xl sm:text-2xl text-white leading-relaxed">فرم ثبت حضور در وبینار {item.title}</h1>
          </div>
        </section>

        <div className="registration-layout">
          <section className="registration-main" aria-labelledby="registration-form-heading">
            <div className="registration-card-heading">
              <div className="registration-heading-icon"><FileText size={21} aria-hidden="true" /></div>
              <div><h2 id="registration-form-heading">اطلاعات شرکت‌کننده</h2><p>لطفاً اطلاعات را مطابق مشخصات خود وارد کنید.</p></div>
            </div>

            {phase === 'unscheduled' && (
              <div className="registration-state registration-state--amber" role="status">
                <span className="registration-state-icon"><Clock size={23} /></span>
                <p className="font-bold text-amber-100">زمان شروع و پایان ثبت حضور هنوز اعلام نشده است.</p>
                <p>لطفاً بعداً دوباره به این صفحه مراجعه کنید.</p>
              </div>
            )}

            {phase === 'before' && scheduleWindow.start && (
              <div className="registration-state registration-state--blue" role="status" aria-live="polite">
                <span className="registration-state-icon"><Clock size={23} /></span>
                <p className="font-bold text-sky-100">ثبت حضور هنوز آغاز نشده است.</p>
                <p>شروع: {formatTehranDateTime(scheduleWindow.start)}</p>
                <p className="registration-timer-caption">{timerLabel}</p>
                <RegistrationCountdown milliseconds={scheduleWindow.start.getTime() - now} label={timerLabel} />
              </div>
            )}

            {phase === 'open' && scheduleWindow.end && !registrationComplete && (
              <>
                <div className="registration-active" role="status" aria-live="polite">
                  <div className="registration-active-top"><span className="registration-live"><i />ثبت حضور فعال است</span><span>پایان مهلت: {formatTehranDateTime(scheduleWindow.end)}</span></div>
                  <div className="registration-timer-row"><span className="registration-timer-label"><Clock size={16} />{timerLabel}</span><RegistrationCountdown milliseconds={scheduleWindow.end.getTime() - now} label={timerLabel} /></div>
                </div>

                <form onSubmit={submitAttendance} className="registration-form">
                  <div className="registration-fields">
                    <label className="registration-field form-group block">
                      <span>نام و نام خانوادگی <b aria-hidden="true">*</b></span>
                      <div className="registration-input-wrap"><User size={19} aria-hidden="true" /><input value={fullName} onChange={event => setFullName(event.target.value)} required maxLength={150} autoComplete="name" className="dusk-input" placeholder="نام و نام خانوادگی کامل" /></div>
                    </label>
                    <label className="registration-field form-group block">
                      <span>کد پرسنلی <b aria-hidden="true">*</b></span>
                      <div className="registration-input-wrap"><IdCard size={19} aria-hidden="true" /><input value={personnelCode} onChange={event => setPersonnelCode(event.target.value)} required maxLength={12} inputMode="numeric" autoComplete="off" className="dusk-input" placeholder="کد پرسنلی" /></div>
                    </label>
                    <label className="registration-field form-group block">
                      <span>استان محل خدمت <b aria-hidden="true">*</b></span>
                      <div className="registration-input-wrap registration-select-wrap"><MapPin size={19} aria-hidden="true" /><select value={province} onChange={event => setProvince(event.target.value)} required className="dusk-input">
                        <option value="">انتخاب استان</option>
                        {PROVINCE_UNITS.map(unit => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                      </select></div>
                    </label>
                    <label className="registration-field form-group block">
                      <span>ناحیه محل خدمت <b aria-hidden="true">*</b></span>
                      <div className="registration-input-wrap"><Building2 size={19} aria-hidden="true" /><input value={district} onChange={event => setDistrict(event.target.value)} required maxLength={150} autoComplete="off" className="dusk-input" placeholder="نام ناحیه یا شهرستان" /></div>
                    </label>
                  </div>
                  <p className="registration-required"><span aria-hidden="true">*</span> تمام کادرهای ستاره‌دار برای ثبت حضور الزامی هستند.</p>
                  {formError && <p className="registration-error" role="alert">{formError}</p>}
                  <button
                    type="submit"
                    disabled={isSubmitting || phase !== 'open'}
                    aria-busy={isSubmitting}
                    className="registration-submit group relative flex min-h-[58px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-white/25 bg-gradient-to-l from-sky-400 via-cyan-300 to-teal-300 px-5 text-sm font-black text-slate-950 shadow-[0_8px_24px_rgba(34,211,238,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(34,211,238,0.32)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={19} />}
                    <span>{isSubmitting ? 'در حال ثبت اطلاعات…' : 'ثبت حضور در وبینار'}</span>
                    {!isSubmitting && <ArrowLeft size={18} className="registration-submit-arrow" aria-hidden="true" />}
                  </button>
                  <p className="registration-safe"><ShieldCheck size={16} aria-hidden="true" /> اطلاعات واردشده برای ثبت حضور استفاده می‌شود.</p>
                </form>
              </>
            )}

            {registrationComplete && (
              <div className="registration-state registration-state--success" role="status">
                <span className="registration-state-icon"><CheckCircle size={28} /></span>
                <p className="font-bold text-emerald-100">ثبت حضور شما با موفقیت انجام شد.</p>
                {phase === 'open' && <button type="button" className="mt-3 rounded-lg border border-emerald-300/40 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-900/50" onClick={() => { setRegistrationComplete(false); setFormError('') }}>بازگشت به فرم ثبت حضور</button>}
              </div>
            )}
            {phase === 'closed' && !registrationComplete && (
              <div className="registration-state registration-state--closed" role="status">
                <span className="registration-state-icon"><Clock size={23} /></span>
                <p className="font-bold text-rose-100">مهلت ثبت حضور در این وبینار پایان یافته است.</p>
              </div>
            )}
          </section>

          <aside className="registration-aside" aria-label="جزئیات وبینار">
            <div className="registration-aside-top"><span>جزئیات رویداد</span><Video size={17} aria-hidden="true" /></div>
            {item.posterUrl && <div className="registration-poster"><img src={item.posterUrl} alt={`پوستر ${item.title}`} /></div>}
            <div className="registration-event-info">
              <div className="registration-event-kicker"><span /> وبینار آموزشی</div>
              <h2>{item.title}</h2>
              {item.description && <p className="registration-event-description">{item.description}</p>}
              <div className="registration-event-details">
                {item.speaker && <div><span className="registration-detail-icon"><User size={17} /></span><span><small>مدرس / سخنران</small><strong>{item.speaker}</strong></span></div>}
                {item.date && <div><span className="registration-detail-icon"><Calendar size={17} /></span><span><small>تاریخ برگزاری</small><strong>{item.date}</strong></span></div>}
                {item.time && <div><span className="registration-detail-icon"><Clock size={17} /></span><span><small>ساعت برگزاری</small><strong>{item.time}</strong></span></div>}
                {item.platform && <div><span className="registration-detail-icon"><Video size={17} /></span><span><small>بستر برگزاری</small><strong>{item.platform}</strong></span></div>}
              </div>
            </div>
            <div className="registration-aside-footer"><span className="registration-aside-sparkle">✳</span><span>خانه‌ای برای رشد حرفه‌ای معلمان</span></div>
          </aside>
        </div>
      </div>
      {showDuplicateDialog && (
        <MiniNoticeDialog
          title="ثبت‌نام تکراری"
          message="این کد پرسنلی قبلاً ثبت‌نام کرده است."
          onClose={() => setShowDuplicateDialog(false)}
        />
      )}
      {showSuccessDialog && (
        <WebinarRegistrationSuccessDialog fullName={fullName.trim()} webinarTitle={item.title} onClose={() => setShowSuccessDialog(false)} />
      )}
    </div>
  )
}

export const WebinarsPage: React.FC<WebinarsPageProps> = ({ onBack, notify, items, registrationWebinarId, registrationLoading, onOpenRegistration }) => {
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'recorded'>('all')
  const [registrationWebinar, setRegistrationWebinar] = useState<WebinarItem | null>(null)

  // Modal 1: Poster Preview
  const [selectedPoster, setSelectedPoster] = useState<{
    title: string
    url: string
    fileName?: string
  } | null>(null)

  // Modal 2: Recorded Video Preview
  const [selectedVideo, setSelectedVideo] = useState<{
    title: string
    url: string
  } | null>(null)

  // Modal 3: Presentation Files Preview (Single or Multiple)
  const [selectedPresentation, setSelectedPresentation] = useState<{
    webinarTitle: string
    files: WebinarContentFile[]
  } | null>(null)
  const [activePresentationIdx, setActivePresentationIdx] = useState<number>(0)
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<{ title: string; url: string; fileName?: string; downloadUrl?: string } | null>(null)

  // Certificate lookup: the personnel code is sent in the request body, never in a URL.
  const [selectedAttendance, setSelectedAttendance] = useState<{ webinarId: string; webinarTitle: string } | null>(null)
  const [certificateCode, setCertificateCode] = useState('')
  const [certificateProvince, setCertificateProvince] = useState('')
  const [selectedCertificate, setSelectedCertificate] = useState<{ personnelCode: string; province: string; webinarId: string } | null>(null)

  const hasOpenOverlay = Boolean(
    selectedPoster || selectedVideo || selectedPresentation || selectedAttendance || selectedCertificate || selectedPreviewFile
  )

  useEffect(() => {
    if (!hasOpenOverlay) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [hasOpenOverlay])

  const sourceData = items !== undefined ? items : webinarsData
  const sortedSourceData = sortByJalaliDateNewestFirst(sourceData)
  const filtered = sortedSourceData.filter((item: WebinarItem) => {
    if (filter === 'all') return true
    return item.status === filter
  })

  const handleRegister = (webinar: WebinarItem) => {
    if (onOpenRegistration) onOpenRegistration(webinar)
    else setRegistrationWebinar(webinar)
  }

  // Open Presentation Modal
  const handleOpenPresentation = (item: WebinarItem) => {
    let files: WebinarContentFile[] = []
    if (item.contentFiles && item.contentFiles.length > 0) {
      files = item.contentFiles
    } else if (item.contentUrl) {
      const ext = item.contentFileName?.split('.').pop()?.toLowerCase() || 'pdf'
      files = [
        {
          id: 'file-1',
          title: item.contentFileName || 'فایل ارائه و اسلایدهای وبینار',
          url: item.contentUrl,
          fileName: item.contentFileName || 'presentation.pdf',
          fileType: ext === 'pptx' || ext === 'ppt' ? 'pptx' : 'pdf',
        },
      ]
    }

    if (files.length === 0) {
      notify('هنوز فایل ارائه‌ای برای این وبینار بارگذاری نشده است.')
      return
    }

    setSelectedPresentation({
      webinarTitle: item.title,
      files,
    })
    setActivePresentationIdx(0)
  }

  const handleOpenAttendance = (item: WebinarItem) => {
    setCertificateCode('')
    setCertificateProvince('')
    setSelectedAttendance({ webinarId: item.id, webinarTitle: item.title })
  }

  const directRegistrationWebinar = registrationWebinarId
    ? sourceData.find(webinar => webinar.id === registrationWebinarId) || null
    : null

  if (registrationWebinarId && !directRegistrationWebinar) {
    return (
      <div className="dusk-page-wrapper min-h-screen flex items-center justify-center">
        <div className="dusk-card max-w-lg p-8 text-center" role="status">
          {registrationLoading ? <Loader2 size={28} className="mx-auto mb-3 animate-spin text-sky-300" /> : <X size={28} className="mx-auto mb-3 text-rose-300" />}
          <p className="text-sm text-slate-200">{registrationLoading ? 'در حال دریافت اطلاعات وبینار…' : 'پیوند ثبت حضور معتبر نیست یا وبینار پیدا نشد.'}</p>
        </div>
      </div>
    )
  }

  const openedRegistrationWebinar = directRegistrationWebinar || registrationWebinar
  if (openedRegistrationWebinar) {
    return <WebinarRegistrationPage item={openedRegistrationWebinar} notify={notify} />
  }

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="webinars"
        title="وبینارهای آموزشی دبیرخانه"
        subtitle="وبینارهای پیش‌رو با پوستر و پیوند ورود به نشست؛ وبینارهای برگزارشده با فایل‌های ارائه، لینک ضبط و گواهی حضور"
        badge="برخط و تعاملی"
        accentColor="#38b3f9"
        onBack={onBack}
      />

      <div className="container dusk-page-content">
        <div className="dusk-filter-tabs">
          <button
            className={`dusk-tab-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            همه وبینارها ({sourceData.length})
          </button>
          <button
            className={`dusk-tab-btn ${filter === 'upcoming' ? 'active' : ''}`}
            onClick={() => setFilter('upcoming')}
          >
            رویدادهای پیش‌رو
          </button>
          <button
            className={`dusk-tab-btn ${filter === 'recorded' ? 'active' : ''}`}
            onClick={() => setFilter('recorded')}
          >
            آرشیو ضبط‌شده
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="dusk-card p-12 text-center my-8">
            <Video size={42} className="mx-auto mb-3 text-slate-500 opacity-60" />
            <h3 className="font-titr text-lg text-white mb-2">هنوز وبیناری در این درگاه ثبت نشده است</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              وبینارهای پیش‌رو با پوستر و پیوند ورود به نشست، و پس از برگزاری با فایل‌های ارائه، ضبط و اطلاعات گواهی در این درگاه قرار می‌گیرند.
            </p>
          </div>
        ) : (
          <div className="dusk-cards-grid">
            {filtered.map((item) => {
              const isUpcoming = item.status === 'upcoming'
              const meetingUrl = safeHttpUrl(item.meetingUrl)
              const presentationFilesCount =
                item.contentFiles?.length || (item.contentUrl ? 1 : 0)

              return (
                <div key={item.id} className="dusk-card webinar-card group">
                  {/* Poster Art Showcase Banner at Top of Webinar Card */}
                  {item.posterUrl && (
                    <div
                      className="webinar-poster-banner cursor-pointer group-hover:opacity-95 transition relative overflow-hidden"
                      onClick={() =>
                        setSelectedPoster({
                          title: item.title,
                          url: item.posterUrl,
                          fileName: item.posterFileName,
                        })
                      }
                      title="مشاهده پوستر با کیفیت اصلی"
                    >
                      <img
                        src={item.posterUrl}
                        alt={`پوستر ${item.title}`}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#080d1a] via-black/10 to-transparent" />
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className={`status-pill ${item.status}`}>
                          {isUpcoming ? 'در پیش‌رو' : 'برگزار شده / آرشیو'}
                        </span>
                      </div>
                      <div className="absolute top-2.5 left-2.5">
                        <span className="platform-tag text-[11px] bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full text-slate-200 border border-white/10">
                          {item.platform}
                        </span>
                      </div>
                      <div className="absolute bottom-2 left-2.5">
                        <span className="text-[10px] bg-sky-500/90 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow backdrop-blur-sm">
                          <Eye size={11} />
                          پوستر وبینار
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dark Frosted Glass Inner Container for High Readability */}
                  <div className="webinar-card-inner">
                    {!item.posterUrl && (
                      <div className="dusk-card-top mb-3">
                        <span className={`status-pill ${item.status}`}>
                          {isUpcoming ? 'در پیش‌رو' : 'برگزار شده / آرشیو'}
                        </span>
                        <span className="platform-tag">{item.platform}</span>
                      </div>
                    )}

                    <h3 className="dusk-card-title font-titr text-lg mb-2 text-white">
                      {item.title}
                    </h3>
                    <p className="dusk-card-desc text-slate-300 text-xs mb-4 line-clamp-3">
                      {item.description}
                    </p>

                    <div className="webinar-meta-grid mb-4">
                      <div className="meta-item">
                        <User size={15} className="text-sky-400 shrink-0" />
                        <span>
                          <strong>مدرس:</strong> {item.speaker} ({item.role})
                        </span>
                      </div>
                      <div className="meta-item">
                        <Calendar size={15} className="text-sky-400 shrink-0" />
                        <span>
                          <strong>زمان:</strong> {item.date}
                        </span>
                      </div>
                      <div className="meta-item">
                        <Clock size={15} className="text-sky-400 shrink-0" />
                        <span>{item.time}</span>
                      </div>
                    </div>

                    {/* 4 Designated Document Deliverables */}
                    <div className="webinar-docs-panel mt-auto">
                      <div className="panel-label font-titr text-xs text-sky-400 mb-2">
                        {isUpcoming ? 'پوستر و لینک ورود به وبینار:' : 'مستندات و فایل‌های وبینار:'}
                      </div>
                      <div className="docs-action-grid">
                        {/* 1. پوستر (مینی پنجره نمایش پوستر) */}
                        {item.posterUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPoster({
                                title: item.title,
                                url: item.posterUrl,
                                fileName: item.posterFileName,
                              })
                            }
                            className="doc-mini-btn btn-poster cursor-pointer"
                            title="مشاهده پوستر با کیفیت اصلی در مینی پنجره"
                          >
                            <ImageIcon size={14} />
                            <span>پوستر</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="doc-mini-btn btn-disabled"
                            title="پوستر هنوز بارگذاری نشده است"
                          >
                            <ImageIcon size={14} />
                            <span>پوستر</span>
                          </button>
                        )}

                        {isUpcoming ? (
                          meetingUrl ? (
                            <a
                              href={meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="doc-mini-btn btn-meeting"
                              title="ورود به نشست در پیوند ثبت‌شده"
                            >
                              <ExternalLink size={14} />
                              <span>لینک برگزاری نشست</span>
                            </a>
                          ) : (
                            <button type="button" disabled className="doc-mini-btn btn-disabled" title="پیوند برگزاری هنوز ثبت نشده است">
                              <ExternalLink size={14} />
                              <span>لینک برگزاری نشست</span>
                            </button>
                          )
                        ) : (
                          <>
                        {/* 2. فایل ارائه (تک یا چند فایلی) */}
                        {presentationFilesCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPresentation(item)}
                            className="doc-mini-btn btn-content cursor-pointer"
                            title="مشاهده و دانلود فایل‌های ارائه وبینار"
                          >
                            {presentationFilesCount > 1 ? (
                              <FileStack size={14} />
                            ) : (
                              <FileText size={14} />
                            )}
                            <span>
                              {presentationFilesCount > 1
                                ? `ارائه (${presentationFilesCount})`
                                : 'فایل ارائه'}
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="doc-mini-btn btn-disabled"
                            title="فایل ارائه هنوز بارگذاری نشده است"
                          >
                            <FileText size={14} />
                            <span>فایل ارائه</span>
                          </button>
                        )}

                        {/* 3. لینک ویدیوی ضبط‌شده (مینی پنجره پخش ویدیو) */}
                        {item.recordedVideoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedVideo({
                                title: item.title,
                                url: item.recordedVideoUrl,
                              })
                            }
                            className="doc-mini-btn btn-video cursor-pointer"
                            title="پخش ویدیوی ضبط‌شده در مینی پنجره"
                          >
                            <PlayCircle size={14} />
                            <span>لینک ضبط‌شده</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="doc-mini-btn btn-disabled"
                            title="ویدیوی ضبط‌شده هنوز در دسترس نیست"
                          >
                            <PlayCircle size={14} />
                            <span>لینک ضبط‌شده</span>
                          </button>
                        )}

                        {/* 4. فهرست عمومی حاضران و گواهی‌های صادرشده */}
                        {!isUpcoming && (
                          <button
                            type="button"
                            onClick={() => handleOpenAttendance(item)}
                            className="doc-mini-btn btn-attendees cursor-pointer"
                            title="دریافت گواهی با کد پرسنلی"
                          >
                            <FileSpreadsheet size={14} />
                            <span>دریافت گواهی حضور</span>
                          </button>
                        )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="card-footer-action mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      {isUpcoming ? (
                        <button
                          type="button"
                          className="dusk-primary-btn text-xs py-2 px-4 w-full flex items-center justify-center gap-2"
                          onClick={() => handleRegister(item)}
                        >
                          <span>ثبت‌نام در وبینار</span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-400 flex items-center justify-between w-full">
                          <span>وضعیت: پایان یافته و آرشیو شده</span>
                          <span className="text-emerald-400 font-bold">گواهی و ضبط فعال</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL 1: POSTER MINI WINDOW (مینی پنجره پوستر)                */}
        {/* ============================================================== */}
        {selectedPoster && (
          <ModalPortal>
          <div
            className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedPoster(null)}
          >
            <div
              className="dusk-card max-w-2xl w-full p-5 max-h-[90vh] flex flex-col relative border border-sky-500/30 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ImageIcon size={18} className="text-sky-400" />
                  <h3 className="font-titr text-base text-white">
                    پوستر وبینار: {selectedPoster.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPoster(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto text-center p-2 flex items-center justify-center bg-slate-950/80 rounded-xl">
                <img
                  src={selectedPoster.url}
                  alt={`پوستر ${selectedPoster.title}`}
                  className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              </div>

              <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-end">
                <a
                  href={selectedPoster.url}
                  download={selectedPoster.fileName || 'webinar-poster.webp'}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-2 transition"
                >
                  <Download size={15} />
                  <span>دانلود پوستر با کیفیت اصلی</span>
                </a>
              </div>
            </div>
          </div>
          </ModalPortal>
        )}

        {/* ============================================================== */}
        {/* MODAL 2: VIDEO MINI PLAYER (مینی پنجره پخش ویدیو)              */}
        {/* ============================================================== */}
        {selectedVideo && (() => {
          const videoInfo = getEmbedVideoInfo(selectedVideo.url)

          return (
            <ModalPortal>
            <div
              className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setSelectedVideo(null)}
            >
              <div
                className="dusk-card max-w-3xl w-full p-5 max-h-[90vh] flex flex-col relative border border-amber-500/30 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <PlayCircle size={18} className="text-amber-400" />
                    <h3 className="font-titr text-base text-white">
                      ویدیوی ضبط‌شده: {selectedVideo.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden rounded-xl bg-black flex items-center justify-center min-h-[360px]">
                  {videoInfo.type === 'aparat' || videoInfo.type === 'youtube' ? (
                    <iframe
                      src={videoInfo.embedUrl}
                      title={selectedVideo.title}
                      className="w-full h-[400px] border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : videoInfo.type === 'direct' ? (
                    <video
                      controls
                      autoPlay
                      className="w-full max-h-[440px] rounded-lg"
                      src={videoInfo.rawUrl}
                    >
                      مرورگر شما از تگ ویدیو پشتیبانی نمی‌کند.
                    </video>
                  ) : (
                    <div className="text-center p-6 text-slate-300">
                      <p className="text-xs mb-3">
                        این ویدیو در بستر اسکای‌روم یا سرور اختصاصی میزبانی می‌شود.
                      </p>
                      <a
                        href={videoInfo.rawUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition"
                      >
                        <ExternalLink size={15} />
                        <span>بازکردن و پخش در برگه جدید</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    بستر پخش: {videoInfo.type === 'aparat' ? 'آپارات' : videoInfo.type === 'youtube' ? 'یوتیوب' : 'پخش مستقیم'}
                  </span>
                  <a
                    href={selectedVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 transition"
                  >
                    <ExternalLink size={14} />
                    <span>باز کردن پیوند خارجی</span>
                  </a>
                </div>
              </div>
            </div>
            </ModalPortal>
          )
        })()}

        {/* ============================================================== */}
        {/* MODAL 3: PRESENTATION FILES MINI WINDOW (مینی پنجره فایل ارائه) */}
        {/* ============================================================== */}
        {selectedPresentation && (() => {
          const currentFile = selectedPresentation.files[activePresentationIdx] || selectedPresentation.files[0]
          const isMultiple = selectedPresentation.files.length > 1

          return (
            <ModalPortal>
            <div
              className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setSelectedPresentation(null)}
            >
              <div
                className="dusk-card max-w-3xl w-full p-5 max-h-[90vh] flex flex-col relative border border-emerald-500/30 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-emerald-400" />
                    <h3 className="font-titr text-base text-white">
                      فایل‌های ارائه: {selectedPresentation.webinarTitle}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedPresentation(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* If multiple files, list tabs/buttons on top */}
                {isMultiple && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
                    <span className="text-[11px] text-slate-400 shrink-0 font-bold">
                      انتخاب فایل:
                    </span>
                    {selectedPresentation.files.map((file, idx) => (
                      <button
                        key={file.id || idx}
                        onClick={() => setActivePresentationIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                          activePresentationIdx === idx
                            ? 'bg-emerald-500 text-slate-950 shadow-md'
                            : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <FileText size={13} />
                        <span>{file.title || `فایل شماره ${idx + 1}`}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Active file display area */}
                <div className="flex-1 overflow-y-auto rounded-xl bg-slate-950/80 p-4 border border-slate-800 flex flex-col items-center justify-center text-center">
                  <FileText size={48} className="text-emerald-400 mb-3" />
                  <h4 className="font-titr text-base text-white mb-1">
                    {currentFile.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-5">
                    <span className="font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded uppercase">
                      {currentFile.fileType}
                    </span>
                    {currentFile.fileSize && <span>حجم: {currentFile.fileSize}</span>}
                  </div>

                  <div className="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewFile({
                        title: currentFile.title || currentFile.fileName || 'فایل ارائه',
                        url: currentFile.url,
                        fileName: currentFile.fileName || 'presentation.pdf',
                        downloadUrl: currentFile.downloadUrl,
                      })}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25"
                    >
                      <Eye size={16} />
                      <span>نمایش فایل در پنجره</span>
                    </button>
                    <a
                      href={currentFile.downloadUrl || currentFile.url}
                      download={currentFile.fileName || 'presentation.pdf'}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-xs font-bold text-slate-950 shadow-lg transition hover:from-emerald-400 hover:to-teal-400"
                    >
                      <Download size={16} />
                      <span>دانلود فایل ({currentFile.fileType.toUpperCase()})</span>
                    </a>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>نام فایل: {currentFile.fileName || 'ارائه.pdf'}</span>
                  <span>تعداد کل فایل‌های پیوست: {selectedPresentation.files.length}</span>
                </div>
              </div>
            </div>
            </ModalPortal>
          )
        })()}

        {selectedAttendance && (
          <ModalPortal>
            <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedAttendance(null)}>
              <div className="dusk-card max-w-md w-full p-5 border border-purple-500/30" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center gap-3 mb-4">
                  <h3 className="font-titr text-lg text-white">دریافت گواهی: {selectedAttendance.webinarTitle}</h3>
                  <button type="button" aria-label="بستن" onClick={() => setSelectedAttendance(null)}><X size={20} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); if (!certificateCode.trim() || !certificateProvince) return; setSelectedCertificate({ webinarId: selectedAttendance.webinarId, personnelCode: certificateCode.trim(), province: certificateProvince }) }} className="space-y-4">
                  <label htmlFor="certificate-province" className="block text-sm text-slate-200">استان یا واحد محل خدمت</label>
                  <select id="certificate-province" className="dusk-input" required value={certificateProvince} onChange={e => setCertificateProvince(e.target.value)}>
                    <option value="">انتخاب استان</option>
                    {PROVINCE_UNITS.map(unit => <option key={unit.id} value={unit.name}>{unit.name}</option>)}
                  </select>
                  <label htmlFor="certificate-personnel-code" className="block text-sm text-slate-200">کد پرسنلی</label>
                  <input id="certificate-personnel-code" className="dusk-input" dir="ltr" inputMode="numeric" autoComplete="off" maxLength={20} required value={certificateCode} onChange={e => setCertificateCode(e.target.value)} />
                  <button type="submit" className="dusk-submit-btn font-titr">بررسی و دریافت گواهی</button>
                </form>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* ============================================================== */}
        {/* MODAL 5: CERTIFICATE IMAGE VIEWER (نمایش و دانلود تصویر گواهی JPG) */}
        {/* ============================================================== */}
        {selectedCertificate && (
          <CertificateModalDialog
            personnelCode={selectedCertificate.personnelCode}
            province={selectedCertificate.province}
            webinarId={selectedCertificate.webinarId}
            onClose={() => setSelectedCertificate(null)}
          />
        )}

        {selectedPreviewFile && (
          <FilePreviewDialog
            title={selectedPreviewFile.title}
            url={selectedPreviewFile.url}
            fileName={selectedPreviewFile.fileName}
            downloadUrl={selectedPreviewFile.downloadUrl}
            onClose={() => setSelectedPreviewFile(null)}
          />
        )}

        <div className="dusk-info-box">
          <Sparkles size={24} className="text-cyan-400 flex-shrink-0" />
          <div>
            <h4 className="font-titr">نکات مهم برای شرکت در وبینارها:</h4>
            <ul>
              <li>برای تمامی وبینارهای آموزشی، گواهی حضور رسمی با تایید دبیرخانه کشوری صادر می‌گردد.</li>
              <li>فایل اکسل حاضران پس از پایان هر جلسه جهت بررسی صحت ساعات حضور در سامانه بارگذاری می‌شود.</li>
              <li>تالار مجازی ۱۰ دقیقه پیش از ساعت اعلام‌شده برای بررسی صدا و تصویر باز خواهد شد.</li>
              <li>پرسش و پاسخ تعاملی در انتهای هر جلسه به مدت ۲۰ دقیقه اختصاص دارد.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
