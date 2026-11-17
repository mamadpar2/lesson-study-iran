import React, { useState } from 'react'
import {
  CheckSquare,
  Download,
  Layers,
  ShieldCheck,
  FileCheck2,
  Camera,
  MessageSquareQuote,
  Eye,
} from 'lucide-react'
import { PageHeader } from './page-header'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'
import { clinicalSteps, type ClinicalStep, defaultClinicalItems, type ClinicalItemData } from '@/src/data'

interface ClinicalSupervisionPageProps {
  onBack: () => void
  notify: (msg: string) => void
  items?: ClinicalItemData[]
}

export const ClinicalSupervisionPage: React.FC<ClinicalSupervisionPageProps> = ({ onBack, notify, items }) => {
  const [previewFile, setPreviewFile] = useState<{ title: string; url: string; fileName?: string } | null>(null)
  const sourceItems = items !== undefined ? items : defaultClinicalItems

  return (
    <div className="dusk-page-wrapper">
      <PageHeader
        route="clinical-supervision"
        title="نظارت بالینی"
        subtitle="الگوی نوین مشاهده همکارانه و هدایت حرفه‌ای در مدرسه؛ متمرکز بر شواهد عینی یادگیری و بدون قضاوت عملکرد معلم"
        badge="مشاهده و بازخورد حمایتی"
        accentColor="#0ea5e9"
        onBack={onBack}
      />

      <div className="container dusk-page-content">
        {/* Core Deliverables Cards */}
        {sourceItems.length === 0 ? (
          <div className="dusk-card p-12 text-center mb-8">
            <Layers size={42} className="mx-auto mb-3 text-slate-500 opacity-60" />
            <h3 className="font-titr text-lg text-white mb-2">هنوز سندی در بخش نظارت بالینی بارگذاری نشده است</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              کاربرگ‌های نظارت، مستندات بازدید و فرم‌های تاییدشده کشوری پس از ثبت در سامانه در این بخش قابل دریافت خواهند بود.
            </p>
          </div>
        ) : (
          <div className="clinical-deliverables-grid grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {sourceItems.map((item, idx) => (
              <div key={item.id || idx} className="dusk-card clinical-doc-box flex flex-col">
                <div className="doc-box-icon text-sky-400">
                  {idx === 0 ? <FileCheck2 size={32} /> : idx === 1 ? <Camera size={32} className="text-pink-400" /> : <MessageSquareQuote size={32} className="text-emerald-400" />}
                </div>
                <h3 className="font-titr text-lg text-white mt-2">
                  {item.title}
                </h3>
                <p className="text-xs text-sky-300 font-medium mt-0.5">{item.role}</p>
                <p className="text-sm text-slate-300 mt-1 mb-4 flex-1">
                  {item.description}
                </p>
                <div className="flex flex-col gap-2 mt-auto">
                  {item.reportUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewFile({ title: item.title, url: item.reportUrl! })}
                      className="doc-mini-btn btn-gallery justify-center cursor-pointer"
                    >
                      <Camera size={15} />
                      <span>مشاهده گزارش تصویری بازدید</span>
                    </button>
                  )}
                  {item.pdfUrl && (
                    <button type="button" onClick={() => setPreviewFile({ title: item.title, url: item.pdfUrl!, fileName: item.pdfFileName || 'clinical.pdf' })} className="doc-mini-btn btn-content justify-center cursor-pointer">
                      <Eye size={15} />
                      <span>نمایش نسخه پی‌دی‌اف (PDF)</span>
                    </button>
                  )}
                  {item.pdfUrl && (
                    <a
                      href={item.pdfUrl}
                      download
                      className="doc-mini-btn btn-content justify-center"
                      onClick={() => notify(`دانلود فایل ${item.title} (PDF) آغاز شد.`)}
                    >
                      <Download size={15} />
                      <span>دریافت نسخه پی‌دی‌اف (PDF)</span>
                    </a>
                  )}
                  {item.docxUrl && (
                    <button type="button" onClick={() => setPreviewFile({ title: item.title, url: item.docxUrl!, fileName: item.docxFileName || 'clinical.docx' })} className="doc-mini-btn btn-word justify-center cursor-pointer">
                      <Eye size={15} />
                      <span>نمایش نسخه ورد (DOCX)</span>
                    </button>
                  )}
                  {item.docxUrl && (
                    <a
                      href={item.docxUrl}
                      download
                      className="doc-mini-btn btn-word justify-center"
                      onClick={() => notify(`دانلود فایل ${item.title} (Word) آغاز شد.`)}
                    >
                      <Download size={15} />
                      <span>دریافت نسخه قابل ویرایش (DOCX)</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 3 Steps Flow */}
        <div className="campaign-section-title">
          <Layers size={22} className="text-sky-400" />
          <h2 className="font-titr">چرخه سه‌مرحله‌ای نظارت بالینی در مدرسه</h2>
        </div>

        <div className="clinical-steps-flow">
          {clinicalSteps.map((s: ClinicalStep) => (
            <div key={s.step} className="dusk-card clinical-step-card">
              <div className="step-badge-wrap">
                <span className="step-num-pill font-titr">گام {s.step}</span>
                <span className="step-timing">{s.timing}</span>
              </div>

              <h3 className="font-titr">{s.title}</h3>
              <p className="step-aim"><strong>هدف محوری:</strong> {s.aim}</p>

              <div className="step-actions-list">
                <h4 className="font-titr">اقدامات کلیدی:</h4>
                <ul>
                  {s.actions.map((act: string, idx: number) => (
                    <li key={idx}>
                      <CheckSquare size={15} className="text-sky-400 flex-shrink-0" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="step-tools-bar">
                <span><strong>ابزار مورد نیاز:</strong> {s.tools}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Principles */}
        <div className="clinical-bottom-grid mt-8">
          <div className="dusk-card clinical-principles-card">
            <h3 className="font-titr">
              <ShieldCheck size={20} className="text-sky-400 inline ml-2" />
              چهار اصل طلایی نظارت بالینی
            </h3>
            <ul>
              <li><strong>امنیت روانی و رازداری:</strong> کلاس درس آزمایشگاهی زنده برای آزمودن ایده‌هاست، نه بازرسی.</li>
              <li><strong>تمرکز بر شواهد، نه نظرات شخصی:</strong> ثبت دقیق واژه‌ها، مکث‌ها و خطاهای دانش‌آموزان.</li>
              <li><strong>محوریت خودبازاندیشی معلم:</strong> ناظر سوال می‌پرسد تا معلم خود مسیر بهبود را بیابد.</li>
              <li><strong>استمرار در چرخه‌های کوچک:</strong> تغییرات کوچک، مستمر و واقع‌بینانه ماندگارترند.</li>
            </ul>
          </div>
        </div>
      </div>
      {previewFile && (
        <FilePreviewDialog
          title={previewFile.title}
          url={previewFile.url}
          fileName={previewFile.fileName}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}
