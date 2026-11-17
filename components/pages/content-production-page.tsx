import React, { useState } from 'react'
import {
  Download,
  Eye,
  Image as ImageIcon,
  PlayCircle,
  FileCode,
  FileText,
  Presentation,
  ExternalLink,
  Send,
  X,
  Film,
  BookOpen,
} from 'lucide-react'
import { PageHeader } from './page-header'
import { contentMediaItems, type ContentMediaItem } from '@/src/data'
import { PROVINCE_UNITS } from '@/src/provinces'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'

const toEnglishDigits = (value: string) => value.replace(/[۰-۹٠-٩]/g, (digit) => {
  const code = digit.charCodeAt(0)
  return String.fromCharCode(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 + 48 : code - 0x0660 + 48)
})

interface ContentProductionPageProps {
  onBack: () => void
  notify: (msg: string) => void
  items?: ContentMediaItem[]
  onOpenBookReading?: () => void
}

export const ContentProductionPage: React.FC<ContentProductionPageProps> = ({ onBack, notify, items, onOpenBookReading }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'عکس' | 'اینفوگراف' | 'ویدیو ابری' | 'فایل آموزشی' | 'upload'>('all')
  const [selectedImage, setSelectedImage] = useState<{ title: string; url: string } | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<{ title: string; url: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ title: string; url: string; fileName?: string } | null>(null)

  // Upload Form
  const [producerName, setProducerName] = useState('')
  const [nationalCode, setNationalCode] = useState('')
  const [personnelCode, setPersonnelCode] = useState('')
  const [province, setProvince] = useState('')
  const [district, setDistrict] = useState('')
  const [grade, setGrade] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [contentType, setContentType] = useState('عکس و گزارش تصویری')
  const [contentTitle, setContentTitle] = useState('')
  const [mediaLink, setMediaLink] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !producerName.trim() || !nationalCode || !personnelCode || !province || !district.trim() ||
      !grade || !phone || !email.trim() || !contentType || !contentTitle.trim() ||
      !mediaLink.trim() || !description.trim()
    ) {
      notify('لطفاً همه فیلدهای ارسال اثر را تکمیل کنید.')
      return
    }
    if (!/^\d{10}$/.test(nationalCode)) {
      notify('کد ملی باید ۱۰ رقم باشد.')
      return
    }
    if (!/^\d{8}$/.test(personnelCode)) {
      notify('کد پرسنلی باید ۸ رقم باشد.')
      return
    }
    if (!/^09\d{9}$/.test(phone)) {
      notify('شماره همراه معتبر نیست.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify('پست الکترونیک معتبر نیست.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/experiences', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionType: 'content-production',
          fullName: producerName.trim(),
          nationalCode,
          personnelCode,
          province,
          district: district.trim(),
          grade,
          phone,
          email: email.trim(),
          contentType,
          title: contentTitle.trim(),
          mediaLink: mediaLink.trim(),
          description: description.trim(),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result?.status !== 'saved') {
        notify(result?.error || 'ارسال اثر انجام نشد؛ لطفاً دوباره تلاش کنید.')
        return
      }
      notify(`اثر «${contentTitle.trim()}» برای بررسی اولیه ارسال شد.`)
      setContentTitle('')
      setMediaLink('')
      setDescription('')
      setProducerName('')
      setNationalCode('')
      setPersonnelCode('')
      setProvince('')
      setDistrict('')
      setGrade('')
      setPhone('')
      setEmail('')
      setActiveTab('all')
    } catch {
      notify('ارتباط با دبیرخانه برقرار نشد؛ اثر ارسال نشده است.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const sourceData = items !== undefined ? items : contentMediaItems
  const filteredMedia = sourceData.filter((item) => {
    if (activeTab === 'all') return true
    return item.category === activeTab
  })

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="content-production"
        title="تولید محتوا"
        subtitle="بانک چندرسانه‌ای درس‌پژوهی؛ شامل عکس، اینفوگراف، لینک ویدیوهای ابری و فایل‌های آموزشی در قالب‌های ورد، پی‌دی‌اف و پاورپوینت"
        badge="رسانه و ابزارها"
        accentColor="#f59e0b"
        onBack={onBack}
      />

      <div className="container dusk-page-content">
        {onOpenBookReading && (
          <button type="button" onClick={onOpenBookReading} className="mb-5 w-full sm:w-auto rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-500/15 inline-flex items-center justify-center gap-2">
            <BookOpen size={17} /> حلقه‌های خوانش کتاب استان‌ها
          </button>
        )}
        {/* Tab Filters */}
        <div className="dusk-filter-tabs">
          <button
            className={`dusk-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            همه محتواها ({sourceData.length})
          </button>
          <button
            className={`dusk-tab-btn ${activeTab === 'عکس' ? 'active' : ''}`}
            onClick={() => setActiveTab('عکس')}
          >
            عکس
          </button>
          <button
            className={`dusk-tab-btn ${activeTab === 'اینفوگراف' ? 'active' : ''}`}
            onClick={() => setActiveTab('اینفوگراف')}
          >
            اینفوگراف
          </button>
          <button
            className={`dusk-tab-btn ${activeTab === 'ویدیو ابری' ? 'active' : ''}`}
            onClick={() => setActiveTab('ویدیو ابری')}
          >
            لینک ویدیوهای آموزشی ابری
          </button>
          <button
            className={`dusk-tab-btn ${activeTab === 'فایل آموزشی' ? 'active' : ''}`}
            onClick={() => setActiveTab('فایل آموزشی')}
          >
            فایل‌های آموزشی (ورد، PDF، PPT)
          </button>
          <button
            className={`dusk-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            ارسال اثر جدید
          </button>
        </div>

        {activeTab !== 'upload' ? (
          filteredMedia.length === 0 ? (
            <div className="dusk-card p-12 text-center my-8">
              <Film size={42} className="mx-auto mb-3 text-slate-500 opacity-60" />
              <h3 className="font-titr text-lg text-white mb-2">هنوز محتوای چندرسانه‌ای در این بخش ثبت نشده است</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                عکس‌ها، اینفوگرافیک‌ها، ویدیوهای آموزشی و فایل‌های مصوب (ورد، PDF و PPTX) پس از بارگذاری در این بخش نمایش داده می‌شوند.
              </p>
            </div>
          ) : (
            <div className="dusk-cards-grid">
              {filteredMedia.map((item) => (
                <div key={item.id} className="dusk-card content-media-card">
                  <div className="dusk-card-top">
                    <span className="status-pill amber">{item.category}</span>
                    <span className="platform-tag">{item.badgeText}</span>
                  </div>

                  <h3 className="dusk-card-title font-titr">{item.title}</h3>
                  <p className="dusk-card-desc">{item.description}</p>

                  <div className="dusk-card-actions mt-4 pt-3 border-t border-slate-700/50">
                    {item.fileType === 'jpg' && (
                      <div className="flex gap-2 w-full">
                        {item.viewUrl && (
                          <button
                            type="button"
                            onClick={() => setSelectedImage({ title: item.title, url: item.viewUrl! })}
                            className="doc-mini-btn btn-poster flex-1 justify-center"
                          >
                            <ImageIcon size={15} />
                            <span>مشاهده تصویر</span>
                          </button>
                        )}
                        {item.downloadUrl && (
                          <a
                            href={item.downloadUrl}
                            download
                            className="doc-mini-btn btn-content flex-1 justify-center"
                            onClick={() => notify(`دانلود ${item.title} آغاز شد.`)}
                          >
                            <Download size={15} />
                            <span>دانلود فایل تصویر</span>
                          </a>
                        )}
                      </div>
                    )}

                    {item.fileType === 'cloud-link' && (
                      <button
                        type="button"
                        onClick={() => setSelectedVideo({ title: item.title, url: item.viewUrl! })}
                        className="doc-mini-btn btn-video w-full justify-center"
                      >
                        <PlayCircle size={15} />
                        <span>مشاهده در فضای ابری</span>
                      </button>
                    )}

                    {item.fileType === 'docx' && item.downloadUrl && (
                      <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={() => setSelectedFile({ title: item.title, url: item.downloadUrl!, fileName: `${item.id}.docx` })} className="doc-mini-btn btn-word flex-1 justify-center">
                          <Eye size={15} /> <span>نمایش Word</span>
                        </button>
                        <a href={item.downloadUrl} download={`${item.id}.docx`} className="doc-mini-btn btn-word flex-1 justify-center" onClick={() => notify(`دانلود فایل ورد «${item.title}» آغاز شد.`)}>
                          <FileCode size={15} /> <span className="font-titr">دانلود DOCX</span>
                        </a>
                      </div>
                    )}

                    {item.fileType === 'pdf' && item.downloadUrl && (
                      <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={() => setSelectedFile({ title: item.title, url: item.downloadUrl!, fileName: `${item.id}.pdf` })} className="doc-mini-btn btn-content flex-1 justify-center">
                          <Eye size={15} /> <span>نمایش PDF</span>
                        </button>
                        <a href={item.downloadUrl} download={`${item.id}.pdf`} className="doc-mini-btn btn-content flex-1 justify-center" onClick={() => notify(`دانلود فایل پی‌دی‌اف «${item.title}» آغاز شد.`)}>
                          <FileText size={15} /> <span className="font-titr">دانلود PDF</span>
                        </a>
                      </div>
                    )}

                    {item.fileType === 'pptx' && item.downloadUrl && (
                      <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={() => setSelectedFile({ title: item.title, url: item.downloadUrl!, fileName: `${item.id}.pptx` })} className="doc-mini-btn btn-ppt flex-1 justify-center">
                          <Eye size={15} /> <span>نمایش پاورپوینت</span>
                        </button>
                        <a href={item.downloadUrl} download={`${item.id}.pptx`} className="doc-mini-btn btn-ppt flex-1 justify-center" onClick={() => notify(`دانلود فایل پاورپوینت «${item.title}» آغاز شد.`)}>
                          <Presentation size={15} /> <span className="font-titr">دانلود PPTX</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="dusk-card submit-card-box">
            <h3 className="form-card-title font-titr">ارسال اثر چندرسانه‌ای به دبیرخانه کشوری</h3>
            <p className="form-card-subtitle">
              آثار ارسال‌شده توسط کارشناسان بررسی می‌شوند و در صورت تأیید، اطلاعات آموزشی اثر منتشر خواهد شد. اطلاعات هویتی و تماس فقط برای پیگیری دبیرخانه نگهداری می‌شود.
            </p>

            <form onSubmit={handleUploadSubmit} className="dusk-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cp-name">نام و نام خانوادگی:</label>
                  <input id="cp-name" required type="text" maxLength={150} autoComplete="name" value={producerName} onChange={(e) => setProducerName(e.target.value)} placeholder="نام و نام خانوادگی" />
                </div>
                <div className="form-group">
                  <label htmlFor="cp-national-code">کد ملی:</label>
                  <input id="cp-national-code" required type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" maxLength={10} value={nationalCode} onChange={(e) => setNationalCode(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 10))} placeholder="۱۰ رقم" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cp-personnel-code">کد پرسنلی:</label>
                  <input id="cp-personnel-code" required type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" maxLength={8} value={personnelCode} onChange={(e) => setPersonnelCode(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 8))} placeholder="۸ رقم" />
                </div>
                <div className="form-group">
                  <label htmlFor="cp-prov">استان:</label>
                  <select id="cp-prov" required value={province} onChange={(e) => setProvince(e.target.value)}>
                    <option value="" disabled>انتخاب استان</option>
                    {PROVINCE_UNITS.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cp-district">منطقه:</label>
                  <input id="cp-district" required type="text" maxLength={150} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="نام منطقه" />
                </div>
                <div className="form-group">
                  <label htmlFor="cp-grade">مقطع:</label>
                  <select id="cp-grade" required value={grade} onChange={(e) => setGrade(e.target.value)}>
                    <option value="" disabled>انتخاب مقطع</option>
                    <option value="ابتدایی">ابتدایی</option>
                    <option value="متوسطه اول">متوسطه اول</option>
                    <option value="متوسطه دوم نظری">متوسطه دوم نظری</option>
                    <option value="متوسطه دوم فنی حرفه‌ای و کارودانش">متوسطه دوم فنی حرفه‌ای و کارودانش</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cp-phone">شماره همراه:</label>
                  <input id="cp-phone" required type="tel" inputMode="numeric" autoComplete="tel-national" pattern="09[0-9]{9}" maxLength={11} value={phone} onChange={(e) => setPhone(toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 11))} placeholder="شماره همراه" />
                </div>
                <div className="form-group">
                  <label htmlFor="cp-email">پست الکترونیک:</label>
                  <input id="cp-email" required type="email" maxLength={150} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="cp-type">قالب اثر:</label>
                  <select id="cp-type" required value={contentType} onChange={(e) => setContentType(e.target.value)}>
                    <option value="عکس و گزارش تصویری">عکس و گزارش تصویری</option>
                    <option value="اینفوگراف">اینفوگرافیک درس‌پژوهی</option>
                    <option value="لینک ویدیو ابری">لینک ویدیوی آموزشی در فضای ابری</option>
                    <option value="فایل آموزشی ورد">فایل آموزشی ورد (DOCX)</option>
                    <option value="فایل آموزشی پی‌دی‌اف">فایل آموزشی پی‌دی‌اف (PDF)</option>
                    <option value="فایل آموزشی پاورپوینت">فایل آموزشی پاورپوینت (PPTX)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="cp-title">عنوان اثر:</label>
                  <input id="cp-title" required type="text" maxLength={255} value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} placeholder="عنوان اثر" />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="cp-link">لینک دسترسی به فایل یا ویدیو در فضای ابری:</label>
                <input
                  id="cp-link"
                  required
                  type="url"
                  value={mediaLink}
                  onChange={(e) => setMediaLink(e.target.value)}
                  placeholder="https://cloud.example.com/share/..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="cp-desc">توضیحات و مشخصات آموزشی:</label>
                <textarea
                  id="cp-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="موضوع درس، پایه تحصیلی، هدف آموزشی و گره یادگیری..."
                />
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="dusk-submit-btn font-titr disabled:cursor-wait disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}
                >
                  <Send size={16} />
                  <span>{isSubmitting ? 'در حال ارسال امن اثر…' : 'ارسال اثر جهت بررسی شورای علمی'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Image Preview Modal */}
        {selectedImage && (
          <div className="dusk-modal-overlay" onClick={() => setSelectedImage(null)}>
            <div className="dusk-modal-box poster-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title font-titr">{selectedImage.title}</h3>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="modal-close-btn"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body text-center">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="poster-modal-img"
                />
              </div>
            </div>
          </div>
        )}

        {/* Cloud Video Modal */}
        {selectedVideo && (
          <div className="dusk-modal-overlay" onClick={() => setSelectedVideo(null)}>
            <div className="dusk-modal-box video-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title font-titr">ویدیو در فضای ابری: {selectedVideo.title}</h3>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="modal-close-btn"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="video-placeholder-box">
                  <PlayCircle size={56} className="text-amber-400 mb-3" />
                  <p className="text-white font-medium mb-2">ویدئوی درس‌کاوی در فضای ابری دبیرخانه بارگذاری شده است</p>
                  <a
                    href={selectedVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="dusk-action-btn btn-primary inline-flex"
                    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}
                  >
                    <ExternalLink size={16} />
                    <span>ورود به سرور ابری و تماشای فیلم ({selectedVideo.url})</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
        {selectedFile && (
          <FilePreviewDialog
            title={selectedFile.title}
            url={selectedFile.url}
            fileName={selectedFile.fileName}
            onClose={() => setSelectedFile(null)}
          />
        )}
      </div>
    </div>
  )
}
