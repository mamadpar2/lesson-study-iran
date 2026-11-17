import React, { useState } from 'react'
import {
  Calendar,
  Users,
  Building,
  CheckCircle,
  Ticket,
  X,
  Image as ImageIcon,
  ScrollText,
  Camera,
  Download,
  Eye,
  UsersRound,
} from 'lucide-react'
import { PageHeader } from './page-header'
import { inPersonEventsData, type InPersonEvent } from '@/src/data'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'

interface InPersonPageProps {
  onBack: () => void
  notify: (msg: string) => void
  items?: InPersonEvent[]
}

export const InPersonPage: React.FC<InPersonPageProps> = ({ onBack, notify, items }) => {
  const [selectedProvince, setSelectedProvince] = useState<string>('همه')
  const [activeModalEvent, setActiveModalEvent] = useState<InPersonEvent | null>(null)
  const [selectedPoster, setSelectedPoster] = useState<{ title: string; url: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<{ title: string; url: string; fileName?: string } | null>(null)
  const [selectedGallery, setSelectedGallery] = useState<{ title: string; photos: { title: string; url: string }[] } | null>(null)
  const [registeredEventIds, setRegisteredEventIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Form states
  const [fullName, setFullName] = useState('')
  const [nationalCode, setNationalCode] = useState('')
  const [phone, setPhone] = useState('')
  const [school, setSchool] = useState('')

  const sourceData = items !== undefined ? items : inPersonEventsData
  const provinces = ['همه', ...Array.from(new Set(sourceData.map((e) => e.province)))]

  const filtered = sourceData.filter((e: InPersonEvent) => {
    if (selectedProvince === 'همه') return true
    return e.province === selectedProvince
  })

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeModalEvent || isSubmitting) return
    setIsSubmitting(true)
    setFormError('')
    try {
      const response = await fetch('/api/registrations', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'in-person', eventId: activeModalEvent.id, fullName: fullName.trim(), nationalCode, phone, school: school.trim() }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.status !== 'saved' || !result.id) throw new Error(result?.error || 'ثبت‌نام انجام نشد؛ دوباره تلاش کنید.')
      setRegisteredEventIds(previous => [...previous, activeModalEvent.id])
      notify(`ثبت‌نام شما با موفقیت انجام شد. شناسه پیگیری: ${result.id}`)
      setActiveModalEvent(null)
      setFullName(''); setNationalCode(''); setPhone(''); setSchool('')
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'ثبت‌نام انجام نشد؛ دوباره تلاش کنید.')
    } finally { setIsSubmitting(false) }
  }

  const isEventRegistered = (id: string) => registeredEventIds.includes(id)

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="in-person"
        title="نشست‌های حضوری"
        subtitle="گردهمایی‌های علمی و کارگاه‌های عملی درس‌پژوهی؛ شامل پوستر، بخشنامه، بسته محتوا و گزارش تصویری رویداد"
        badge="استانی و منطقه‌ای"
        accentColor="#85b50b"
        onBack={onBack}
      />

      <div className="container dusk-page-content">
        <div className="dusk-filter-tabs">
          {provinces.map((prov) => (
            <button
              key={prov}
              className={`dusk-tab-btn ${selectedProvince === prov ? 'active' : ''}`}
              onClick={() => setSelectedProvince(prov)}
            >
              {prov === 'همه' ? 'همه استان‌ها' : prov}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="dusk-card p-12 text-center my-8">
            <UsersRound size={42} className="mx-auto mb-3 text-slate-500 opacity-60" />
            <h3 className="font-titr text-lg text-white mb-2">هنوز نشست حضوری در این درگاه ثبت نشده است</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              گردهمایی‌ها و نشست‌های قطبی درس‌پژوهی و درس‌کاوی پس از تایید توسط دبیرخانه کشوری در این بخش قرار خواهند گرفت.
            </p>
          </div>
        ) : (
          <div className="dusk-cards-grid">
            {filtered.map((item) => {
            const registered = isEventRegistered(item.id)

            return (
              <div key={item.id} className="dusk-card event-card">
                <div className="dusk-card-top">
                  <span className="status-pill green">حضوری و کارگاهی</span>
                  <span className="platform-tag">{item.province} - {item.city}</span>
                </div>

                <h3 className="dusk-card-title font-titr">{item.title}</h3>

                <div className="webinar-meta-grid">
                  <div className="meta-item">
                    <Building size={16} className="text-lime-400" />
                    <span><strong>مکان برگزاری:</strong> {item.venue}</span>
                  </div>
                  <div className="meta-item">
                    <Calendar size={16} className="text-lime-400" />
                    <span><strong>زمان:</strong> {item.date}</span>
                  </div>
                  <div className="meta-item">
                    <Users size={16} className="text-lime-400" />
                    <span>{item.capacity}</span>
                  </div>
                </div>

                {/* 4 Designated Document Deliverables */}
                <div className="webinar-docs-panel">
                  <div className="panel-label font-titr">مستندات و فایل‌های نشست حضوری:</div>
                  <div className="docs-action-grid">
                    {/* 1. پوستر */}
                    <button
                      type="button"
                      onClick={() => setSelectedPoster({ title: item.title, url: item.posterUrl })}
                      className="doc-mini-btn btn-poster"
                      title="مشاهده پوستر رسمی نشست"
                    >
                      <ImageIcon size={15} />
                      <span>پوستر</span>
                    </button>

                    {/* 2. بخشنامه (اختیاری) */}
                    {item.circularUrl ? (
                      <div className="flex flex-col gap-1.5">
                        <button type="button" onClick={() => setSelectedFile({ title: `بخشنامه نشست ${item.title}`, url: item.circularUrl!, fileName: 'circular.pdf' })} className="doc-mini-btn btn-circular" title="نمایش بخشنامه اداری">
                          <Eye size={15} /><span>نمایش بخشنامه</span>
                        </button>
                        <a href={item.circularUrl} download="circular.pdf" className="doc-mini-btn btn-circular" title="دانلود بخشنامه اداری اعزام (اختیاری)">
                          <Download size={15} /><span>دانلود بخشنامه</span>
                        </a>
                      </div>
                    ) : (
                      <span className="doc-mini-btn opacity-50 cursor-not-allowed">
                        <ScrollText size={15} />
                        <span>بدون بخشنامه</span>
                      </span>
                    )}

                    {/* 3. محتوا */}
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => setSelectedFile({ title: `بسته محتوای نشست ${item.title}`, url: item.contentUrl, fileName: 'workshop-content.pdf' })} className="doc-mini-btn btn-content" title="نمایش بسته محتوای کارگاه">
                        <Eye size={15} /><span>نمایش محتوا</span>
                      </button>
                      <a href={item.contentUrl} download="workshop-content.pdf" className="doc-mini-btn btn-content" title="دانلود بسته محتوای کارگاه (PDF)">
                        <Download size={15} /><span>دانلود PDF</span>
                      </a>
                    </div>

                    {/* 4. گزارش تصویری */}
                    <button
                      type="button"
                      onClick={() => setSelectedGallery({ title: item.title, photos: item.photos })}
                      className="doc-mini-btn btn-gallery"
                      title="مشاهده گزارش تصویری"
                    >
                      <Camera size={15} />
                      <span>گزارش تصویری</span>
                    </button>
                  </div>
                </div>

                <div className="dusk-card-actions">
                  {item.status !== 'open' ? (
                    <button className="dusk-action-btn" disabled>ثبت‌نام این نشست فعال نیست</button>
                  ) : registered ? (
                    <button className="dusk-action-btn btn-success" disabled>
                      <CheckCircle size={16} />
                      <span>ثبت‌نام شما نهایی شده است</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => { setFormError(''); setActiveModalEvent(item) }}
                      className="dusk-action-btn btn-primary"
                      style={{ background: 'linear-gradient(135deg, #85b50b 0%, #65a30d 100%)' }}
                    >
                      <Ticket size={16} />
                      <span>ثبت‌نام در این نشست حضوری</span>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Poster Modal */}
        {selectedPoster && (
          <div className="dusk-modal-overlay" onClick={() => setSelectedPoster(null)}>
            <div className="dusk-modal-box poster-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title font-titr">پوستر رسمی: {selectedPoster.title}</h3>
                <button
                  onClick={() => setSelectedPoster(null)}
                  className="modal-close-btn"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body text-center">
                <img
                  src={selectedPoster.url}
                  alt={selectedPoster.title}
                  className="poster-modal-img"
                />
              </div>
              <div className="modal-footer">
                <a
                  href={selectedPoster.url}
                  download
                  className="dusk-action-btn btn-primary"
                >
                  <Download size={16} />
                  <span>دانلود پوستر با کیفیت بالا</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Photo Report Gallery Modal */}
        {selectedGallery && (
          <div className="dusk-modal-overlay" onClick={() => setSelectedGallery(null)}>
            <div className="dusk-modal-box gallery-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title font-titr">گزارش تصویری: {selectedGallery.title}</h3>
                <button
                  onClick={() => setSelectedGallery(null)}
                  className="modal-close-btn"
                  aria-label="بستن"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body">
                <div className="gallery-grid">
                  {selectedGallery.photos.map((ph, idx) => (
                    <div key={idx} className="gallery-card">
                      <img src={ph.url} alt={ph.title} className="gallery-img" />
                      <p className="gallery-caption">{ph.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal for registration */}
        {activeModalEvent && (
          <div className="dusk-modal-overlay" onClick={() => setActiveModalEvent(null)}>
            <div className="dusk-modal-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="dusk-modal-header">
                <h3 className="font-titr">ثبت‌نام در نشست حضوری: {activeModalEvent.title}</h3>
                <button
                  className="dusk-modal-close"
                  onClick={() => setActiveModalEvent(null)}
                  aria-label="بستن پنجره"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="dusk-form">
                <div className="form-group">
                  <label htmlFor="reg-name">نام و نام خانوادگی:</label>
                  <input
                    id="reg-name"
                    required
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: زهرا مرادی"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="reg-nat">کد ملی:</label>
                    <input
                      id="reg-nat"
                      required
                      type="text"
                      maxLength={10}
                      value={nationalCode}
                      onChange={(e) => setNationalCode(e.target.value)}
                      placeholder="۱۰ رقم بدون خط تیره"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-phone">شماره همراه:</label>
                    <input
                      id="reg-phone"
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="۰۹۱۲۰۰۰۰۰۰۰"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="reg-school">مدرسه و مقطع تدریس:</label>
                  <input
                    id="reg-school"
                    required
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    placeholder="مثال: دبستان رسالت - پایه سوم ابتدایی"
                  />
                </div>

                {formError && <p role="alert" className="text-red-300">{formError}</p>}
                <div className="form-actions">
                  <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="dusk-submit-btn font-titr">
                    {isSubmitting ? 'در حال ثبت اطلاعات…' : 'ثبت‌نام در نشست'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalEvent(null)}
                    className="dusk-cancel-btn"
                  >
                    انصراف
                  </button>
                </div>
              </form>
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
