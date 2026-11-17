export interface HubBox {
  id: 'webinars' | 'in-person' | 'circulars' | 'campaign' | 'lived-experiences' | 'clinical-supervision' | 'content-production'
  title: string
  badge: string
  tagline: string
  description: string
  accentColor: string
  glowColor: string
  iconName: string
  docHighlights: string[]
}

export const hubBoxes: HubBox[] = [
  {
    id: 'webinars',
    title: 'وبینارهای آموزشی دبیرخانه',
    badge: 'برخط و تعاملی',
    tagline: 'هم‌آموزی مجازی با استادان کشوری',
    description: 'کارگاه‌های تخصصی برخط درس‌پژوهی به همراه دسترسی کامل به پوستر، بسته محتوا، ویدئوی ضبط‌شده و اکسل حاضران.',
    accentColor: '#38b3f9',
    glowColor: 'rgba(56, 179, 249, 0.25)',
    iconName: 'Video',
    docHighlights: ['پوستر باکیفیت', 'بسته محتوا', 'لینک ضبط‌شده', 'فایل اکسل حاضران'],
  },
  {
    id: 'in-person',
    title: 'نشست‌های حضوری',
    badge: 'استانی و منطقه‌ای',
    tagline: 'دیدار و گفت‌وگو در حلقه‌های یادگیری',
    description: 'گردهمایی‌های علمی و همایش‌های قطبی درس‌پژوهی همراه با پوستر رویداد، بخشنامه اعزام، محتوای کارگاه و گزارش تصویری.',
    accentColor: '#85b50b',
    glowColor: 'rgba(133, 181, 11, 0.25)',
    iconName: 'UsersRound',
    docHighlights: ['پوستر رسمی', 'بخشنامه (اختیاری)', 'محتوای کارگاه', 'گزارش تصویری'],
  },
  {
    id: 'circulars',
    title: 'بخشنامه‌ها و فراخوان‌ها',
    badge: 'اسناد و ابلاغیه‌ها',
    tagline: 'شیوه‌نامه‌ها و دستورالعمل‌های رسمی',
    description: 'مرجع رسمی دریافت فایل پی‌دی‌اف (PDF) کلیه بخشنامه‌ها، شیوه‌نامه‌های اجرایی و فراخوان‌های کشوری با مهر و شماره معتبر.',
    accentColor: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.25)',
    iconName: 'ScrollText',
    docHighlights: ['فایل پی‌دی‌اف بخشنامه‌ها', 'فایل پی‌دی‌اف فراخوان‌ها', 'شیوه‌نامه‌های رسمی'],
  },
  {
    id: 'campaign',
    title: 'کمپین ما باهم می‌آموزیم',
    badge: 'پویش ملی معلمان',
    tagline: 'پیوند سراسری برای تحول در کلاس درس',
    description: 'پویش ملی همبستگی معلمان به همراه بانک و فایل اکسل تفکیک‌شده مشخصات تیم‌های فعال درس‌پژوهی استان‌های سراسر کشور.',
    accentColor: '#f37023',
    glowColor: 'rgba(243, 112, 35, 0.3)',
    iconName: 'Sparkles',
    docHighlights: ['فایل اکسل مشخصات تیم‌های استان', 'پویش ملی معلمان', 'ثبت عهدنامه'],
  },
  {
    id: 'lived-experiences',
    title: 'فراخوان تجارب زیسته',
    badge: 'روایت معلمان',
    tagline: 'ثبت و انتشار داستان‌های واقعی کلاس',
    description: 'دریافت مستقیم فایل ورد (DOCX) و پی‌دی‌اف (PDF) آثار منتخب استان‌ها و سامانه بارگذاری تجارب معلمان در قالب ورد و پی‌دی‌اف.',
    accentColor: '#d5187c',
    glowColor: 'rgba(213, 24, 124, 0.25)',
    iconName: 'BookOpenCheck',
    docHighlights: ['فایل ورد (DOCX) آثار منتخب', 'فایل پی‌دی‌اف (PDF) آثار منتخب', 'بارگذاری تجربه'],
  },
  {
    id: 'clinical-supervision',
    title: 'نظارت بالینی',
    badge: 'مشاهده و بازخورد حمایتی',
    tagline: 'رویکرد غیرقضاوتی در هدایت آموزشی',
    description: 'فرم پر شده نظارت بالینی ویژه راهبران درس‌پژوهی، گزارش تصویری مستند از بازدیدهای کلاسی و فایل مکتوب ارائه بازخورد به تیم‌ها.',
    accentColor: '#0ea5e9',
    glowColor: 'rgba(14, 165, 233, 0.25)',
    iconName: 'ScanEye',
    docHighlights: ['فرم پر شده نظارت بالینی', 'گزارش تصویری از بازدید', 'فایل ارائه بازخورد به تیم‌ها'],
  },
  {
    id: 'content-production',
    title: 'تولید محتوا',
    badge: 'رسانه و ابزارها',
    tagline: 'استانداردها و درگاه ارسال آثار',
    description: 'مجموعه عکس‌های مستند، اینفوگرافیک‌ها، لینک ویدیوهای ابری و فایل‌های آموزشی کامل درس‌پژوهی در ۳ قالب ورد، پی‌دی‌اف و پاورپوینت.',
    accentColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.25)',
    iconName: 'Film',
    docHighlights: ['عکس و گزارش تصویری', 'اینفوگراف', 'لینک ویدیوهای ابری', 'فایل‌های ورد، PDF و PPT'],
  },
]

export interface ClinicalItemData {
  id: string
  title: string
  role: string
  description: string
  pdfUrl?: string
  pdfFileName?: string
  docxUrl?: string
  docxFileName?: string
  reportUrl?: string
  date?: string
}

export const defaultClinicalItems: ClinicalItemData[] = []

export interface WebinarContentFile {
  id: string
  title: string
  url: string
  downloadUrl?: string
  fileName: string
  fileType: 'pdf' | 'pptx' | 'ppt' | 'docx' | 'other'
  fileSize?: string
}

export interface PrivateBlobReference {
  access: 'private'
  pathname: string
  contentType?: string
}

export type StoredPrivateFile = string | PrivateBlobReference

export interface WebinarAttendee {
  id: string
  fullName: string
  province: string
  personnelCode?: string
  district?: string
  nationalId?: string
  duration?: string | number
  certificateImageUrl?: StoredPrivateFile
  certificateFileName?: string
}

export interface WebinarItem {
  id: string
  title: string
  speaker: string
  role: string
  date: string
  time: string
  status: 'upcoming' | 'recorded'
  platform: string
  capacity: string
  description: string
  posterUrl: string
  /** Public join link for an upcoming webinar. */
  meetingUrl?: string
  /** Registration window dates/times are Jalali and Tehran local time. */
  attendanceStartDate?: string
  attendanceStartTime?: string
  attendanceEndDate?: string
  attendanceEndTime?: string
  contentUrl: string
  recordedVideoUrl: string
  attendeesExcelUrl?: StoredPrivateFile
  attendeesCount?: number
  posterFileName?: string
  contentFileName?: string
  attendeesFileName?: string
  // Multiple presentation files support
  contentFiles?: WebinarContentFile[]
  // Parsed attendees for search, filter & certificates
  attendeesList?: WebinarAttendee[]
  // Legacy private upload references; the certificate UI now uses a fixed sanitized template.
  certificateTemplateUrl?: string
  certificateTemplateFileName?: string
  certificateDocxTemplateUrl?: StoredPrivateFile
  certificateDocxFileName?: string
  // Certificate metadata for the fixed private template
  certificateIssueDate?: string
  certificateLetterNumber?: string
  // Legacy upload fields are kept for stored records but are no longer used by the UI.
  certificatesPdfUrl?: string
  certificatesPdfFileName?: string
  certificatesCount?: number
}

export const webinarsData: WebinarItem[] = []

export interface InPersonEvent {
  id: string
  province: string
  city: string
  title: string
  venue: string
  date: string
  capacity: string
  organizer: string
  status: 'open' | 'completed'
  posterUrl: string
  circularUrl?: string // بخشنامه (اختیاری)
  contentUrl: string
  photos: { title: string; url: string }[]
}

export const inPersonEventsData: InPersonEvent[] = []

export interface CircularItem {
  id: string
  number: string
  date: string
  title: string
  authority: string
  category: 'شیوه‌نامه' | 'بخشنامه' | 'فراخوان' | 'تقویم اجرایی'
  summary: string
  pdfFile: string
  pdfFileName?: string
  pdfDownloadUrl?: string
}

export const circularsData: CircularItem[] = []

export interface CampaignPublicFile {
  url: string
  downloadUrl?: string
  fileName: string
}

export interface ProvinceTeamsData {
  province: string
  provinceCode: string
  excelUrl: string
  teamCount: number
  sampleTeams: {
    code: string
    area: string
    school: string
    grade: string
    subject: string
    leader: string
    membersCount: number
  }[]
}

export const provinceTeamsList: ProvinceTeamsData[] = []

export interface NarrativeSample {
  id: string
  title: string
  author: string
  school: string
  province: string
  grade: string
  subject: string
  summary: string
  date: string
  docxUrl: string
  pdfUrl: string
}

export const sampleNarratives: NarrativeSample[] = []

export interface ClinicalStep {
  step: number
  title: string
  timing: string
  aim: string
  actions: string[]
  tools: string
}

export const clinicalSteps: ClinicalStep[] = []

export interface ContentMediaItem {
  id: string
  title: string
  category: 'عکس' | 'اینفوگراف' | 'ویدیو ابری' | 'فایل آموزشی'
  description: string
  downloadUrl?: string
  viewUrl?: string
  badgeText: string
  fileType: 'jpg' | 'png' | 'pdf' | 'docx' | 'pptx' | 'cloud-link'
}

export const contentMediaItems: ContentMediaItem[] = []

export const defaultHomepageSettings = {
  siteTitle: 'دبیرخانه کشوری درس پژوهی و درس کاوی',
  sectionTitle: 'برای ورود و مشارکت، بخش مورد نظر را انتخاب کنید',
  footerTagline: 'با هم، برای یادگیری • یادگیری یک پرواز جمعی‌ست',
  hubBoxes: hubBoxes,
  webinars: [],
  inPersonEvents: [],
  circulars: [],
  provinceTeams: [],
  narratives: [],
  contentMedia: [],
  clinicalItems: [],
}

export type ResourceCategory = 'درس‌پژوهی' | 'درس‌کاوی' | 'فرم‌ها و الگوها'
export interface Resource {
  id: string
  title: string
  subtitle: string
  category: ResourceCategory
  pages: number
  color: 'sage' | 'blue' | 'sand'
  art: 'cycle' | 'observe' | 'plan'
  description: string
  points: string[]
}

export const resources: Resource[] = [
  {
    id: 'lesson-study-starter',
    title: 'درس‌پژوهی؛ از پرسش تا بازاندیشی',
    subtitle: 'اولین قدم را، با هم برداریم.',
    category: 'درس‌پژوهی',
    pages: 3,
    color: 'sage',
    art: 'cycle',
    description: 'راهنمای نخستین چرخه درس‌پژوهی با تمرکز بر یادگیری دانش‌آموز.',
    points: ['پرسش پژوهشی گروه', 'طراحی مشارکتی', 'ثبت شواهد'],
  },
  {
    id: 'observation-guide',
    title: 'مشاهده کلاس، با نگاهی یادگیرنده',
    subtitle: 'دیدن، آغازِ فهمیدن است.',
    category: 'درس‌کاوی',
    pages: 3,
    color: 'blue',
    art: 'observe',
    description: 'روش‌های ثبت شواهد عینی و تفکیک مشاهده از تفسیر.',
    points: ['تفاوت مشاهده و تفسیر', 'ثبت راهبردها', 'نشست پس از تدریس'],
  },
  {
    id: 'lesson-design-template',
    title: 'الگوی طراحی و ثبت یک درس پژوهشی',
    subtitle: 'برای ایده‌هایی که قرار است اثر بگذارند.',
    category: 'فرم‌ها و الگوها',
    pages: 3,
    color: 'sand',
    art: 'plan',
    description: 'فرم‌های ثبت اهداف، فعالیت‌ها و بازطراحی درس.',
    points: ['هدف گروه', 'جدول شواهد', 'برگه بازاندیشی'],
  },
]

export interface Story {
  id: string
  category: string
  title: string
  excerpt: string
  image: string
  date: string
  readTime: string
  paragraphs: string[]
}
export const stories: Story[] = []

export const events = [
  {
    id: 'first-step',
    day: '۱۸',
    month: 'آبان',
    year: '۱۴۰۵',
    title: 'اولین گام‌های یک گروه درس‌پژوهی',
    type: 'کارگاه آنلاین',
    time: '۱۶:۰۰ تا ۱۷:۳۰',
    start: '20261109T123000Z',
    end: '20261109T140000Z',
    description: 'کارگاه تعاملی صورت‌بندی پرسش پژوهشی.',
  },
]

export type LearningEvent = (typeof events)[number]
export const categories = ['همه منابع', 'درس‌پژوهی', 'درس‌کاوی', 'فرم‌ها و الگوها'] as const

export function normalize(text: string) {
  return text.replace(/ي/g, 'ی').replace(/ك/g, 'ک')
}

export function toFa(num: number | string): string {
  const faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(num).replace(/\d/g, (d) => faDigits[Number(d)] ?? d)
}
