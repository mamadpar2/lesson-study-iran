import { useState } from 'react'
import type { FormEvent } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import {
  ArrowLeft,
  ArrowUpLeft,
  Bird,
  Bookmark,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderOpen,
  Info,
  MapPin,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ResourceArtwork, ResourceCard } from './resource-card'
import { categories, events, normalize, resources, stories, toFa } from '@/src/data'
import type { LearningEvent, Resource, Story } from '@/src/data'
import type { Experience, Modal } from '@/src/types'
import { downloadFile } from '@/lib/storage'
import { FilePreviewDialog } from '@/components/ui/file-preview-dialog'

interface Props {
  modal: Modal
  setModal: (modal: Modal) => void
  bookmarks: string[]
  toggleBookmark: (id: string) => void
  experiences: Experience[]
  saveExperience: (entry: Experience) => void
  removeExperience: (id: string) => void
  reminders: string[]
  toggleReminder: (id: string) => void
  notify: (message: string) => void
}
const provinces = [
  'آذربایجان شرقی',
  'آذربایجان غربی',
  'اردبیل',
  'اصفهان',
  'البرز',
  'ایلام',
  'بوشهر',
  'تهران',
  'چهارمحال و بختیاری',
  'خراسان جنوبی',
  'خراسان رضوی',
  'خراسان شمالی',
  'خوزستان',
  'زنجان',
  'سمنان',
  'سیستان و بلوچستان',
  'فارس',
  'قزوین',
  'قم',
  'کردستان',
  'کرمان',
  'کرمانشاه',
  'کهگیلویه و بویراحمد',
  'گلستان',
  'گیلان',
  'لرستان',
  'مازندران',
  'مرکزی',
  'هرمزگان',
  'همدان',
  'یزد',
]

function ModalEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="modal-eyebrow">
      <span />
      {children}
    </span>
  )
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <FolderOpen size={38} strokeWidth={1.1} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}
function receiptDownload(entry: Experience) {
  downloadFile(
    JSON.stringify(
      {
        notice:
          'پیش‌نویس محلی؛ این تجربه به دبیرخانه ارسال نشده است. فایل پیوست فقط نام‌گذاری شده و محتوای آن ذخیره نشده است.',
        ...entry,
      },
      null,
      2,
    ),
    `${entry.id}.json`,
    'application/json;charset=utf-8',
  )
}

function ResourceDetail({
  resource,
  saved,
  toggleSave,
}: {
  resource: Resource
  saved: boolean
  toggleSave: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileUrl = `/resources/${resource.id}.pdf`
  return (
    <>
      <ModalEyebrow>کتابخانه همراهِ معلم</ModalEyebrow>
      <DialogTitle>{resource.title}</DialogTitle>
      <DialogDescription>{resource.subtitle}</DialogDescription>
      <div className="resource-detail-grid">
        <ResourceArtwork resource={resource} />
        <div>
          <span className={`category-label label-${resource.color}`}>{resource.category}</span>
          <p>{resource.description}</p>
          <ul className="check-list">
            {resource.points.map((point) => (
              <li key={point}>
                <Check size={15} />
                {point}
              </li>
            ))}
          </ul>
          <span className="file-meta">
            <FileText size={15} />
            PDF
            <span />
            {toFa(resource.pages)} صفحه
            <span />
            فارسی
          </span>
        </div>
      </div>
      <div className="modal-action-bar">
        <Button asChild>
          <a href={`/resources/${resource.id}.pdf`} download>
            <Download size={17} />
            دریافت رایگان راهنما
          </a>
        </Button>
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          <Eye size={16} />
          نمایش فایل
        </Button>
        <Button variant="outline" onClick={toggleSave}>
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'در نشان‌شده‌ها' : 'برای بعد نشان کن'}
        </Button>
      </div>
      <p className="modal-footnote">
        راهنمای آموزشیِ تألیفی برای این نسخه نمایشی؛ جایگزین شیوه‌نامه رسمی دبیرخانه نیست.
      </p>
      {previewOpen && (
        <FilePreviewDialog
          title={resource.title}
          url={fileUrl}
          fileName={`${resource.id}.pdf`}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  )
}

function Library({
  bookmarks,
  toggleBookmark,
  setModal,
}: Pick<Props, 'bookmarks' | 'toggleBookmark' | 'setModal'>) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('همه منابع')
  const filtered = resources.filter(
    (resource) =>
      (category === 'همه منابع' || resource.category === category) &&
      normalize(`${resource.title}${resource.description}`).includes(normalize(query)),
  )
  return (
    <>
      <ModalEyebrow>یک گنجینه برای قدم‌های کوچک</ModalEyebrow>
      <DialogTitle>کتابخانه همراهِ معلم</DialogTitle>
      <DialogDescription>
        راهنماها و الگوها را پیدا کنید، دریافت کنید یا برای بعد نشان بگذارید.
      </DialogDescription>
      <div className="input-with-icon library-search">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="چه چیزی به قدم بعدی‌تان کمک می‌کند؟"
          aria-label="جست‌وجوی منابع"
          maxLength={100}
        />
        {query && (
          <button aria-label="پاک‌کردن جست‌وجو" onClick={() => setQuery('')}>
            <X size={15} />
          </button>
        )}
      </div>
      <div className="library-filters">
        <div className="filter-chips" role="group" aria-label="دسته منابع کتابخانه">
          {categories.map((item) => (
            <button
              key={item}
              className={category === item ? 'selected' : ''}
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span>{toFa(filtered.length)} منبع</span>
      </div>
      {filtered.length ? (
        <div className="resource-grid library-grid">
          {filtered.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              saved={bookmarks.includes(resource.id)}
              onSave={() => toggleBookmark(resource.id)}
              onOpen={() => setModal({ type: 'resource', id: resource.id })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="هنوز چیزی پیدا نکردیم."
          text="واژه‌ای کوتاه‌تر امتحان کنید یا دسته‌بندی را تغییر دهید."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery('')
                setCategory('همه منابع')
              }}
            >
              نمایش همه منابع
            </Button>
          }
        />
      )}
    </>
  )
}

function SearchDialog({ setModal }: Pick<Props, 'setModal'>) {
  const [query, setQuery] = useState('')
  const all = [
    ...resources.map((item) => ({
      id: item.id,
      title: item.title,
      type: 'resource' as const,
      label: 'منبع آموزشی',
      icon: BookOpen,
    })),
    ...stories.map((item) => ({
      id: item.id,
      title: item.title,
      type: 'article' as const,
      label: 'روایت کلاس',
      icon: FileText,
    })),
    ...events.map((item) => ({
      id: item.id,
      title: item.title,
      type: 'event' as const,
      label: 'رویداد نمونه',
      icon: CalendarDays,
    })),
  ]
  const found = query.trim()
    ? all.filter((item) => normalize(`${item.title}${item.label}`).includes(normalize(query)))
    : all.slice(0, 4)
  return (
    <>
      <ModalEyebrow>هر پرسش، یک شروع تازه</ModalEyebrow>
      <DialogTitle>دنبال چه می‌گردید؟</DialogTitle>
      <DialogDescription>در منابع، روایت‌ها و رویدادهای دبیرخانه جست‌وجو کنید.</DialogDescription>
      <div className="input-with-icon global-search">
        <Search size={21} />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="مثلاً مشاهده کلاس یا طراحی درس…"
          aria-label="عبارت جست‌وجو در سایت"
          maxLength={100}
        />
        {query && (
          <button onClick={() => setQuery('')} aria-label="پاک‌کردن عبارت">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="search-results-heading">
        <span>{query ? 'نتیجه‌های جست‌وجو' : 'پیشنهادهای ما برای شروع'}</span>
        <small>{toFa(found.length)} مورد</small>
      </div>
      <div className="search-results">
        {found.length ? (
          found.map((item) => (
            <button key={item.id} onClick={() => setModal({ type: item.type, id: item.id })}>
              <span className="search-result-icon">
                <item.icon size={19} strokeWidth={1.5} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.label}</small>
              </span>
              <ArrowUpLeft size={17} />
            </button>
          ))
        ) : (
          <EmptyState
            title="برای این عبارت نتیجه‌ای پیدا نشد."
            text="املا را بررسی کنید یا با واژه‌ای مانند «درس» جست‌وجو کنید."
          />
        )}
      </div>
      <p className="search-keyboard-note">
        <kbd>Esc</kbd> برای بستن <span /> <kbd>Ctrl K</kbd> برای جست‌وجو
      </p>
    </>
  )
}

function AboutDialog({ setModal }: Pick<Props, 'setModal'>) {
  return (
    <>
      <ModalEyebrow>درباره مسیرِ ما</ModalEyebrow>
      <DialogTitle>کلاس درس، نقطه آغازِ یادگیری ماست.</DialogTitle>
      <DialogDescription>
        دبیرخانه، خانه‌ای برای پشتیبانی از یادگیری حرفه‌ای و جمعی معلمان است.
      </DialogDescription>
      <div className="about-dialog-banner">
        <Bird size={48} strokeWidth={1} />
        <p>
          از تدریسِ تنها،
          <br />
          <strong>به یادگیریِ کنار هم.</strong>
        </p>
        <UsersRound size={48} strokeWidth={1} />
      </div>
      <Tabs.Root defaultValue="study" dir="rtl" className="about-tabs">
        <Tabs.List className="tabs-list" aria-label="آشنایی با روش‌ها">
          <Tabs.Trigger value="study">درس‌پژوهی چیست؟</Tabs.Trigger>
          <Tabs.Trigger value="analysis">درس‌کاوی چیست؟</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="study" className="tabs-content">
          <h3>یک چرخه یادگیری، با یک پرسش مشترک</h3>
          <p>
            درس‌پژوهی، پژوهشی مشارکتی درباره یادگیری دانش‌آموزان است. گروهی از معلمان یک پرسش واقعی را انتخاب
            می‌کنند، درس را با هم طراحی می‌کنند، اجرای آن را با تمرکز بر شواهد یادگیری مشاهده می‌کنند و بر
            پایه گفت‌وگو، به بازطراحی می‌رسند.
          </p>
          <ul className="check-list">
            <li>
              <Check size={15} />
              موضوع مشاهده، یادگیری دانش‌آموز است؛ نه رتبه‌بندی معلم.
            </li>
            <li>
              <Check size={15} />
              همه اعضا در طراحی، مشاهده و بازاندیشی سهیم‌اند.
            </li>
            <li>
              <Check size={15} />
              هدف، ساختن دانش حرفه‌ایِ مشترک و قابل استفاده است.
            </li>
          </ul>
        </Tabs.Content>
        <Tabs.Content value="analysis" className="tabs-content">
          <h3>دوباره دیدنِ یک موقعیت، از چند زاویه</h3>
          <p>
            درس‌کاوی فرصتی برای مطالعه دقیق رخدادهای کلاس است. با مرور یک روایت، یادداشت مشاهده یا نمونه
            کارِ مجاز، می‌پرسیم دانش‌آموز چگونه فکر کرده، چه چیزی به یادگیری کمک کرده و چه تغییری می‌تواند
            فرصت بهتری بسازد.
          </p>
          <ul className="check-list">
            <li>
              <Check size={15} />
              مشاهده را از تفسیر و قضاوت جدا می‌کنیم.
            </li>
            <li>
              <Check size={15} />
              به شواهد و چند تبیین ممکن توجه می‌کنیم.
            </li>
            <li>
              <Check size={15} />
              از فهم موقعیت، به یک پیشنهاد قابل بررسی می‌رسیم.
            </li>
          </ul>
        </Tabs.Content>
      </Tabs.Root>
      <div className="modal-action-bar">
        <Button onClick={() => setModal({ type: 'resource', id: 'lesson-study-starter' })}>
          راهنمای اولین قدم
          <BookOpen size={17} />
        </Button>
        <Button variant="ghost" onClick={() => setModal({ type: 'submit' })}>
          تجربه‌ای برای گفتن دارم
          <ArrowLeft size={17} />
        </Button>
      </div>
    </>
  )
}

function ExperienceForm({
  saveExperience,
  setModal,
  notify,
}: Pick<Props, 'saveExperience' | 'setModal' | 'notify'>) {
  const [receipt, setReceipt] = useState<Experience | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [summaryLength, setSummaryLength] = useState(0)
  const [kind, setKind] = useState('درس‌پژوهی')
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (fileError) return
    const data = new FormData(event.currentTarget)
    const summary = String(data.get('summary')).trim()
    if (summary.length < 30) {
      notify('خلاصه تجربه را دست‌کم در ۳۰ نویسه بنویسید.')
      return
    }
    const entry: Experience = {
      id: `DK-${crypto.randomUUID().split('-')[0].toUpperCase()}`,
      name: String(data.get('name')).trim(),
      school: String(data.get('school')).trim(),
      province: String(data.get('province')),
      email: String(data.get('email')).trim(),
      kind,
      title: String(data.get('title')).trim(),
      summary,
      fileName: file?.name || '',
      savedAt: new Date().toISOString(),
    }
    saveExperience(entry)
    setReceipt(entry)
  }
  if (receipt)
    return (
      <>
        <ModalEyebrow>یک قدم برای هم‌آموزی</ModalEyebrow>
        <DialogTitle>روایت شما، یک شروع ارزشمند است.</DialogTitle>
        <DialogDescription>
          پیش‌نویس تجربه در همین مرورگر ذخیره شد؛ هنوز به دبیرخانه ارسال نشده است.
        </DialogDescription>
        <div className="success-state">
          <span className="success-check">
            <CheckCircle2 size={40} strokeWidth={1.1} />
          </span>
          <h3>{receipt.title}</h3>
          <p>شناسه پیش‌نویس محلی</p>
          <strong dir="ltr" className="tracking-code">
            {receipt.id}
          </strong>
          <div className="info-note">
            <Info size={17} />
            <p>
              در نسخه نمایشی، سروری برای دریافت تجربه‌ها وجود ندارد. نام فایل پیوست ثبت شده، اما محتوای فایل
              بارگذاری یا ذخیره نشده است.
            </p>
          </div>
        </div>
        <div className="modal-action-bar">
          <Button onClick={() => setModal({ type: 'dashboard' })}>
            مشاهده پیشخوان من
            <ArrowLeft size={17} />
          </Button>
          <Button variant="outline" onClick={() => receiptDownload(receipt)}>
            <Download size={16} />
            دریافت نسخه پیش‌نویس
          </Button>
        </div>
      </>
    )
  return (
    <>
      <ModalEyebrow>هر تجربه، فرصتی برای آموختن</ModalEyebrow>
      <DialogTitle>روایتِ کلاس شما را می‌شنویم.</DialogTitle>
      <DialogDescription>یک پرسش، یک مشاهده یا یک تغییر کوچک؛ از تجربه خودتان بنویسید.</DialogDescription>
      <div className="info-note form-demo-note">
        <Info size={17} />
        <p>
          این فرم نمایشی است. اطلاعات فقط در همین مرورگر ذخیره می‌شود و ارسال رسمی به دبیرخانه انجام نمی‌شود.
        </p>
      </div>
      <form className="experience-form" onSubmit={submit}>
        <fieldset className="kind-fieldset">
          <legend>نوع تجربه</legend>
          <div>
            {['درس‌پژوهی', 'درس‌کاوی'].map((value) => (
              <label className={kind === value ? 'chosen' : ''} key={value}>
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={kind === value}
                  onChange={() => setKind(value)}
                />
                <span>
                  {value === 'درس‌پژوهی' ? <UsersRound size={18} /> : <Search size={18} />}
                  {value}
                </span>
                <Check size={15} />
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label>
            نام و نام خانوادگی <span>*</span>
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="نام شما"
              autoComplete="name"
            />
          </label>
          <label>
            مدرسه یا محل خدمت <span>*</span>
            <input
              name="school"
              required
              minLength={2}
              maxLength={120}
              placeholder="نام مدرسه یا مرکز آموزشی"
            />
          </label>
          <label>
            استان <span>*</span>
            <select name="province" required defaultValue="">
              <option value="" disabled>
                استان را انتخاب کنید
              </option>
              {provinces.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </label>
          <label>
            ایمیل <small>(اختیاری)</small>
            <input
              name="email"
              type="email"
              maxLength={160}
              placeholder="you@example.com"
              dir="ltr"
              autoComplete="email"
            />
          </label>
        </div>
        <label className="full-field">
          عنوان تجربه <span>*</span>
          <input
            name="title"
            required
            minLength={5}
            maxLength={140}
            placeholder="مثلاً: چگونه گفت‌وگوی دانش‌آموزان را در حل مسئله بیشتر کردیم؟"
          />
        </label>
        <label className="full-field">
          خلاصه تجربه <span>*</span>
          <textarea
            name="summary"
            required
            minLength={30}
            maxLength={1500}
            rows={4}
            onChange={(event) => setSummaryLength(event.target.value.length)}
            placeholder="پرسش شما چه بود؟ چه کاری انجام دادید؟ چه شواهدی دیدید و چه آموختید؟"
          />
          <span className="field-bottom">
            <small>لطفاً نام و اطلاعات شخصی دانش‌آموزان را ننویسید.</small>
            <small>{toFa(summaryLength)} / ۱۵۰۰</small>
          </span>
        </label>
        <label className={`file-upload ${file ? 'has-file' : ''}`}>
          <input
            type="file"
            name="attachment"
            accept=".pdf,.docx"
            aria-label="انتخاب فایل پیوست اختیاری"
            onChange={(event) => {
              const selected = event.target.files?.[0]
              setFileError('')
              if (!selected) {
                setFile(null)
                return
              }
              if (!/\.(pdf|docx)$/i.test(selected.name)) {
                setFileError('فقط فایل PDF یا DOCX مجاز است.')
                setFile(null)
                event.target.value = ''
                return
              }
              if (selected.size > 10 * 1024 * 1024) {
                setFileError('حجم فایل نباید بیشتر از ۱۰ مگابایت باشد.')
                setFile(null)
                event.target.value = ''
                return
              }
              setFile(selected)
            }}
          />
          {file ? <FileCheck2 size={26} strokeWidth={1.3} /> : <UploadCloud size={26} strokeWidth={1.3} />}
          <span>
            <strong>{file ? file.name : 'پیوست تجربه (اختیاری)'}</strong>
            <small>PDF یا DOCX، حداکثر ۱۰ مگابایت · در پیش‌نمایش فقط نام فایل ذخیره می‌شود.</small>
          </span>
          <span className="file-select-label">انتخاب فایل</span>
        </label>
        {fileError && (
          <p className="form-error" role="alert">
            {fileError}
          </p>
        )}
        <label className="consent-label">
          <input type="checkbox" required name="consent" />
          <span>از رعایت حریم خصوصی دانش‌آموزان اطمینان دارم و با ذخیره محلی این پیش‌نویس موافقم.</span>
        </label>
        <div className="modal-action-bar">
          <Button type="submit" disabled={!!fileError}>
            ذخیره پیش‌نویس تجربه
            <ArrowLeft size={17} />
          </Button>
          <Button variant="ghost" type="button" onClick={() => setModal(null)}>
            فعلاً نه
          </Button>
        </div>
      </form>
    </>
  )
}

function Dashboard({
  experiences,
  bookmarks,
  reminders,
  removeExperience,
  setModal,
  toggleBookmark,
  toggleReminder,
}: Pick<
  Props,
  | 'experiences'
  | 'bookmarks'
  | 'reminders'
  | 'removeExperience'
  | 'setModal'
  | 'toggleBookmark'
  | 'toggleReminder'
>) {
  const [confirmDelete, setConfirmDelete] = useState('')
  return (
    <>
      <ModalEyebrow>فضای شخصیِ یادگیری شما</ModalEyebrow>
      <DialogTitle>سلام، همراهِ یادگیری.</DialogTitle>
      <DialogDescription>پیش‌نویس‌ها، منابع نشان‌شده و قرارهای بعدی‌تان، یک‌جا کنار هم.</DialogDescription>
      <div className="dashboard-notice">
        <Info size={17} />
        <span>این پیشخوان حساب آنلاین نیست و فقط به داده‌های همین مرورگر دسترسی دارد.</span>
      </div>
      <Tabs.Root defaultValue="experiences" dir="rtl">
        <Tabs.List className="tabs-list dashboard-tabs" aria-label="بخش‌های پیشخوان">
          <Tabs.Trigger value="experiences">
            تجربه‌های من <span>{toFa(experiences.length)}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="saved">
            نشان‌شده‌ها <span>{toFa(bookmarks.length)}</span>
          </Tabs.Trigger>
          <Tabs.Trigger value="events">
            یادآورها <span>{toFa(reminders.length)}</span>
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="experiences" className="tabs-content">
          {experiences.length ? (
            <>
              <div className="dashboard-section-heading">
                <h3>پیش‌نویس‌های محلی</h3>
                <button className="text-link" onClick={() => setModal({ type: 'submit' })}>
                  <Plus size={15} />
                  تجربه تازه
                </button>
              </div>
              <div className="draft-list">
                {experiences.map((entry) => (
                  <div className="draft-card" key={entry.id}>
                    <div className="draft-head">
                      <span className="category-label label-sage">{entry.kind}</span>
                      <span className="draft-status">
                        <span />
                        پیش‌نویس محلی
                      </span>
                    </div>
                    <h3>{entry.title}</h3>
                    <p>
                      {entry.name} · {entry.school} · {entry.province}
                    </p>
                    <details>
                      <summary>
                        مشاهده خلاصه تجربه
                        <ChevronLeft size={14} />
                      </summary>
                      <p>{entry.summary}</p>
                      {entry.fileName && <small>نام پیوست: {entry.fileName} (فایل بارگذاری نشده است)</small>}
                    </details>
                    <div className="draft-footer">
                      <span dir="ltr">{entry.id}</span>
                      <button
                        onClick={() => receiptDownload(entry)}
                        aria-label={`دریافت پیش‌نویس ${entry.title}`}
                      >
                        <Download size={16} />
                      </button>
                      {confirmDelete === entry.id ? (
                        <>
                          <button
                            className="delete-confirm"
                            onClick={() => {
                              removeExperience(entry.id)
                              setConfirmDelete('')
                            }}
                          >
                            حذف شود
                          </button>
                          <button onClick={() => setConfirmDelete('')}>انصراف</button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(entry.id)}
                          aria-label={`حذف پیش‌نویس ${entry.title}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="هر تجربه، از یک قدم شروع می‌شود."
              text="هنوز پیش‌نویسی ندارید. اولین روایت کلاس‌تان را اینجا بنویسید."
              action={
                <Button onClick={() => setModal({ type: 'submit' })}>
                  <Plus size={16} />
                  نوشتن اولین تجربه
                </Button>
              }
            />
          )}
        </Tabs.Content>
        <Tabs.Content value="saved" className="tabs-content">
          {bookmarks.length ? (
            <div className="saved-list">
              {resources
                .filter((resource) => bookmarks.includes(resource.id))
                .map((resource) => (
                  <div className="saved-resource" key={resource.id}>
                    <span className={`saved-resource-icon art-${resource.color}`}>
                      <BookOpen size={22} strokeWidth={1.3} />
                    </span>
                    <button onClick={() => setModal({ type: 'resource', id: resource.id })}>
                      <strong>{resource.title}</strong>
                      <small>
                        {resource.category} · {toFa(resource.pages)} صفحه
                      </small>
                    </button>
                    <button
                      className="unsave"
                      onClick={() => toggleBookmark(resource.id)}
                      aria-label={`حذف نشان ${resource.title}`}
                    >
                      <Bookmark size={17} fill="currentColor" />
                    </button>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyState
              title="منبع خوب را برای بعد نگه دارید."
              text="با انتخاب نشان کنار هر منبع، آن را به این فهرست اضافه کنید."
              action={
                <Button onClick={() => setModal({ type: 'library' })}>
                  رفتن به کتابخانه
                  <ArrowLeft size={16} />
                </Button>
              }
            />
          )}
        </Tabs.Content>
        <Tabs.Content value="events" className="tabs-content">
          {reminders.length ? (
            <div className="saved-list">
              {events
                .filter((event) => reminders.includes(event.id))
                .map((event) => (
                  <div className="saved-resource" key={event.id}>
                    <span className="event-date">
                      <strong>{event.day}</strong>
                      <small>{event.month}</small>
                    </span>
                    <button onClick={() => setModal({ type: 'event', id: event.id })}>
                      <strong>{event.title}</strong>
                      <small>{event.type} · رویداد نمونه</small>
                    </button>
                    <button
                      className="unsave"
                      onClick={() => toggleReminder(event.id)}
                      aria-label={`حذف یادآور ${event.title}`}
                    >
                      <X size={17} />
                    </button>
                  </div>
                ))}
              <p className="modal-footnote">
                یادآورها فقط در این فهرست نمایش داده می‌شوند و اعلان خودکار ندارند.
              </p>
            </div>
          ) : (
            <EmptyState
              title="قرار بعدیِ یادگیری را پیدا کنید."
              text="یادآور یک رویداد را ذخیره کنید تا به این فهرست اضافه شود."
              action={
                <Button onClick={() => setModal({ type: 'event', id: events[0].id })}>
                  <CalendarDays size={16} />
                  دیدن یک قرار تازه
                </Button>
              }
            />
          )}
        </Tabs.Content>
      </Tabs.Root>
    </>
  )
}

function EventDetail({
  event,
  saved,
  toggleReminder,
}: {
  event: LearningEvent
  saved: boolean
  toggleReminder: () => void
}) {
  const downloadCalendar = () => {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z/, 'Z')
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lesson Study Demo//FA',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:demo-${event.id}@lesson-study.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${event.start}`,
      `DTEND:${event.end}`,
      `SUMMARY:[نمونه] ${event.title}`,
      'DESCRIPTION:رویداد نمایشی دبیرخانه؛ ثبت‌نام یا لینک برگزاری واقعی ندارد.',
      'LOCATION:آنلاین - رویداد نمونه',
      'STATUS:TENTATIVE',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    downloadFile(content, `demo-${event.id}.ics`, 'text/calendar;charset=utf-8')
  }
  return (
    <>
      <ModalEyebrow>یک قرار برای هم‌آموزی · نمونه</ModalEyebrow>
      <DialogTitle>{event.title}</DialogTitle>
      <DialogDescription>{event.type} · ویژه معلمان و گروه‌های یادگیری</DialogDescription>
      <div className="event-detail-banner">
        <span className="event-date">
          <strong>{event.day}</strong>
          <small>
            {event.month} {event.year}
          </small>
        </span>
        <div>
          <strong>زمانی برای دقیق‌تر دیدن</strong>
          <span>
            <Clock3 size={15} />
            ساعت {event.time}، به وقت ایران
          </span>
          <span>
            <MapPin size={15} />
            آنلاین
          </span>
        </div>
        <UsersRound size={56} strokeWidth={0.8} />
      </div>
      <p className="event-description">{event.description}</p>
      <div className="info-note">
        <Info size={17} />
        <p>
          اطلاعات این رویداد، نمونه نمایشی است. افزودن به پیشخوان یا تقویم به معنای ثبت‌نام نیست و پیوند
          برگزاری واقعی ارائه نمی‌شود.
        </p>
      </div>
      <div className="modal-action-bar">
        <Button onClick={toggleReminder}>
          {saved ? <Check size={17} /> : <CalendarDays size={17} />}
          {saved ? 'حذف از یادآورهای من' : 'یادآوری در پیشخوان من'}
        </Button>
        <Button variant="outline" onClick={downloadCalendar}>
          <Download size={16} />
          افزودن به تقویم
        </Button>
      </div>
    </>
  )
}

function ArticleDetail({ story, setModal }: { story: Story; setModal: Props['setModal'] }) {
  return (
    <>
      <ModalEyebrow>{story.category}</ModalEyebrow>
      <DialogTitle>{story.title}</DialogTitle>
      <DialogDescription>
        {story.date} · {story.readTime} مطالعه · روایت آموزشیِ نمونه
      </DialogDescription>
      <img className="article-hero" src={story.image} alt="فضای یادگیری و گفت‌وگوی آموزشی" />
      <div className="article-body">
        <p className="article-lead">{story.excerpt}</p>
        {story.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      <div className="article-related">
        <span>
          <BookOpen size={23} />
          <span>
            <small>قدم بعدیِ این روایت</small>
            <strong>راهنمای شروع درس‌پژوهی را بخوانید.</strong>
          </span>
        </span>
        <button
          onClick={() => setModal({ type: 'resource', id: 'lesson-study-starter' })}
          aria-label="مشاهده راهنمای شروع درس‌پژوهی"
        >
          <ArrowLeft size={21} />
        </button>
      </div>
      <div className="modal-action-bar">
        <Button
          variant="outline"
          onClick={() =>
            downloadFile(
              `${story.title}\n\n${story.paragraphs.join('\n\n')}\n\nروایت آموزشی تألیفی برای نسخه نمایشی دبیرخانه.`,
              `${story.id}.txt`,
            )
          }
        >
          <Download size={16} />
          دریافت متن یادداشت
        </Button>
      </div>
    </>
  )
}

function FAQ({ setModal }: Pick<Props, 'setModal'>) {
  const items = [
    [
      'برای شروع درس‌پژوهی به چه چیزهایی نیاز داریم؟',
      'یک گروه کوچک از همکاران، یک پرسش مشخص درباره یادگیری دانش‌آموزان و زمانی مشترک برای طراحی، مشاهده و گفت‌وگو. لازم نیست از همان ابتدا، طرحی پیچیده یا گزارشی بلند داشته باشید.',
    ],
    [
      'تفاوت درس‌پژوهی و درس‌کاوی چیست؟',
      'درس‌پژوهی معمولاً یک چرخه مشارکتیِ طراحی، اجرای درس پژوهشی، مشاهده و بازاندیشی است. درس‌کاوی بر مطالعه و فهم دقیق یک موقعیت یا رخداد کلاس و ساختن تبیین و پیشنهاد برای بهبود تمرکز می‌کند.',
    ],
    [
      'آیا منابع این سایت رایگان است؟',
      'بله، همه راهنماهای موجود در این نسخه رایگان و قابل دریافت هستند. این منابع آموزشیِ تألیفی، نمونه محتوای سایت‌اند و جایگزین شیوه‌نامه رسمی نیستند.',
    ],
    [
      'تجربه‌ای که ثبت می‌کنم کجا ذخیره می‌شود؟',
      'در این پیش‌نمایش، اطلاعات فقط در حافظه محلی همین مرورگر ذخیره می‌شود. سروری برای دریافت اطلاعات، ورود کاربران یا ارسال رسمی وجود ندارد. با پاک‌کردن داده‌های مرورگر، پیش‌نویس‌ها حذف می‌شوند؛ می‌توانید یک نسخه JSON از آن‌ها دریافت کنید.',
    ],
    [
      'فایل پیوست و حریم خصوصی چگونه مدیریت می‌شود؟',
      'در نسخه نمایشی، فقط نام فایل پیوست نگه داشته می‌شود و خود فایل بارگذاری نمی‌شود. در متن تجربه، از نام، تصویر و اطلاعات شخصی دانش‌آموزان استفاده نکنید.',
    ],
    [
      'آیا رویدادها و خبرنامه واقعاً فعال‌اند؟',
      'رویدادهای نمایش‌داده‌شده نمونه‌اند و ثبت‌نام رسمی ندارند. یادآور فقط در پیشخوان محلی دیده می‌شود. ایمیل خبرنامه نیز محلی ذخیره می‌شود و پیامی ارسال نخواهد شد.',
    ],
  ]
  return (
    <>
      <ModalEyebrow>کنار شما، در هر قدم</ModalEyebrow>
      <DialogTitle>پرسش‌های کوچک، پاسخ‌های روشن.</DialogTitle>
      <DialogDescription>چند نکته برای شروعِ مسیر و استفاده از این پیش‌نمایش.</DialogDescription>
      <div className="faq-list">
        {items.map(([question, answer], index) => (
          <details key={question} open={index === 0}>
            <summary>
              {question}
              <Plus size={17} />
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <div className="faq-bottom">
        <Bird size={26} strokeWidth={1.2} />
        <p>برای قدم اول، یک راهنمای کوتاه کنار شماست.</p>
        <button className="text-link" onClick={() => setModal({ type: 'library' })}>
          رفتن به کتابخانه
          <ArrowLeft size={16} />
        </button>
      </div>
    </>
  )
}

export function SiteDialogs(props: Props) {
  const { modal, setModal } = props
  const resource = modal?.type === 'resource' ? resources.find((item) => item.id === modal.id) : undefined
  const story = modal?.type === 'article' ? stories.find((item) => item.id === modal.id) : undefined
  const event = modal?.type === 'event' ? events.find((item) => item.id === modal.id) : undefined
  const wide =
    modal?.type === 'library'
      ? 'dialog-wide'
      : modal?.type === 'submit' || modal?.type === 'dashboard'
        ? 'dialog-form'
        : modal?.type === 'article'
          ? 'dialog-article'
          : ''
  return (
    <Dialog
      open={modal !== null}
      onOpenChange={(open) => {
        if (!open) setModal(null)
      }}
    >
      <DialogContent
        className={wide}
        key={modal ? `${modal.type}${'id' in modal ? modal.id : ''}` : 'closed'}
      >
        {modal?.type === 'search' && <SearchDialog setModal={setModal} />}
        {modal?.type === 'library' && <Library {...props} />}
        {modal?.type === 'about' && <AboutDialog setModal={setModal} />}
        {modal?.type === 'submit' && <ExperienceForm {...props} />}
        {modal?.type === 'dashboard' && <Dashboard {...props} />}
        {modal?.type === 'faq' && <FAQ setModal={setModal} />}
        {resource && (
          <ResourceDetail
            resource={resource}
            saved={props.bookmarks.includes(resource.id)}
            toggleSave={() => props.toggleBookmark(resource.id)}
          />
        )}
        {story && <ArticleDetail story={story} setModal={setModal} />}
        {event && (
          <EventDetail
            event={event}
            saved={props.reminders.includes(event.id)}
            toggleReminder={() => props.toggleReminder(event.id)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
