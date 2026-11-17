import React, { useEffect, useState } from 'react'
import {
  Sparkles,
  HeartHandshake,
  CheckCircle2,
  Award,
  Users,
  Send,
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  Eye,
  Image as ImageIcon,
  Film,
} from 'lucide-react'
import { PageHeader } from './page-header'
import { provinceTeamsList, type CampaignPublicFile, type ProvinceTeamsData } from '@/src/data'
import { PROVINCE_UNITS } from '@/src/provinces'
import { MiniNoticeDialog } from '@/components/ui/mini-notice-dialog'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'
import { campaignFileList, campaignFileTitle, campaignFileExtension } from '@/lib/campaign-files'

const toEnglishDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => {
  const code = digit.charCodeAt(0)
  return String.fromCharCode(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 + 48 : code - 0x0660 + 48)
})

interface CampaignPageProps {
  onBack: () => void
  notify: (msg: string) => void
  teams?: ProvinceTeamsData[]
  campaignPdf?: CampaignPublicFile
  campaignFiles?: CampaignPublicFile[]
}

export const CampaignPage: React.FC<CampaignPageProps> = ({ onBack, notify, teams, campaignPdf, campaignFiles }) => {
  const [selectedCampaignFile, setSelectedCampaignFile] = useState<CampaignPublicFile | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [name, setName] = useState('')
  const [personnelCode, setPersonnelCode] = useState('')
  const [province, setProvince] = useState('')
  const [grade, setGrade] = useState('')
  const [district, setDistrict] = useState('')
  const [phone, setPhone] = useState('')
  const [school, setSchool] = useState('')
  const [hasPledged, setHasPledged] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [duplicateNotice, setDuplicateNotice] = useState('')
  const [selectedProvIndex, setSelectedProvIndex] = useState(0)

  const sourceTeams = teams !== undefined ? teams : provinceTeamsList
  const pledgeText = 'من متعهد می‌شوم کلاسم را به فضایی برای گفت‌وگو، بازاندیشی و هم‌آموزی با همکارانم تبدیل کنم.'

  useEffect(() => {
    let active = true
    fetch('/api/pledges', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (active && Number.isFinite(Number(result?.count))) setTotalCount(Math.max(0, Number(result.count)))
      })
      .catch(() => { /* remain at zero until the shared count endpoint is available */ })
    return () => { active = false }
  }, [])

  const currentProvData = sourceTeams[selectedProvIndex] || sourceTeams[0]

  const handlePledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !personnelCode || !province || !grade || !district.trim() || !phone || !school.trim()) {
      notify('لطفاً همه فیلدهای الزامی عهدنامه را تکمیل فرمایید.')
      return
    }
    if (!/^(?:\d{8}|\d{10})$/.test(personnelCode)) {
      notify('کد پرسنلی باید ۸ رقم یا کد ملی باید ۱۰ رقم باشد.')
      return
    }
    if (!/^09\d{9}$/.test(phone)) {
      notify('شماره همراه باید ۱۱ رقم و با 09 آغاز شود.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/pledges', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name.trim(), personnelCode, province, grade,
          district: district.trim(), phone, school: school.trim(), pledgeText,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 409) {
        setDuplicateNotice(result?.error || 'این کد قبلاً برای عهدنامه هم‌آموزی ثبت‌نام کرده است.')
        return
      }
      if (!response.ok) {
        notify(result?.error || 'ثبت عهدنامه انجام نشد؛ لطفاً دوباره تلاش کنید.')
        return
      }
      setTotalCount((previous) => previous + 1)
      setHasPledged(true)
      notify('عهدنامه شما با موفقیت ثبت شد. سپاس از همراهی‌تان در پویش ملی.')
      setName('')
      setPersonnelCode('')
      setProvince('')
      setGrade('')
      setDistrict('')
      setPhone('')
      setSchool('')
    } catch {
      notify('ارتباط با پایگاه داده برقرار نشد؛ ثبت عهدنامه انجام نشده است.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const manifestoItems = [
    {
      num: '۱',
      title: 'درهای باز به روی هم‌قطاران',
      text: 'کلاس درس را فضایی امن برای ورود، همراهی و مشاهده مشفقانه همکاران می‌دانیم.',
    },
    {
      num: '۲',
      title: 'دیدنِ یادگیری، نه سنجش معلم',
      text: 'کانون توجه درس‌پژوهی، درک عمیق تفکر و استدلال دانش‌آموز است؛ نه داوری درباره معلم.',
    },
    {
      num: '۳',
      title: 'خطا، آغاز فهم است',
      text: 'اشتباهات کلاسی را گرانبهاترین فرصت برای بازطراحی روش‌ها و کشف ریشه‌های یادگیری می‌شماریم.',
    },
    {
      num: '۴',
      title: 'پایان تنهاییِ حرفه‌ای',
      text: 'معتقدیم بار سنگین چالش‌های کلاس نباید بر دوش یک معلم تنها باشد؛ با هم فکر می‌کنیم و با هم می‌آموزیم.',
    },
  ]

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="campaign"
        title="کمپین ما باهم می‌آموزیم"
        subtitle="پویش سراسری همبستگی و هم‌آموزی معلمان؛ شامل بانک و فایل اکسل مشخصات تیم‌های درس‌پژوهی استان‌های کشور"
        badge="پویش ملی معلمان"
        accentColor="#f37023"
        onBack={onBack}
      />

      <div className="container dusk-page-content">
        {/* Counter Hero */}
        <div className="campaign-hero-box">
          <div className="campaign-counter-badge">
            <Users size={20} className="text-orange-400" />
            <span>شمار معلمان هم‌پیمان در سراسر ایران:</span>
          </div>
          <div className="campaign-number font-titr">
            {totalCount.toLocaleString('fa-IR')}
            <small>معلم پیشرو</small>
          </div>
          <p className="campaign-lead">
            «یادگیری، یک پرواز جمعی‌ست. وقتی معلمان در کنار هم بنشینند و به یادگیری کودکان بیندیشند، آینده کشور ساخته می‌شود.»
          </p>
        </div>

        {(() => {
          const files = campaignFileList(campaignPdf, campaignFiles)
          if (!files.length) return null
          const gridColsClass = files.length === 1
            ? 'grid grid-cols-1 max-w-xl mx-auto gap-4 mb-8'
            : files.length === 2
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8'
          const renderFileIcon = (fileName: string) => {
            const ext = campaignFileExtension(fileName)
            if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return <ImageIcon size={22} />
            if (['mp4', 'webm', 'mov'].includes(ext)) return <Film size={22} />
            if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={22} />
            return <FileText size={22} />
          }
          return (
            <div className={gridColsClass} aria-label="فهرست فایل‌های کمپین">
              {files.map(file => {
                const isPdf = campaignFileExtension(file.fileName) === 'pdf'
                return (
                  <div
                    key={file.url}
                    className="dusk-card flex flex-col justify-between border border-orange-300/20 !p-4 sm:!p-5 transition-all hover:border-orange-400/40 hover:shadow-lg hover:shadow-orange-500/5"
                  >
                    <div className="flex items-start gap-3 min-w-0 mb-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-300/25 bg-orange-300/[0.08] text-orange-200 shadow-inner">
                        {renderFileIcon(file.fileName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-titr text-base text-white leading-6 mb-1">
                          {campaignFileTitle(file.fileName)}
                        </h3>
                        <p
                          className="break-all text-xs text-slate-300 leading-5"
                          title={file.fileName}
                        >
                          {file.fileName}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 min-[340px]:grid-cols-2 gap-2 mt-auto pt-3 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => setSelectedCampaignFile(file)}
                        className="dusk-action-btn btn-secondary !w-full !min-h-[42px] !py-2 !px-2 text-xs"
                      >
                        <Eye size={16} className="shrink-0" />
                        <span className="font-titr truncate">
                          {isPdf ? 'نمایش فایل PDF' : 'نمایش فایل'}
                        </span>
                      </button>
                      <a
                        href={file.downloadUrl || file.url}
                        download={file.fileName}
                        className="dusk-action-btn btn-primary !w-full !min-h-[42px] !py-2 !px-2 text-xs"
                        style={{ background: 'linear-gradient(135deg, #f37023 0%, #ea580c 100%)' }}
                        onClick={() => notify(`دریافت فایل ${file.fileName} آغاز شد.`)}
                      >
                        <Download size={16} className="shrink-0" />
                        <span className="font-titr truncate">
                          {isPdf ? 'دریافت فایل PDF' : 'دریافت فایل'}
                        </span>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* 1. REQUIRED DELIVERABLE: فایل اکسل مشخصات تیم های درس پژوهی استان */}
        {sourceTeams.length === 0 ? (
          <div className="dusk-card p-12 text-center mb-8">
            <FileSpreadsheet size={42} className="mx-auto mb-3 text-slate-500 opacity-60" />
            <h3 className="font-titr text-lg text-white mb-2">هنوز فایل اکسل مشخصات تیم‌های استانی ثبت نشده است</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              فایل‌های اکسل و شناسنامه آماری تیم‌های فعال درس‌پژوهی استان‌ها پس از اعتبارسنجی توسط دبیرخانه کشوری در این بخش قرار می‌گیرند.
            </p>
          </div>
        ) : (
          <div className="dusk-card campaign-excel-card mb-8">
            <div className="excel-card-header">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400">
                  <FileSpreadsheet size={28} />
                </div>
                <div>
                  <h3 className="font-titr text-xl text-white">
                    فایل اکسل مشخصات تیم‌های درس‌پژوهی استان
                  </h3>
                  <p className="text-sm text-slate-300">
                    دسترسی، بررسی و دانلود مستقیم مشخصات شناسنامه‌ای تیم‌های فعال درس‌پژوهی در سطح استان‌ها و مناطق آموزشی
                  </p>
                </div>
              </div>

              {currentProvData && (
                <a
                  href={currentProvData.excelUrl}
                  download
                  className="dusk-action-btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #f37023 0%, #ea580c 100%)' }}
                  onClick={() => notify(`دانلود فایل اکسل تیم‌های درس‌پژوهی استان ${currentProvData.province} آغاز شد.`)}
                >
                  <Download size={18} />
                  <span className="font-titr">دانلود فایل اکسل مشخصات تیم‌های استان (XLSX)</span>
                </a>
              )}
            </div>

            {/* Province selector pills */}
            <div className="dusk-filter-tabs mt-4">
              {sourceTeams.map((pt, idx) => (
                <button
                  key={pt.provinceCode}
                  className={`dusk-tab-btn ${selectedProvIndex === idx ? 'active' : ''}`}
                  onClick={() => setSelectedProvIndex(idx)}
                >
                  {pt.province} ({pt.teamCount.toLocaleString('fa-IR')} تیم)
                </button>
              ))}
            </div>

            {/* Live Preview Table */}
            {currentProvData && (
              <>
                <div className="excel-table-wrapper mt-4 overflow-x-auto">
                  <table className="dusk-table w-full text-right">
                    <thead>
                      <tr>
                        <th>کد شناسه تیم</th>
                        <th>شهرستان / منطقه</th>
                        <th>نام مدرسه</th>
                        <th>پایه تحصیلی</th>
                        <th>موضوع درس‌پژوهی</th>
                        <th>نام سرتیم</th>
                        <th>تعداد اعضا</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProvData.sampleTeams.map((team: ProvinceTeamsData['sampleTeams'][number]) => (
                        <tr key={team.code}>
                          <td data-label="کد شناسه تیم" className="font-mono text-cyan-300">{team.code}</td>
                          <td data-label="شهرستان / منطقه">{team.area}</td>
                          <td data-label="نام مدرسه">{team.school}</td>
                          <td data-label="پایه تحصیلی"><span className="grade-badge">{team.grade}</span></td>
                          <td data-label="موضوع درس‌پژوهی" className="font-medium text-white">{team.subject}</td>
                          <td data-label="نام سرتیم">{team.leader}</td>
                          <td data-label="تعداد اعضا">{team.membersCount} نفر</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="table-caption-note mt-3 text-xs text-slate-400">
                  * برای دسترسی به مشخصات کامل تمام {currentProvData.teamCount.toLocaleString('fa-IR')} تیم فعال این استان، دکمه «دانلود فایل اکسل» را کلیک کنید.
                </p>
              </>
            )}
          </div>
        )}

        {/* Manifesto */}
        <div className="campaign-section-title">
          <Sparkles size={22} className="text-orange-400" />
          <h2 className="font-titr">میثاق‌نامه پویش «ما با هم می‌آموزیم»</h2>
        </div>

        <div className="manifesto-grid">
          {manifestoItems.map((item) => (
            <div key={item.num} className="manifesto-card">
              <span className="manifesto-num font-titr">{item.num}</span>
              <h3 className="font-titr">{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>

        {/* Pledge Form */}
        <div className="campaign-pledge-card">
          <div className="pledge-header">
            <HeartHandshake size={28} className="text-orange-400" />
            <div>
              <h3 className="font-titr">عهدنامه هم‌آموزی من</h3>
              <p>با ثبت عهدنامه، به جمع هم‌آموزان پویش ملی درس‌پژوهی بپیوندید.</p>
            </div>
          </div>

          {hasPledged ? (
            <div className="pledge-success-banner">
              <CheckCircle2 size={32} className="text-emerald-400" />
              <div>
                <h4 className="font-titr">پیمان شما با موفقیت به ثبت رسید!</h4>
                <p>سپاس از همراهی شما در مسیر هم‌آموزی و ارتقای کیفیت کلاس‌های درس سراسر کشور.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePledgeSubmit} className="dusk-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="p-name">نام و نام خانوادگی:</label>
                  <input
                    id="p-name"
                    required
                    type="text"
                    autoComplete="name"
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: فاطمه اسدی"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="p-code">کد پرسنلی یا کد ملی:</label>
                  <input
                    id="p-code"
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{8}([0-9]{2})?"
                    maxLength={10}
                    value={personnelCode}
                    onChange={(e) => setPersonnelCode(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 10))}
                    placeholder="۸ رقم پرسنلی یا ۱۰ رقم ملی"
                    aria-describedby="p-code-help"
                  />
                  <small id="p-code-help" className="text-xs text-slate-400">اگر کد پرسنلی ندارید، کد ملی را وارد کنید.</small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="p-prov">استان / واحد محل خدمت:</label>
                  <select id="p-prov" required value={province} onChange={(e) => setProvince(e.target.value)}>
                    <option value="" disabled>انتخاب استان یا واحد</option>
                    {PROVINCE_UNITS.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="p-grade">مقطع:</label>
                  <select id="p-grade" required value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="" disabled>انتخاب مقطع</option>
                    <option value="متوسطه اول">متوسطه اول</option>
                    <option value="متوسطه دوم نظری">متوسطه دوم نظری</option>
                    <option value="متوسطه دوم فنی حرفه‌ای و کارودانش">متوسطه دوم فنی حرفه‌ای و کارودانش</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="p-district">ناحیه / منطقه:</label>
                  <input id="p-district" required type="text" maxLength={150} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="نام ناحیه یا منطقه آموزشی" />
                </div>
                <div className="form-group">
                  <label htmlFor="p-phone">شماره همراه:</label>
                  <input
                    id="p-phone"
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    pattern="09[0-9]{9}"
                    maxLength={11}
                    value={phone}
                    onChange={(e) => setPhone(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 11))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="p-school">مدرسه:</label>
                <input id="p-school" required type="text" maxLength={200} value={school} onChange={(e) => setSchool(e.target.value)} placeholder="نام مدرسه" />
              </div>

              <div className="pledge-terms">
                <Award size={18} className="text-orange-400 flex-shrink-0" />
                <span>«{pledgeText}»</span>
              </div>

              <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs leading-6 text-slate-300">
                حریم خصوصی: مشخصات و راه‌های تماس شما فقط برای مدیر احراز هویت‌شده قابل مشاهده است؛ برای عموم فقط شمار کلی همراهان نمایش داده می‌شود.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="dusk-submit-btn font-titr disabled:cursor-wait disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #f37023 0%, #d5187c 100%)' }}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                <span>{isSubmitting ? 'در حال ثبت امن عهدنامه…' : 'امضا و پیوستن به پویش ملی'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
      {duplicateNotice && (
        <MiniNoticeDialog
          title="ثبت‌نام تکراری"
          message={duplicateNotice}
          onClose={() => setDuplicateNotice('')}
        />
      )}
      {selectedCampaignFile?.url && (
        <FilePreviewDialog
          title={campaignFileTitle(selectedCampaignFile.fileName)}
          url={selectedCampaignFile.url}
          fileName={selectedCampaignFile.fileName}
          downloadUrl={selectedCampaignFile.downloadUrl}
          onClose={() => setSelectedCampaignFile(null)}
        />
      )}
    </div>
  )
}
