import React, { useState } from 'react'
import {
  ShieldAlert,
  Save,
  RotateCcw,
  Download,
  Upload,
  LayoutGrid,
  Video,
  UsersRound,
  ScrollText,
  Sparkles,
  BookOpenCheck,
  ScanEye,
  Film,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  ChevronLeft,
  X,
  Database,
  FileSpreadsheet,
  Layers,
  Image as ImageIcon,
  FileText,
  UploadCloud,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  Award,
  FileStack,
} from 'lucide-react'
import type {
  HomepageSettings,
  ClinicalItemData,
  CampaignPledge,
  ProvinceContentRecord,
} from '@/src/types'
import {
  defaultHomepageSettings,
  type HubBox,
  type WebinarItem,
  type WebinarContentFile,
  type InPersonEvent,
  type CircularItem,
  type ProvinceTeamsData,
  type NarrativeSample,
  type ContentMediaItem,
} from '@/src/data'
import { verifyAdminPassword, uploadToBlob, checkBackendStatus, fetchServerSettings, MAX_BLOB_UPLOAD_BYTES, type BackendStatus } from '@/lib/api-client'
import { CAMPAIGN_FILE_ACCEPT, CAMPAIGN_MAX_UPLOAD_BYTES, campaignFileList, campaignFileType } from '@/lib/campaign-files'
import { convertImageFileToWebp } from '@/lib/image-utils'
import { parseAttendanceExcel } from '@/lib/excel-parser'
import { ExperienceInbox } from './experience-inbox'
import { InPersonRegistrations } from './in-person-registrations'
import { WebinarAttendanceDialog } from './webinar-attendance-dialog'
import { ProvinceAccountsPanel } from './province-accounts-panel'
import { ProvinceContentMonitor } from './province-content-monitor'
import { JalaliDateInput } from '@/components/ui/jalali-date-input'
import { getWebinarRegistrationWindow } from '@/lib/webinar-registration-time'
import { sortByJalaliDateNewestFirst } from '@/lib/jalali-date'

interface AdminPageProps {
  settings: HomepageSettings
  onSaveSettings: (newSettings: HomepageSettings) => Promise<boolean>
  onNavigateHome: () => void
  onProvinceReviewChanged: (item: ProvinceContentRecord) => void
  notify: (msg: string) => void
}

type AdminTab =
  | 'boxes'
  | 'webinars'
  | 'inperson'
  | 'circulars'
  | 'campaign'
  | 'experiences'
  | 'supervision'
  | 'content'
  | 'backup'
  | 'accounts'
  | 'province-monitor'

interface ContentSubmission {
  id: string
  fullName: string
  nationalCode: string
  personnelCode: string
  province: string
  district: string
  grade: string
  phone: string
  email: string
  contentType: string
  title: string
  mediaLink: string
  description: string
  createdAt: string
}

const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('فایل به رشته Data URL تبدیل نشد.'))
  reader.onerror = () => reject(reader.error || new Error('خواندن فایل ناموفق بود.'))
  reader.readAsDataURL(file)
})

const formatPledgeDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('fa-IR')
}

// Modern curated luxury dusk palette swatches
const MODERN_PALETTES = [
  { name: 'نیلی آسمانی مدرن', accent: '#38bdf8', glow: 'rgba(56, 189, 248, 0.28)' },
  { name: 'سبز زمردی نئونی', accent: '#10b981', glow: 'rgba(16, 185, 129, 0.28)' },
  { name: 'بنفش سلطنتی شفق', accent: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.28)' },
  { name: 'نارنجی کهربایی داسک', accent: '#f97316', glow: 'rgba(249, 115, 22, 0.30)' },
  { name: 'رز سرخابی مجلل', accent: '#ec4899', glow: 'rgba(236, 72, 153, 0.28)' },
  { name: 'طلایی لوکس پاییزی', accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.28)' },
  { name: 'فیروزه‌ای پرتو', accent: '#06b6d4', glow: 'rgba(6, 182, 212, 0.28)' },
  { name: 'یاقوتی مرجانی', accent: '#f43f5e', glow: 'rgba(244, 63, 94, 0.28)' },
  { name: 'لاجوردی عمیق', accent: '#6366f1', glow: 'rgba(99, 102, 241, 0.28)' },
  { name: 'سبز لیمویی نوگرا', accent: '#84cc16', glow: 'rgba(132, 204, 22, 0.28)' },
]

export const AdminPage: React.FC<AdminPageProps> = ({
  settings,
  onSaveSettings,
  onNavigateHome,
  onProvinceReviewChanged,
  notify,
}) => {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false)
  const [adminSettingsLoadError, setAdminSettingsLoadError] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  // Active Admin View Tab
  const [activeTab, setActiveTab] = useState<AdminTab>('boxes')
  const [selectedBoxIndex, setSelectedBoxIndex] = useState(0)
  const [campaignPledges, setCampaignPledges] = useState<CampaignPledge[]>([])
  const [campaignPledgesLoading, setCampaignPledgesLoading] = useState(false)
  const [campaignPledgesError, setCampaignPledgesError] = useState('')
  const [contentSubmissions, setContentSubmissions] = useState<ContentSubmission[]>([])
  const [contentSubmissionsLoading, setContentSubmissionsLoading] = useState(false)
  const [contentSubmissionsError, setContentSubmissionsError] = useState('')
  const [attendanceWebinar, setAttendanceWebinar] = useState<WebinarItem | null>(null)

  // Full unified content state
  const [formData, setFormData] = useState<HomepageSettings>(() => {
    return {
      ...defaultHomepageSettings,
      ...settings,
      webinars: settings.webinars || [],
      inPersonEvents: settings.inPersonEvents || [],
      circulars: settings.circulars || [],
      provinceTeams: settings.provinceTeams || [],
      narratives: settings.narratives || [],
      contentMedia: settings.contentMedia || [],
      clinicalItems: settings.clinicalItems || [],
    }
  })

  // Modal / Editing states for Sub-items
  const [editingItem, setEditingItem] = useState<{
    section: 'webinar' | 'inperson' | 'circular' | 'team' | 'narrative' | 'clinical' | 'content'
    isNew: boolean
    data: any
  } | null>(null)
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  // Real backend & database status
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null)
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)

  const loadCampaignPledges = React.useCallback(async () => {
    setCampaignPledgesLoading(true)
    setCampaignPledgesError('')
    try {
      const response = await fetch('/api/pledges?view=admin', { credentials: 'same-origin', cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) {
        setCampaignPledges([])
        setIsAuthenticated(false)
      }
      if (!response.ok) throw new Error(result?.error || 'دریافت فهرست عهدنامه‌ها ناموفق بود.')
      setCampaignPledges(Array.isArray(result?.data) ? result.data : [])
    } catch (error) {
      setCampaignPledgesError(error instanceof Error ? error.message : 'دریافت فهرست عهدنامه‌ها ناموفق بود.')
    } finally {
      setCampaignPledgesLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (isAuthenticated && activeTab === 'campaign') void loadCampaignPledges()
  }, [isAuthenticated, activeTab, loadCampaignPledges])

  const loadContentSubmissions = React.useCallback(async () => {
    setContentSubmissionsLoading(true)
    setContentSubmissionsError('')
    try {
      const response = await fetch('/api/experiences?view=content-submissions', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (response.status === 401) {
        setContentSubmissions([])
        setIsAuthenticated(false)
      }
      if (!response.ok || result?.status !== 'ok') throw new Error(result?.error || 'دریافت آثار ارسالی ناموفق بود.')
      setContentSubmissions(Array.isArray(result?.data) ? result.data : [])
    } catch (error) {
      setContentSubmissionsError(error instanceof Error ? error.message : 'دریافت آثار ارسالی ناموفق بود.')
    } finally {
      setContentSubmissionsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (isAuthenticated && activeTab === 'content') void loadContentSubmissions()
  }, [isAuthenticated, activeTab, loadContentSubmissions])

  const exportCampaignPledges = async () => {
    if (!campaignPledges.length) return
    try {
      const { createPledgeWorkbook } = await import('@/lib/pledge-workbook')
      const blob = await createPledgeWorkbook(campaignPledges)
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `عهدنامه-ثبت‌نام‌ها-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } catch (error) {
      notify(error instanceof Error ? `خروجی Excel ساخته نشد: ${error.message}` : 'ساخت خروجی Excel ناموفق بود.')
    }
  }

  const refreshBackendStatus = async () => {
    setIsCheckingBackend(true)
    try {
      const res = await checkBackendStatus()
      setBackendStatus(res)
    } finally {
      setIsCheckingBackend(false)
    }
  }

  React.useEffect(() => {
    let active = true
    fetch('/api/session', { credentials: 'same-origin' })
      .then(async response => response.ok ? response.json() : null)
      .then(session => {
        if (!active) return
        const authenticated = session?.ok === true && session?.role === 'admin'
        setIsAuthenticated(authenticated)
        if (!authenticated) {
          try { sessionStorage.removeItem('dars_admin_authenticated') } catch {}
        }
      })
      .catch(() => {
        if (active) setIsAuthenticated(false)
      })
      .finally(() => {
        if (active) setAuthChecking(false)
      })
    return () => { active = false }
  }, [])

  React.useEffect(() => {
    if (isAuthenticated) {
      refreshBackendStatus()
    }
  }, [isAuthenticated])

  // Load the full editor data only after the server confirms the admin session.
  // The public site gets a much smaller projection without the attendee workbook/list.
  React.useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    setAdminSettingsLoading(true)
    setAdminSettingsLoadError('')
    fetchServerSettings({ adminFull: true })
      .then(fullSettings => {
        if (!active) return
        if (!fullSettings) {
          if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) return
          setAdminSettingsLoadError('بارگذاری کامل اطلاعات برای پنل مدیریت ناموفق بود؛ برای جلوگیری از حذف داده‌ها، ویرایش را آغاز نکنید.')
          return
        }
        setFormData({
          ...defaultHomepageSettings,
          ...fullSettings,
          webinars: fullSettings.webinars || [],
          inPersonEvents: fullSettings.inPersonEvents || [],
          circulars: fullSettings.circulars || [],
          provinceTeams: fullSettings.provinceTeams || [],
          narratives: fullSettings.narratives || [],
          contentMedia: fullSettings.contentMedia || [],
          clinicalItems: fullSettings.clinicalItems || [],
        })
      })
      .catch((err) => {
        if (!active) return
        const detail = err instanceof Error ? ` (${err.message})` : ''
        setAdminSettingsLoadError(`دریافت تنظیمات کامل مدیر از سرور ممکن نشد؛ دوباره تلاش کنید.${detail}`)
      })
      .finally(() => {
        if (active) setAdminSettingsLoading(false)
      })
    return () => { active = false }
  }, [isAuthenticated])

  // 1. Poster upload with automatic WebP conversion
  const handleWebinarPosterUpload = async (file: File) => {
    if (!editingItem) return
    if (file.size > MAX_BLOB_UPLOAD_BYTES) {
      notify('اندازه تصویر پوستر باید حداکثر ۴ مگابایت باشد.')
      return
    }
    setUploadingField('posterUrl')
    try {
      const webpRes = await convertImageFileToWebp(file, 0.9)
      setEditingItem((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          data: {
            ...prev.data,
            posterUrl: webpRes.dataUrl,
            posterFileName: webpRes.fileName,
          },
        }
      })
      notify(`پوستر با موفقیت به فرمت بهینه WebP («${webpRes.fileName}») تبدیل و ذخیره شد.`)
      // Optional background blob upload
      uploadToBlob(file).then((blobRes) => {
        if (blobRes?.url && !blobRes.url.startsWith('blob:')) {
          setEditingItem((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              data: {
                ...prev.data,
                posterUrl: blobRes.url,
              },
            }
          })
        }
      }).catch(() => {})
    } catch (err) {
      console.error(err)
      notify('خطا در تبدیل و بارگذاری پوستر.')
    } finally {
      setUploadingField(null)
    }
  }

  // 2. Multiple Presentation Files upload
  const handleAddPresentationFiles = async (fileList: FileList | File[]) => {
    if (!editingItem) return
    const files = Array.from(fileList)
    if (files.length === 0) return
    const allowedExtensions = new Set(['pdf', 'ppt', 'pptx', 'docx'])
    if (files.some(file => !allowedExtensions.has(file.name.split('.').pop()?.toLowerCase() || ''))) {
      notify('فایل ارائه باید PDF، PPT/PPTX یا DOCX باشد.')
      return
    }
    if (files.some(file => file.size <= 0 || file.size > MAX_BLOB_UPLOAD_BYTES)) {
      notify('هر فایل ارائه باید بزرگ‌تر از صفر و حداکثر ۴ مگابایت باشد.')
      return
    }
    setUploadingField('presentationFiles')

    let failedCount = 0
    const uploadedItems = await Promise.all(files.map(async (file): Promise<WebinarContentFile | null> => {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        const fileType: WebinarContentFile['fileType'] = ext === 'pdf' ? 'pdf' : ext === 'ppt' ? 'ppt' : ext === 'pptx' ? 'pptx' : 'docx'
        const uploaded = await uploadToBlob(file, 'public')
        // In local preview only, retain a data URL fallback; production save still externalizes it to Blob.
        const url = uploaded.url || await readFileAsDataUrl(file)
        const sizeInMb = (file.size / (1024 * 1024)).toFixed(1)
        return {
          id: 'file-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          title: file.name.replace(/\.[^/.]+$/, ''),
          fileName: file.name,
          url,
          downloadUrl: uploaded.downloadUrl,
          fileType,
          fileSize: `${sizeInMb} MB`,
        }
      } catch {
        failedCount++
        return null
      }
    }))
    const newItems = uploadedItems.filter((item): item is WebinarContentFile => item !== null)
    if (newItems.length > 0) {
      setEditingItem((previous) => {
        if (!previous) return previous
        const existing = previous.data.contentFiles || []
        const updated = [...existing, ...newItems]
        return {
          ...previous,
          data: {
            ...previous.data,
            contentFiles: updated,
            contentUrl: updated[0]?.url || previous.data.contentUrl || '',
            contentFileName: updated[0]?.fileName || previous.data.contentFileName || '',
          },
        }
      })
    }
    setUploadingField(null)
    if (failedCount > 0) {
      notify(`${newItems.length} فایل ارائه افزوده شد؛ خواندن ${failedCount} فایل ناموفق بود.`)
    } else {
      notify(`تعداد ${newItems.length} فایل ارائه با موفقیت افزوده شد.`)
    }
  }

  const handleRemovePresentationFile = (fileId: string) => {
    if (!editingItem) return
    setEditingItem((prev) => {
      if (!prev) return prev
      const current = prev.data.contentFiles || []
      const filtered = current.filter((f: WebinarContentFile) => f.id !== fileId)
      return {
        ...prev,
        data: {
          ...prev.data,
          contentFiles: filtered,
          contentUrl: filtered[0]?.url || '',
          contentFileName: filtered[0]?.fileName || '',
        },
      }
    })
  }

  // 3. Attendance Excel upload & parsing
  const handleWebinarExcelUpload = async (file: File) => {
    if (!editingItem) return
    if (file.size > MAX_BLOB_UPLOAD_BYTES) {
      notify('برای نگهداری امن نسخه خام، اندازه فایل اکسل باید حداکثر ۴ مگابایت باشد.')
      return
    }
    setUploadingField('attendeesExcelUrl')
    try {
      const parsedAttendees = await parseAttendanceExcel(
        file,
        editingItem.data.title || 'وبینار تخصصی',
        editingItem.data.date || '۱۴۰۵'
      )

      if (parsedAttendees.length === 0) {
        notify(
          'اطلاعاتی در فایل اکسل یافت نشد. لطفاً از وجود ستون‌های «نام و نام خانوادگی» و «استان» در فایل اطمینان حاصل فرمایید.'
        )
        return
      }

      // Parsed personal data remains in the admin-only webinar record.
      setEditingItem((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          data: {
            ...prev.data,
            attendeesFileName: file.name,
            attendeesExcelUrl: '',
            attendeesList: parsedAttendees,
          },
        }
      })

      notify(
        `فایل اکسل («${file.name}») با موفقیت خوانده شد و تعداد ${parsedAttendees.length} شرکت‌کننده استخراج گردید.`
      )

      // Wait for the original workbook DataURL before clearing the busy state so a
      // fast subsequent Save cannot persist attendee rows without the private source file.
      try {
        const dataUrl = await readFileAsDataUrl(file)
        setEditingItem((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            data: {
              ...prev.data,
              attendeesExcelUrl: dataUrl,
            },
          }
        })
      } catch (error) {
        console.error('Raw attendee workbook read failed:', error)
        notify('فهرست حاضران خوانده شد، اما نسخه خام خصوصی نگهداری نشد؛ فایل را دوباره بارگذاری کنید.')
      }
    } catch (err) {
      console.error('Excel processing error:', err)
      notify('خطا در خواندن فایل اکسل. لطفاً ساختار فایل را بررسی نمایید.')
    } finally {
      setUploadingField(null)
    }
  }

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    if (!passwordInput.trim()) {
      setAuthError('لطفاً رمز عبور را وارد نمایید.')
      return
    }

    setIsVerifying(true)
    try {
      const res = await verifyAdminPassword(passwordInput.trim())
      if (res.ok) {
        setIsAuthenticated(true)
        try {
          sessionStorage.setItem('dars_admin_authenticated', 'true')
        } catch {}
        notify('احراز هویت موفق بود. به پنل مدیریت خوش آمدید.')
      } else {
        setAuthError(res.message || 'رمز عبور وارد شده نادرست است.')
      }
    } catch {
      setAuthError('خطا در برقراری ارتباط با سامانه تأیید هویت.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleLogout = () => {
    void fetch('/api/session', { method: 'POST', credentials: 'same-origin', cache: 'no-store' }).catch(() => {})
    try {
      sessionStorage.removeItem('dars_admin_authenticated')
    } catch {}
    setIsAuthenticated(false)
    onNavigateHome()
  }

  // Box property change
  const handleBoxChange = (field: keyof HubBox, value: any) => {
    setFormData((prev) => {
      const updatedBoxes = [...prev.hubBoxes]
      const currentBox = { ...updatedBoxes[selectedBoxIndex] }

      if (field === 'docHighlights' && typeof value === 'string') {
        currentBox.docHighlights = value.split('،').map((s) => s.trim()).filter(Boolean)
      } else {
        ;(currentBox as any)[field] = value
      }

      updatedBoxes[selectedBoxIndex] = currentBox
      return {
        ...prev,
        hubBoxes: updatedBoxes,
      }
    })
  }

  // Select palette swatch
  const applyPalette = (accent: string, glow: string) => {
    setFormData((prev) => {
      const updatedBoxes = [...prev.hubBoxes]
      updatedBoxes[selectedBoxIndex] = {
        ...updatedBoxes[selectedBoxIndex],
        accentColor: accent,
        glowColor: glow,
      }
      return {
        ...prev,
        hubBoxes: updatedBoxes,
      }
    })
  }

  // Save full state
  const handleSaveAll = async () => {
    if (!(await onSaveSettings(formData))) return
    notify('تمامی تغییرات با موفقیت ذخیره و در سایت اعمال شد.')
  }

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(formData, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `dars-content-backup-${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    notify('فایل پشتیبان کامل با موفقیت دانلود شد.')
  }

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string)
        if (json.hubBoxes) {
          if (!(await onSaveSettings(json))) return
          setFormData(json)
          notify('اطلاعات با موفقیت از فایل پشتیبان بازیابی شدند.')
        } else {
          notify('فایل انتخاب شده معتبر نیست.')
        }
      } catch {
        notify('خطا در خواندن فایل JSON.')
      }
    }
    reader.readAsText(file)
  }

  // ------------------------------------------------------------------------
  // CRUD Helpers for Sub-collections
  // ------------------------------------------------------------------------

  // Webinars CRUD
  const handleSaveWebinar = async (webinar: WebinarItem) => {
    const scheduleValues = [webinar.attendanceStartDate, webinar.attendanceStartTime, webinar.attendanceEndDate, webinar.attendanceEndTime]
    const hasScheduleValue = scheduleValues.some(value => String(value || '').trim())
    const hasCompleteSchedule = scheduleValues.every(value => String(value || '').trim())
    if (webinar.status === 'upcoming' && hasScheduleValue && !hasCompleteSchedule) {
      notify('برای زمان‌بندی ثبت حضور، تاریخ و ساعت شروع و پایان را کامل کنید یا همه را خالی بگذارید.')
      return
    }
    if (webinar.status === 'upcoming' && hasCompleteSchedule) {
      const { start, end, configured } = getWebinarRegistrationWindow(webinar)
      if (!configured || !start || !end || end.getTime() <= start.getTime()) {
        notify('بازه ثبت حضور معتبر نیست؛ پایان باید بعد از زمان شروع باشد.')
        return
      }
    }

    const current = formData.webinars || []
    let updated: WebinarItem[]
    if (editingItem?.isNew) {
      updated = [webinar, ...current]
    } else {
      updated = current.map((w) => (w.id === webinar.id ? webinar : w))
    }
    const newForm = { ...formData, webinars: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    setEditingItem(null)
    notify(editingItem?.isNew ? 'وبینار جدید با موفقیت اضافه شد.' : 'وبینار با موفقیت ویرایش شد.')
  }

  const handleDeleteWebinar = async (id: string) => {
    if (!window.confirm('آیا از حذف این وبینار اطمینان دارید؟')) return
    const updated = (formData.webinars || []).filter((w) => w.id !== id)
    const newForm = { ...formData, webinars: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('وبینار مورد نظر حذف گردید.')
  }

  // In-Person Events CRUD
  const handleSaveInPerson = async (item: InPersonEvent) => {
    const current = formData.inPersonEvents || []
    let updated: InPersonEvent[]
    if (editingItem?.isNew) {
      updated = [item, ...current]
    } else {
      updated = current.map((e) => (e.id === item.id ? item : e))
    }
    const newForm = { ...formData, inPersonEvents: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    setEditingItem(null)
    notify(editingItem?.isNew ? 'نشست حضوری جدید با موفقیت افزوده شد.' : 'نشست حضوری ویرایش شد.')
  }

  const handleDeleteInPerson = async (id: string) => {
    if (!window.confirm('آیا از حذف این نشست حضوری اطمینان دارید؟')) return
    const updated = (formData.inPersonEvents || []).filter((e) => e.id !== id)
    const newForm = { ...formData, inPersonEvents: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('نشست حضوری مورد نظر حذف گردید.')
  }

  // Circulars CRUD
  const handleSaveCircular = async (circ: CircularItem) => {
    const current = formData.circulars || []
    let updated: CircularItem[]
    if (editingItem?.isNew) {
      updated = [circ, ...current]
    } else {
      updated = current.map((c) => (c.id === circ.id ? circ : c))
    }
    const newForm = { ...formData, circulars: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    setEditingItem(null)
    notify(editingItem?.isNew ? 'بخشنامه/فراخوان جدید با موفقیت اضافه شد.' : 'بخشنامه با موفقیت ویرایش شد.')
  }

  const handleDeleteCircular = async (id: string) => {
    if (!window.confirm('آیا از حذف این بخشنامه/فراخوان اطمینان دارید؟')) return
    const updated = (formData.circulars || []).filter((c) => c.id !== id)
    const newForm = { ...formData, circulars: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('بخشنامه مورد نظر حذف گردید.')
  }

  const handleCircularPdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('فقط فایل PDF قابل بارگذاری است.')
      return
    }
    if (file.size > MAX_BLOB_UPLOAD_BYTES) {
      notify('حجم فایل PDF باید حداکثر ۴ مگابایت باشد.')
      return
    }
    setUploadingField('circularPdf')
    try {
      const uploaded = await uploadToBlob(file, 'public')
      if (!uploaded.url) {
        notify(uploaded.error || 'بارگذاری PDF انجام نشد.')
        return
      }
      setEditingItem((previous) => previous?.section === 'circular'
        ? { ...previous, data: { ...previous.data, pdfFile: uploaded.url, pdfFileName: file.name, pdfDownloadUrl: uploaded.downloadUrl || uploaded.url } }
        : previous)
      notify('فایل PDF بخشنامه بارگذاری شد؛ برای ثبت نهایی، «ذخیره و ثبت» را بزنید.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'بارگذاری PDF ناموفق بود.')
    } finally {
      setUploadingField(null)
    }
  }

  const handleClinicalDocumentUpload = async (field: 'pdfUrl' | 'docxUrl', file: File) => {
    const target = editingItem
    if (!target || target.section !== 'clinical') return
    const extension = file.name.split('.').pop()?.toLowerCase()
    const expectedExtension = field === 'pdfUrl' ? 'pdf' : 'docx'
    if (extension !== expectedExtension) {
      notify(field === 'pdfUrl' ? 'برای این قسمت فقط فایل PDF انتخاب کنید.' : 'برای این قسمت فقط فایل Word با فرمت DOCX انتخاب کنید.')
      return
    }
    if (file.size <= 0 || file.size > MAX_BLOB_UPLOAD_BYTES) {
      notify('اندازه فایل باید بیشتر از صفر و حداکثر ۴ مگابایت باشد.')
      return
    }

    const fileNameField = field === 'pdfUrl' ? 'pdfFileName' : 'docxFileName'
    const uploadKey = field === 'pdfUrl' ? 'clinicalPdf' : 'clinicalDocx'
    setUploadingField(uploadKey)
    try {
      const uploaded = await uploadToBlob(file, 'public')
      if (!uploaded.url) {
        notify(uploaded.error || 'بارگذاری فایل انجام نشد.')
        return
      }
      setEditingItem((previous) => previous?.section === 'clinical' && previous.data.id === target.data.id
        ? { ...previous, data: { ...previous.data, [field]: uploaded.url, [fileNameField]: file.name } }
        : previous)
      notify(`فایل ${file.name} بارگذاری شد؛ برای انتشار تغییرات، «ذخیره و ثبت» را بزنید.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'بارگذاری فایل ناموفق بود.')
    } finally {
      setUploadingField(null)
    }
  }

  const handleCampaignFileUpload = async (selected: File[]) => {
    if (!selected.length) return
    const existing = campaignFileList(formData.campaignPdf, formData.campaignFiles)
    if (existing.length + selected.length > 50) { notify('حداکثر ۵۰ فایل برای کمپین قابل ثبت است.'); return }
    if (selected.some(file => !campaignFileType(file.name))) { notify('فرمت فایل انتخاب‌شده مجاز نیست.'); return }
    if (selected.some(file => file.size <= 0 || file.size > CAMPAIGN_MAX_UPLOAD_BYTES)) { notify('اندازه هر فایل باید بیشتر از صفر و حداکثر ۲۵۰ مگابایت باشد.'); return }
    setUploadingField('campaignPdf')
    let current = { ...formData, campaignPdf: undefined, campaignFiles: existing }
    try {
      for (const file of selected) {
        // Self-hosted port: every file goes through our own /api/upload route (up to 250MB),
        // because Vercel's client-side presigned uploads only exist on Vercel.
        const uploaded = await uploadToBlob(file, 'public', 'campaign-file')
        if (!uploaded.url) { notify(uploaded.error || `بارگذاری ${file.name} انجام نشد.`); return }
        const next = { ...current, campaignFiles: [...current.campaignFiles, { url: uploaded.url, downloadUrl: uploaded.downloadUrl || uploaded.url, fileName: file.name }] }
        if (!(await onSaveSettings(next))) { notify(`بارگذاری ${file.name} انجام شد اما ثبت آن ناموفق بود؛ دوباره تلاش کنید.`); return }
        current = next
        setFormData(current)
      }
      notify('فایل‌های کمپین بارگذاری و ثبت شدند.')
    } catch (error) {
      console.error('Campaign upload failed', error)
      notify('بارگذاری فایل کمپین انجام نشد. اتصال اینترنت، نشست مدیر و فضای ذخیره‌سازی سرور را بررسی کنید.')
    } finally { setUploadingField(null) }
  }

  const handleRemoveCampaignFile = async (url: string) => {
    if (!window.confirm('این فایل از صفحه عمومی کمپین برداشته شود؟')) return
    const newForm = { ...formData, campaignPdf: undefined, campaignFiles: campaignFileList(formData.campaignPdf, formData.campaignFiles).filter(file => file.url !== url) }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('فایل از صفحه کمپین برداشته شد.')
  }

  // Campaign Province Teams CRUD
  const handleSaveTeam = async (team: ProvinceTeamsData) => {
    const current = formData.provinceTeams || []
    let updated: ProvinceTeamsData[]
    if (editingItem?.isNew) {
      updated = [...current, team]
    } else {
      updated = current.map((t) => (t.provinceCode === team.provinceCode ? team : t))
    }
    const newForm = { ...formData, provinceTeams: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    setEditingItem(null)
    notify('اطلاعات تیم‌ها با موفقیت ذخیره شد.')
  }

  const handleDeleteTeam = async (provinceCode: string) => {
    if (!window.confirm('آیا از حذف این استان/تیم اطمینان دارید؟')) return
    const updated = (formData.provinceTeams || []).filter((t) => t.provinceCode !== provinceCode)
    const newForm = { ...formData, provinceTeams: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('مورد با موفقیت حذف شد.')
  }

  // Lived Experiences CRUD
  const handleSaveNarrative = async (nar: NarrativeSample) => {
    const current = formData.narratives || []
    let updated: NarrativeSample[]
    if (editingItem?.isNew) {
      updated = [nar, ...current]
    } else {
      updated = current.map((n) => (n.id === nar.id ? nar : n))
    }
    const newForm = { ...formData, narratives: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    setEditingItem(null)
    notify('تجربه زیسته با موفقیت ذخیره گردید.')
  }

  const handleDeleteNarrative = async (id: string) => {
    if (!window.confirm('آیا از حذف این تجربه زیسته اطمینان دارید؟')) return
    const updated = (formData.narratives || []).filter((n) => n.id !== id)
    const newForm = { ...formData, narratives: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('تجربه زیسته حذف شد.')
  }

  // Clinical Supervision Deliverables CRUD
  const handleSaveClinical = async (clin: ClinicalItemData) => {
    const current = formData.clinicalItems || []
    let updated: ClinicalItemData[]
    if (editingItem?.isNew) {
      updated = [...current, clin]
    } else {
      updated = current.map((c) => (c.id === clin.id ? clin : c))
    }
    const newForm = { ...formData, clinicalItems: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    setEditingItem(null)
    notify('مستند نظارت بالینی با موفقیت ذخیره شد.')
  }

  const handleDeleteClinical = async (id: string) => {
    if (!window.confirm('آیا از حذف این مستند نظارتی اطمینان دارید؟')) return
    const updated = (formData.clinicalItems || []).filter((c) => c.id !== id)
    const newForm = { ...formData, clinicalItems: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('مستند نظارتی حذف شد.')
  }

  // Content Media CRUD
  const handleSaveContent = async (media: ContentMediaItem) => {
    const current = formData.contentMedia || []
    let updated: ContentMediaItem[]
    if (editingItem?.isNew) {
      updated = [media, ...current]
    } else {
      updated = current.map((m) => (m.id === media.id ? media : m))
    }
    const newForm = { ...formData, contentMedia: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    setEditingItem(null)
    notify('محتوا با موفقیت در بانک رسانه ذخیره شد.')
  }

  const handleDeleteContent = async (id: string) => {
    if (!window.confirm('آیا از حذف این محتوا اطمینان دارید؟')) return
    const updated = (formData.contentMedia || []).filter((m) => m.id !== id)
    const newForm = { ...formData, contentMedia: updated }
    if (!(await onSaveSettings(newForm))) return
    setFormData(newForm)
    notify('محتوا حذف شد.')
  }

  // ------------------------------------------------------------------------
  // Verify the server-side session before showing protected administration UI
  // ------------------------------------------------------------------------
  if (authChecking) {
    return (
      <div className="admin-login-wrapper min-h-screen flex items-center justify-center p-4">
        <div className="admin-login-card dusk-card max-w-md w-full p-8 text-center text-slate-300">
          <Loader2 size={28} className="animate-spin mx-auto mb-3 text-amber-400" />
          <p className="font-nazanin">در حال بررسی نشست امن…</p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------------
  // If NOT Authenticated: Render Password Protection Gate
  // ------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="admin-login-wrapper min-h-screen flex items-center justify-center p-4">
        <div className="admin-login-card dusk-card max-w-md w-full p-8 text-center relative overflow-hidden">
          <div className="login-glow-aura" />

          <div className="login-icon-pod mx-auto mb-4">
            <KeyRound size={32} className="text-amber-400" />
          </div>

          <h1 className="font-titr text-2xl text-white mb-2">
            ورود به پنل مدیریت دبیرخانه
          </h1>
          <p className="text-sm text-slate-300 mb-6">
            جهت ویرایش محتوا، افزودن رویدادها و مدیریت درگاه‌ها، لطفاً رمز عبور را وارد نمایید.
          </p>

          <form onSubmit={handleLoginSubmit} className="dusk-form">
            <div className="form-group text-right mb-4">
              <label htmlFor="admin-pass" className="text-xs text-slate-300 font-bold mb-1.5 block">
                رمز عبور مدیریت:
              </label>
              <div className="relative">
                <input
                  id="admin-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="رمز عبور پنل را وارد نمایید..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-400 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-titr text-base rounded-xl font-bold shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isVerifying ? (
                <span>در حال بررسی رمز...</span>
              ) : (
                <>
                  <Unlock size={18} />
                  <span>ورود به پنل مدیریت</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onNavigateHome}
              className="mt-4 text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>بازگشت به صفحه اصلی سایت</span>
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (adminSettingsLoading || adminSettingsLoadError) {
    return (
      <div className="admin-login-wrapper min-h-screen flex items-center justify-center p-4">
        <div className="admin-login-card dusk-card max-w-md w-full p-8 text-center text-slate-200">
          {adminSettingsLoading ? (
            <>
              <Loader2 size={30} className="animate-spin mx-auto mb-3 text-amber-400" />
              <p>در حال بارگذاری امن اطلاعات کامل پنل مدیریت…</p>
            </>
          ) : (
            <>
              <p className="text-amber-100 leading-7">{adminSettingsLoadError}</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold">
                تلاش دوباره
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const currentBox = formData.hubBoxes[selectedBoxIndex] || formData.hubBoxes[0]
  const webinars = formData.webinars || []
  const inPerson = formData.inPersonEvents || []
  const circulars = formData.circulars || []
  const teams = formData.provinceTeams || []
  const narratives = formData.narratives || []
  const clinicals = formData.clinicalItems || []
  const media = formData.contentMedia || []

  return (
    <div className="admin-layout flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-100">
      {/* ================================================================ */}
      {/* RIGHT SIDEBAR: شیک، به‌روز و مجلل در سمت راست                       */}
      {/* ================================================================ */}
      <aside className="admin-sidebar w-full md:w-80 bg-slate-900/95 border-l border-slate-800 flex flex-col shrink-0 z-30">
        {/* Sidebar Brand Header */}
        <div className="sidebar-brand p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-orange-500/25">
              <span>✦</span>
            </div>
            <div>
              <h2 className="font-titr text-lg text-white leading-tight">پنل راهبری دبیرخانه</h2>
              <span className="text-[11px] text-slate-400 font-nazanin">مدیریت جامع محتوا و صفحات</span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-xs">
          {backendStatus?.neon?.connected ? (
            <span
              className="flex items-center gap-1.5 text-emerald-400 font-medium"
              title="پایگاه داده نئون آنلاین و متصل است"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>دیتابیس نئون: متصل</span>
            </span>
          ) : backendStatus?.neon?.configured ? (
            <span
              className="flex items-center gap-1.5 text-amber-400 font-medium"
              title={backendStatus.neon.error || 'اتصال به پایگاه داده برقرار نیست'}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>دیتابیس نئون: اتصال برقرار نیست</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 text-slate-400 font-medium"
              title="اتصال پایگاه داده بررسی نشد یا تنظیم نشده است"
            >
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>دیتابیس: وضعیت نامشخص</span>
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={refreshBackendStatus}
              title="بررسی مجدد اتصال به دیتابیس"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <RotateCcw size={12} className={isCheckingBackend ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleSaveAll}
              className="text-[11px] px-2.5 py-1 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded-lg border border-sky-500/30 font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Save size={12} />
              ذخیره کل
            </button>
          </div>
        </div>

        {/* Sidebar Navigation Menu */}
        <nav className="sidebar-nav flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="menu-group-label text-[11px] text-slate-500 font-bold px-3 pt-2 pb-1">
            حساب‌ها و ساختار اصلی
          </div>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`admin-menu-btn ${activeTab === 'accounts' ? 'active' : ''}`}
          >
            <UsersRound size={17} className="text-emerald-400 shrink-0" />
            <span className="flex-1 text-right font-medium">حساب‌های ۳۲ پنل استانی</span>
            <span className="badge-count">۳۲</span>
          </button>

          <button onClick={() => setActiveTab('province-monitor')} className={`admin-menu-btn ${activeTab === 'province-monitor' ? 'active' : ''}`}>
            <ScanEye size={17} className="text-cyan-400 shrink-0" /><span className="flex-1 text-right font-medium">پایش محتوای استان‌ها</span>
          </button>

          <div className="menu-group-label text-[11px] text-slate-500 font-bold px-3 pt-4 pb-1">
            صفحه نخست و ساختار اصلی
          </div>

          <button
            onClick={() => setActiveTab('boxes')}
            className={`admin-menu-btn ${activeTab === 'boxes' ? 'active' : ''}`}
          >
            <LayoutGrid size={17} className="text-sky-400 shrink-0" />
            <span className="flex-1 text-right font-medium">صفحه اصلی و ۷ باکس</span>
            <span className="badge-count">۷</span>
          </button>

          <div className="menu-group-label text-[11px] text-slate-500 font-bold px-3 pt-4 pb-1">
            مدیریت محتوای درگاه‌ها (ویرایش، حذف و اضافه)
          </div>

          <button
            onClick={() => setActiveTab('webinars')}
            className={`admin-menu-btn ${activeTab === 'webinars' ? 'active' : ''}`}
          >
            <Video size={17} className="text-sky-400 shrink-0" />
            <span className="flex-1 text-right font-medium">وبینارهای آموزشی</span>
            <span className="badge-count">{webinars.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('inperson')}
            className={`admin-menu-btn ${activeTab === 'inperson' ? 'active' : ''}`}
          >
            <UsersRound size={17} className="text-lime-400 shrink-0" />
            <span className="flex-1 text-right font-medium">نشست‌های حضوری</span>
            <span className="badge-count">{inPerson.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('circulars')}
            className={`admin-menu-btn ${activeTab === 'circulars' ? 'active' : ''}`}
          >
            <ScrollText size={17} className="text-violet-400 shrink-0" />
            <span className="flex-1 text-right font-medium">بخشنامه‌ها و فراخوان‌ها</span>
            <span className="badge-count">{circulars.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('campaign')}
            className={`admin-menu-btn ${activeTab === 'campaign' ? 'active' : ''}`}
          >
            <Sparkles size={17} className="text-orange-400 shrink-0" />
            <span className="flex-1 text-right font-medium">کمپین ما باهم می‌آموزیم</span>
            <span className="badge-count">{teams.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('experiences')}
            className={`admin-menu-btn ${activeTab === 'experiences' ? 'active' : ''}`}
          >
            <BookOpenCheck size={17} className="text-pink-400 shrink-0" />
            <span className="flex-1 text-right font-medium">فراخوان تجارب زیسته</span>
            <span className="badge-count">{narratives.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('supervision')}
            className={`admin-menu-btn ${activeTab === 'supervision' ? 'active' : ''}`}
          >
            <ScanEye size={17} className="text-cyan-400 shrink-0" />
            <span className="flex-1 text-right font-medium">نظارت بالینی</span>
            <span className="badge-count">{clinicals.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`admin-menu-btn ${activeTab === 'content' ? 'active' : ''}`}
          >
            <Film size={17} className="text-amber-400 shrink-0" />
            <span className="flex-1 text-right font-medium">تولید محتوا و رسانه</span>
            <span className="badge-count">{media.length}</span>
          </button>

          <div className="menu-group-label text-[11px] text-slate-500 font-bold px-3 pt-4 pb-1">
            سیستم و داده‌ها
          </div>

          <button
            onClick={() => setActiveTab('backup')}
            className={`admin-menu-btn ${activeTab === 'backup' ? 'active' : ''}`}
          >
            <Database size={17} className="text-slate-400 shrink-0" />
            <span className="flex-1 text-right font-medium">پشتیبان‌گیری و بازیابی</span>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer p-4 border-t border-slate-800 space-y-2 bg-slate-950/40">
          <button
            onClick={onNavigateHome}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ExternalLink size={14} />
            <span>مشاهده صفحه اصلی سایت</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full py-2.5 px-3 rounded-xl bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={14} />
            <span>خروج از حساب مدیریت</span>
          </button>
        </div>
      </aside>

      {/* ================================================================ */}
      {/* MAIN ADMIN WORKSPACE (در سمت چپ منو)                              */}
      {/* ================================================================ */}
      <main className="admin-main flex-1 p-4 md:p-8 overflow-y-auto">
        {/* Top Breadcrumb & Action bar */}
        <div className="admin-page-header flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h1 className="font-titr text-2xl text-white">
              {activeTab === 'boxes' && 'مدیریت صفحه اصلی و باکس‌های ۷گانه'}
              {activeTab === 'webinars' && 'مدیریت وبینارهای آموزشی'}
              {activeTab === 'inperson' && 'مدیریت نشست‌های حضوری'}
              {activeTab === 'circulars' && 'مدیریت بخشنامه‌ها و فراخوان‌ها'}
              {activeTab === 'campaign' && 'مدیریت کمپین ما باهم می‌آموزیم'}
              {activeTab === 'experiences' && 'مدیریت تجارب زیسته معلمان'}
              {activeTab === 'supervision' && 'مدیریت مستندات نظارت بالینی'}
              {activeTab === 'content' && 'مدیریت بانک رسانه و تولید محتوا'}
              {activeTab === 'backup' && 'پشتیبان‌گیری و بازیابی داده‌ها'}
              {activeTab === 'accounts' && 'مدیریت حساب‌های ورود استان‌ها'}
              {activeTab === 'province-monitor' && 'پایش محتوای استان‌ها'}
            </h1>
          </div>

          {activeTab !== 'accounts' && activeTab !== 'province-monitor' && (
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-titr text-sm rounded-xl font-bold shadow-lg shadow-sky-500/25 transition flex items-center gap-2 cursor-pointer"
            >
              <Save size={16} />
              <span>ذخیره تغییرات</span>
            </button>
          )}
        </div>

        {activeTab === 'accounts' && <ProvinceAccountsPanel notify={notify} />}
        {activeTab === 'province-monitor' && <ProvinceContentMonitor notify={notify} onReviewChanged={onProvinceReviewChanged} />}

        {/* -------------------------------------------------------------- */}
        {/* TAB 1: 7 HUB BOXES & MODERN COLOR PALETTE                      */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'boxes' && (
          <div className="space-y-6">
            {/* Box Tabs Selector */}
            <div className="flex flex-wrap gap-2 pb-2">
              {formData.hubBoxes.map((box, idx) => (
                <button
                  key={box.id}
                  onClick={() => setSelectedBoxIndex(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 shrink-0 cursor-pointer ${
                    selectedBoxIndex === idx
                      ? 'bg-slate-800 text-white border-amber-400 shadow-md'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  style={{
                    borderRightColor: selectedBoxIndex === idx ? box.accentColor : undefined,
                    borderRightWidth: selectedBoxIndex === idx ? '3px' : undefined,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: box.accentColor }}
                  />
                  <span>{box.title}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Box Form */}
              <div className="lg:col-span-2 dusk-card p-6">
                <h3 className="font-titr text-lg text-white mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                  <Edit3 size={18} className="text-amber-400" />
                  <span>ویرایش مشخصات: {currentBox.title}</span>
                </h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="text-xs text-slate-300 font-bold mb-1 block">عنوان باکس:</label>
                      <input
                        type="text"
                        value={currentBox.title}
                        onChange={(e) => handleBoxChange('title', e.target.value)}
                        className="dusk-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="text-xs text-slate-300 font-bold mb-1 block">برچسب بالای کارت:</label>
                      <input
                        type="text"
                        value={currentBox.badge}
                        onChange={(e) => handleBoxChange('badge', e.target.value)}
                        className="dusk-input"
                      />
                    </div>
                  </div>

                  {/* MODERN COLOR PALETTE SELECTOR */}
                  <div className="palette-section pt-4 border-t border-slate-800">
                    <label className="text-xs text-slate-200 font-bold mb-2 flex items-center justify-between">
                      <span>پالت رنگ‌های مدرن و به‌روز (نئون و داسک):</span>
                      <span className="text-[11px] text-slate-400 font-normal">کلیک جهت انتخاب فوری</span>
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-4">
                      {MODERN_PALETTES.map((pal) => {
                        const isSelected = currentBox.accentColor.toLowerCase() === pal.accent.toLowerCase()
                        return (
                          <button
                            key={pal.accent}
                            type="button"
                            onClick={() => applyPalette(pal.accent, pal.glow)}
                            className={`p-2.5 rounded-xl border text-right transition flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-slate-800 border-white text-white shadow-lg'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <span
                              className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                              style={{ backgroundColor: pal.accent, boxShadow: `0 0 8px ${pal.accent}` }}
                            />
                            <span className="text-[11px] font-medium truncate">{pal.name}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400">کد هگز دلخواه:</label>
                        <input
                          type="color"
                          value={currentBox.accentColor}
                          onChange={(e) => {
                            const val = e.target.value
                            applyPalette(val, `${val}44`)
                          }}
                          className="w-9 h-9 rounded-lg bg-transparent border border-slate-700 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentBox.accentColor}
                          onChange={(e) => {
                            const val = e.target.value
                            applyPalette(val, `${val}44`)
                          }}
                          className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-center font-mono text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview of the Box */}
              <div className="dusk-card p-6 flex flex-col justify-between" style={{
                background: 'linear-gradient(155deg, rgba(23, 38, 60, 0.95) 0%, rgba(13, 22, 36, 0.98) 100%)',
                borderColor: currentBox.accentColor,
                boxShadow: `0 12px 36px -12px rgba(0,0,0,0.7), 0 0 25px -8px ${currentBox.glowColor}`,
              }}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium border"
                      style={{
                        backgroundColor: `${currentBox.accentColor}18`,
                        borderColor: `${currentBox.accentColor}50`,
                        color: currentBox.accentColor,
                      }}
                    >
                      {currentBox.badge}
                    </span>
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center border"
                      style={{
                        backgroundColor: `${currentBox.accentColor}20`,
                        borderColor: `${currentBox.accentColor}40`,
                        color: currentBox.accentColor,
                      }}
                    >
                      ✦
                    </span>
                  </div>

                  <h4 className="font-titr text-lg text-white mb-1">{currentBox.title}</h4>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-end text-xs text-slate-400">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: currentBox.accentColor }}
                  >
                    ←
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 3: WEBINARS CRUD (افزودن، ویرایش، حذف)                       */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'webinars' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                مجموع وبینارها: <strong className="text-white">{webinars.length}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingItem({
                    section: 'webinar',
                    isNew: true,
                    data: {
                      id: 'web-' + Date.now(),
                      title: '',
                      speaker: '',
                      role: '',
                      date: '',
                      time: 'ساعت ۱۶:۰۰ تا ۱۷:۳۰',
                      status: 'upcoming',
                      platform: 'تالار شماره ۱ اسکای‌روم دبیرخانه',
                      capacity: 'ظرفیت: ۵۰۰ نفر',
                      description: '',
                      posterUrl: '',
                      meetingUrl: '',
                      contentUrl: '',
                      recordedVideoUrl: '',
                      attendeesExcelUrl: '',
                    },
                  })
                }
                className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن وبینار جدید</span>
              </button>
            </div>

            {webinars.length === 0 ? (
              <div className="dusk-card p-10 text-center text-slate-400">
                <Video size={36} className="mx-auto mb-2 opacity-40 text-sky-400" />
                <p className="font-titr text-white text-base mb-1">هنوز وبیناری در سامانه تعریف نشده است</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="فهرست وبینارهای مدیریت">
                {sortByJalaliDateNewestFirst(webinars).map((w) => (
                  <div key={w.id} className="dusk-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full border ${
                          w.status === 'upcoming'
                            ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}>
                          {w.status === 'upcoming' ? 'در پیش‌رو' : 'برگزار شده / آرشیو'}
                        </span>
                        <span className="text-xs text-slate-400">{w.date}</span>
                      </div>
                      <h3 className="font-titr text-base text-white mb-1.5">{w.title}</h3>
                      <p className="text-xs text-slate-300 mb-2">مدرس: {w.speaker} ({w.role})</p>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{w.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <span className="text-[11px] text-slate-500">{w.time}</span>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={() => setAttendanceWebinar(w)}
                          className="p-1.5 text-violet-300 hover:text-white bg-violet-950/50 hover:bg-violet-900/60 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                          title="مشاهده و مدیریت ثبت‌حضورهای این وبینار"
                        >
                          <FileSpreadsheet size={14} />
                          <span>خروجی ثبت‌حضور</span>
                        </button>
                        <button
                          onClick={() => setEditingItem({ section: 'webinar', isNew: false, data: { ...w } })}
                          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>ویرایش</span>
                        </button>
                        <button
                          onClick={() => handleDeleteWebinar(w.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 4: IN-PERSON SESSIONS CRUD                                 */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'inperson' && (
          <div className="space-y-6">
            <InPersonRegistrations events={inPerson} />
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                مجموع نشست‌ها: <strong className="text-white">{inPerson.length}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingItem({
                    section: 'inperson',
                    isNew: true,
                    data: {
                      id: 'inp-' + Date.now(),
                      title: '',
                      province: 'تهران',
                      city: 'تهران',
                      venue: 'سالن همایش‌های دبیرخانه',
                      date: 'آذر ۱۴۰۵',
                      capacity: 'ظرفیت: ۸۰ نفر',
                      organizer: 'دبیرخانه کشوری',
                      status: 'open',
                      posterUrl: '/docs/inperson/poster-meeting-tehran.jpg',
                      circularUrl: '',
                      contentUrl: '',
                      photos: [],
                    },
                  })
                }
                className="px-4 py-2 bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن نشست حضوری جدید</span>
              </button>
            </div>

            {inPerson.length === 0 ? (
              <div className="dusk-card p-10 text-center text-slate-400">
                <UsersRound size={36} className="mx-auto mb-2 opacity-40 text-lime-400" />
                <p className="font-titr text-white text-base mb-1">هنوز نشست حضوری ثبت نشده است</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inPerson.map((inp) => (
                  <div key={inp.id} className="dusk-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-lime-500/10 border border-lime-500/30 text-lime-400">
                          {inp.province} - {inp.city}
                        </span>
                        <span className="text-xs text-slate-400">{inp.capacity}</span>
                      </div>
                      <h3 className="font-titr text-base text-white mb-1.5">{inp.title}</h3>
                      <p className="text-xs text-slate-300 mb-1">محل: {inp.venue}</p>
                      <p className="text-xs text-slate-400 mb-3">{inp.date}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <span className="text-[11px] text-slate-500">{inp.organizer}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingItem({ section: 'inperson', isNew: false, data: { ...inp } })}
                          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>ویرایش</span>
                        </button>
                        <button
                          onClick={() => handleDeleteInPerson(inp.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 5: CIRCULARS & CALLS CRUD                                  */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'circulars' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                مجموع بخشنامه‌ها و فراخوان‌ها: <strong className="text-white">{circulars.length}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingItem({
                    section: 'circular',
                    isNew: true,
                    data: {
                      id: 'circ-' + Date.now(),
                      number: '۴۰۰/' + Math.floor(10000 + Math.random() * 90000),
                      date: 'آبان ۱۴۰۵',
                      title: '',
                      authority: 'معاونت آموزش ابتدایی',
                      category: 'بخشنامه',
                      summary: '',
                      pdfFile: '',
                      pdfFileName: '',
                      pdfDownloadUrl: '',
                    },
                  })
                }
                className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن بخشنامه / فراخوان جدید</span>
              </button>
            </div>

            {circulars.length === 0 ? (
              <div className="dusk-card p-10 text-center text-slate-400">
                <ScrollText size={36} className="mx-auto mb-2 opacity-40 text-violet-400" />
                <p className="font-titr text-white text-base mb-1">هنوز بخشنامه یا فراخوانی در سامانه ثبت نشده است</p>
                <p className="text-xs text-slate-400">برای بارگذاری شیوه‌نامه یا بخشنامه جدید، روی دکمه «افزودن بخشنامه / فراخوان جدید» کلیک فرمایید.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {circulars.map((c) => (
                  <div key={c.id} className="dusk-card p-4 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/30 text-violet-400">
                          {c.category}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">شماره: {c.number}</span>
                        <span className="text-xs text-slate-500">({c.date})</span>
                      </div>
                      <h3 className="font-titr text-sm text-white mb-1">{c.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-1">{c.summary}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingItem({ section: 'circular', isNew: false, data: { ...c } })}
                        className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit3 size={14} />
                        <span>ویرایش</span>
                      </button>
                      <button
                        onClick={() => handleDeleteCircular(c.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 6: CAMPAIGN PROVINCE TEAMS CRUD                            */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'campaign' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                مجموع استان‌ها: <strong className="text-white">{teams.length}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingItem({
                    section: 'team',
                    isNew: true,
                    data: {
                      province: '',
                      provinceCode: 'prov-' + Date.now(),
                      excelUrl: '',
                      teamCount: 100,
                      sampleTeams: [],
                    },
                  })
                }
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن استان / تیم جدید</span>
              </button>
            </div>

            {teams.length === 0 ? (
              <div className="dusk-card p-10 text-center text-slate-400">
                <FileSpreadsheet size={36} className="mx-auto mb-2 opacity-40 text-orange-400" />
                <p className="font-titr text-white text-base mb-1">هنوز تیمی برای استان‌ها ثبت نشده است</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((t) => (
                  <div key={t.provinceCode} className="dusk-card p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-titr text-base text-white">{t.province}</h3>
                      <p className="text-xs text-amber-400 mt-0.5">تعداد تیم‌ها: {t.teamCount} تیم</p>
                      <p className="text-[11px] text-slate-500 font-mono mt-1">{t.excelUrl}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingItem({ section: 'team', isNew: false, data: { ...t } })}
                        className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit3 size={14} />
                        <span>ویرایش</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(t.provinceCode)}
                        className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="dusk-card border border-orange-300/20 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-titr text-base text-white">فایل‌های عمومی کمپین</h3>
                  <p className="mt-1 text-sm text-slate-300">این فایل‌ها برای همه قابل مشاهده و دریافت هستند؛ فایل محرمانه یا حاوی اطلاعات شخصی بارگذاری نکنید.</p>
                </div>
                <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-orange-300/25 bg-orange-300/[0.08] px-4 text-sm font-bold text-orange-100 transition hover:bg-orange-300/[0.14] ${uploadingField === 'campaignPdf' ? 'pointer-events-none opacity-60' : ''}`}>
                  {uploadingField === 'campaignPdf' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  <span>{uploadingField === 'campaignPdf' ? 'در حال بارگذاری فایل…' : 'انتخاب و آپلود فایل'}</span>
                  <input type="file" accept={CAMPAIGN_FILE_ACCEPT} multiple className="sr-only" disabled={Boolean(uploadingField)} onChange={(event) => {
                    const files = Array.from(event.target.files || [])
                    event.target.value = ''
                    void handleCampaignFileUpload(files)
                  }} />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-400">PDF، تصویر، Word، PowerPoint، Excel و ویدیو MP4، WebM یا MOV · حداکثر ۲۵۰ مگابایت برای هر فایل · حداکثر ۵۰ فایل · برداشتن از صفحه، فایل را از فضای ابری حذف نمی‌کند.</p>
              {campaignFileList(formData.campaignPdf, formData.campaignFiles).length > 0 && (
                <ul className="mt-4 space-y-2" aria-label="فایل‌های ثبت‌شده کمپین">
                  {campaignFileList(formData.campaignPdf, formData.campaignFiles).map(file => (
                    <li key={file.url} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-3">
                      <span className="min-w-0 flex-1 break-all text-sm text-orange-100">{file.fileName}</span>
                      <a href={file.downloadUrl || file.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/20 px-3 text-sm text-cyan-100">دریافت</a>
                      <button type="button" onClick={() => void handleRemoveCampaignFile(file.url)} disabled={Boolean(uploadingField)} aria-label={`برداشتن ${file.fileName} از صفحه`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300/20 px-3 text-sm text-red-200 disabled:opacity-50">برداشتن از صفحه</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <section className="dusk-card overflow-hidden border border-cyan-400/25 shadow-[0_18px_60px_rgba(2,8,23,0.38)]">
              <div className="relative overflow-hidden border-b border-cyan-200/10 bg-gradient-to-l from-[#123c42] via-[#102c38] to-[#111827] p-4 sm:p-5">
                <div aria-hidden="true" className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-cyan-300/10 blur-3xl" />
                <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-200 shadow-inner">
                      <ScrollText size={23} />
                    </span>
                    <div className="min-w-0">
                      <span className="mb-1 inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-cyan-100">گزارش محرمانه دبیرخانه</span>
                      <h3 className="font-titr text-base leading-7 text-white sm:text-lg">دفتر ثبت عهدنامه هم‌آموزی</h3>
                      <p className="mt-0.5 text-xs leading-5 text-slate-300">مشاهده و دریافت اطلاعات ثبت‌نام‌کنندگان؛ دسترسی فقط برای مدیر احراز هویت‌شده.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between xl:justify-end">
                    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2 sm:min-w-36">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-200"><UsersRound size={18} /></span>
                      <span><span className="block text-[10px] text-slate-400">مجموع ثبت‌نام‌ها</span><strong className="text-lg leading-6 text-white">{campaignPledges.length.toLocaleString('fa-IR')}</strong></span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void loadCampaignPledges()} disabled={campaignPledgesLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-500/70 bg-slate-900/70 px-3.5 text-xs font-bold text-slate-100 transition hover:border-cyan-300/50 hover:bg-slate-800 disabled:opacity-50">
                        {campaignPledgesLoading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                        تازه‌سازی فهرست
                      </button>
                      <button type="button" onClick={() => void exportCampaignPledges()} disabled={!campaignPledges.length || campaignPledgesLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200/20 bg-gradient-to-l from-emerald-500 to-teal-500 px-4 text-xs font-extrabold text-white shadow-lg shadow-emerald-950/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
                        <Download size={15} /> دریافت Excel رنگی
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {campaignPledgesError && <p role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{campaignPledgesError}</p>}
              {campaignPledgesLoading && campaignPledges.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-300"><Loader2 size={20} className="mx-auto mb-2 animate-spin text-cyan-300" />در حال دریافت فهرست امن ثبت‌نام‌ها…</div>
              ) : campaignPledges.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">هنوز ثبت‌نامی برای عهدنامه هم‌آموزی ثبت نشده است.</div>
              ) : (
                <>
                  <div className="hidden max-h-[65vh] overflow-auto lg:block">
                    <table aria-label="فهرست ثبت‌نام عهدنامه هم‌آموزی" className="dusk-table campaign-pledge-table w-full min-w-[960px] text-right text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-900">
                        <tr>
                          <th scope="col" className="w-16 text-center">ردیف</th>
                          <th scope="col">مشخصات هم‌آموز</th>
                          <th scope="col">استان / ناحیه</th>
                          <th scope="col">مقطع / مدرسه</th>
                          <th scope="col" className="pledge-phone-column">شماره همراه</th>
                          <th scope="col">زمان ثبت</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignPledges.map((row, rowIndex) => (
                          <tr key={row.id} className="transition-colors hover:bg-cyan-300/[0.045]">
                            <td className="text-center"><span className="inline-flex min-w-8 items-center justify-center rounded-lg border border-amber-200/15 bg-amber-200/[0.08] px-2 py-1 font-bold text-amber-100">{(rowIndex + 1).toLocaleString('fa-IR')}</span></td>
                            <td><strong className="block text-sm text-white">{row.fullName || '—'}</strong><span className="mt-1 inline-flex rounded-md bg-cyan-300/[0.08] px-2 py-0.5 font-mono text-[11px] text-cyan-100">{row.personnelCode?.length === 10 ? 'کد ملی' : 'کد پرسنلی'}: {row.personnelCode || '—'}</span></td>
                            <td><strong className="block text-slate-100">{row.province || '—'}</strong><span className="mt-1 block text-slate-400">{row.district || '—'}</span></td>
                            <td><strong className="block text-slate-100">{row.grade || '—'}</strong><span className="mt-1 block max-w-56 truncate text-slate-400" title={row.school || ''}>{row.school || '—'}</span></td>
                            <td className="pledge-phone-column font-mono text-cyan-100"><bdi dir="ltr">{row.phone || '—'}</bdi></td>
                            <td className="whitespace-nowrap text-slate-300">{formatPledgeDate(row.joinedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="max-h-[65vh] space-y-3 overflow-y-auto bg-gradient-to-b from-slate-950/20 to-slate-950/50 p-3 lg:hidden">
                    {campaignPledges.map((row, rowIndex) => (
                      <article key={row.id} className="rounded-2xl border border-cyan-200/10 bg-gradient-to-br from-slate-800/80 to-slate-950/80 p-3.5 shadow-lg shadow-black/10">
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.07] pb-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-300/10 text-xs font-bold text-amber-100">{(rowIndex + 1).toLocaleString('fa-IR')}</span>
                            <div className="min-w-0"><strong className="block break-words text-sm text-white">{row.fullName || '—'}</strong><span className="mt-1 block text-[10px] text-slate-400">{row.personnelCode?.length === 10 ? 'کد ملی' : 'کد پرسنلی'}: <b className="font-mono text-cyan-100">{row.personnelCode || '—'}</b></span></div>
                          </div>
                          <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.08] px-2.5 py-1 text-[10px] text-cyan-100">{row.province || '—'}</span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                          <div><dt className="text-[10px] text-slate-400">ناحیه / منطقه</dt><dd className="mt-1 break-words text-slate-100">{row.district || '—'}</dd></div>
                          <div><dt className="text-[10px] text-slate-400">مقطع</dt><dd className="mt-1 break-words text-slate-100">{row.grade || '—'}</dd></div>
                          <div><dt className="text-[10px] text-slate-400">مدرسه</dt><dd className="mt-1 break-words text-slate-100">{row.school || '—'}</dd></div>
                          <div><dt className="text-[10px] text-slate-400">شماره همراه</dt><dd className="mt-1 text-right font-mono text-slate-100"><bdi dir="ltr">{row.phone || '—'}</bdi></dd></div>
                          <div className="col-span-2 border-t border-white/[0.07] pt-2"><dt className="text-[10px] text-slate-400">زمان ثبت</dt><dd className="mt-1 text-slate-200">{formatPledgeDate(row.joinedAt)}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                  <p className="border-t border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">این فهرست محرمانه است و فقط برای مدیریت عهدنامه‌ها نمایش داده می‌شود.</p>
                </>
              )}
            </section>
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 7: LIVED EXPERIENCES CRUD                                  */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'experiences' && (
          <div className="space-y-6">
            <ExperienceInbox />
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                مجموع تجارب برگزیده: <strong className="text-white">{narratives.length}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingItem({
                    section: 'narrative',
                    isNew: true,
                    data: {
                      id: 'nar-' + Date.now(),
                      title: '',
                      author: '',
                      school: '',
                      province: 'تهران',
                      grade: 'پایه چهارم ابتدایی',
                      subject: 'ریاضیات',
                      summary: '',
                      date: 'آبان ۱۴۰۵',
                      docxUrl: '/docs/experiences/selected-experience-tehran.docx',
                      pdfUrl: '/docs/experiences/selected-experience-tehran.pdf',
                    },
                  })
                }
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-400 hover:to-rose-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن روایت تجربه زیسته جدید</span>
              </button>
            </div>

            {narratives.length === 0 ? (
              <div className="dusk-card p-10 text-center text-slate-400">
                <BookOpenCheck size={36} className="mx-auto mb-2 opacity-40 text-pink-400" />
                <p className="font-titr text-white text-base mb-1">هنوز روایت تجربه زیسته‌ای ثبت نشده است</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {narratives.map((n) => (
                  <div key={n.id} className="dusk-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-pink-400">
                          {n.province} - {n.grade}
                        </span>
                        <span className="text-xs text-slate-400">{n.date}</span>
                      </div>
                      <h3 className="font-titr text-base text-white mb-1.5">{n.title}</h3>
                      <p className="text-xs text-slate-300 mb-2">معلم: {n.author} ({n.school})</p>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3">{n.summary}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <span className="text-[11px] text-slate-500">{n.subject}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingItem({ section: 'narrative', isNew: false, data: { ...n } })}
                          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>ویرایش</span>
                        </button>
                        <button
                          onClick={() => handleDeleteNarrative(n.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 8: CLINICAL SUPERVISION CRUD                               */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'supervision' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                مجموع مستندات نظارت بالینی: <strong className="text-white">{clinicals.length}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingItem({
                    section: 'clinical',
                    isNew: true,
                    data: {
                      id: 'clin-' + Date.now(),
                      title: '',
                      role: 'ویژه راهبران و معلمان',
                      description: '',
                      pdfUrl: '',
                      docxUrl: '',
                      reportUrl: '',
                    },
                  })
                }
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن مستند نظارتی جدید</span>
              </button>
            </div>

            {clinicals.length === 0 ? (
              <div className="dusk-card p-10 text-center text-slate-400">
                <Layers size={36} className="mx-auto mb-2 opacity-40 text-cyan-400" />
                <p className="font-titr text-white text-base mb-1">هنوز مستند نظارت بالینی ثبت نشده است</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clinicals.map((c) => (
                  <div key={c.id} className="dusk-card p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 inline-block mb-2">
                        {c.role}
                      </span>
                      <h3 className="font-titr text-base text-white mb-2">{c.title}</h3>
                      <p className="text-xs text-slate-300 mb-3">{c.description}</p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                      <button
                        onClick={() => setEditingItem({ section: 'clinical', isNew: false, data: { ...c } })}
                        className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Edit3 size={14} />
                        <span>ویرایش</span>
                      </button>
                      <button
                        onClick={() => handleDeleteClinical(c.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 size={14} />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 9: CONTENT PRODUCTION & MEDIA CRUD                         */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            <section className="dusk-card overflow-hidden border border-amber-400/20">
              <div className="flex flex-col gap-3 border-b border-slate-800 bg-gradient-to-l from-amber-500/[0.09] via-slate-900 to-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-titr text-base text-white">آثار ارسالی برای بررسی دبیرخانه</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">اطلاعات هویتی و تماس این آثار فقط در پنل مدیر نمایش داده می‌شود.</p>
                </div>
                <button type="button" onClick={() => void loadContentSubmissions()} disabled={contentSubmissionsLoading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-100 transition hover:bg-slate-700 disabled:opacity-50">
                  {contentSubmissionsLoading ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                  تازه‌سازی آثار
                </button>
              </div>
              {contentSubmissionsError && <p role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{contentSubmissionsError}</p>}
              {contentSubmissionsLoading && contentSubmissions.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-300"><Loader2 size={20} className="mx-auto mb-2 animate-spin text-amber-300" />در حال دریافت آثار خصوصی…</div>
              ) : contentSubmissions.length === 0 ? (
                <div className="p-7 text-center text-sm text-slate-400">هنوز اثری برای بررسی ارسال نشده است.</div>
              ) : (
                <div className="max-h-[58vh] space-y-3 overflow-y-auto p-3 sm:p-4">
                  {contentSubmissions.map((submission) => (
                    <article key={submission.id} className="rounded-2xl border border-slate-700/80 bg-slate-950/45 p-4 shadow-lg shadow-black/10">
                      <div className="flex flex-col gap-3 border-b border-white/[0.07] pb-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-100">در انتظار بررسی</span>
                            <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.08] px-2.5 py-1 text-[10px] text-cyan-100">{submission.contentType}</span>
                          </div>
                          <h4 className="break-words text-sm font-bold leading-6 text-white">{submission.title}</h4>
                          <p className="mt-1 text-xs text-slate-400">{submission.fullName} · {submission.province} / {submission.district} · {submission.grade}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-400">{formatPledgeDate(submission.createdAt)}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">{submission.description}</p>
                      <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-white/[0.025] p-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        <div><dt className="text-[10px] text-slate-500">کد ملی</dt><dd className="mt-1 font-mono text-slate-200">{submission.nationalCode}</dd></div>
                        <div><dt className="text-[10px] text-slate-500">کد پرسنلی</dt><dd className="mt-1 font-mono text-slate-200">{submission.personnelCode}</dd></div>
                        <div><dt className="text-[10px] text-slate-500">شماره همراه</dt><dd dir="ltr" className="mt-1 text-left font-mono text-slate-200">{submission.phone}</dd></div>
                        <div className="min-w-0"><dt className="text-[10px] text-slate-500">پست الکترونیک</dt><dd className="mt-1 break-all text-slate-200">{submission.email}</dd></div>
                      </dl>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
                        <span className="break-words text-xs text-slate-400">پیوند اثر: {submission.mediaLink}</span>
                        <a href={submission.mediaLink} target="_blank" rel="noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] px-3 text-xs font-bold text-cyan-100 hover:bg-cyan-300/[0.14]">
                          <ExternalLink size={14} /> مشاهده اثر
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <p className="border-t border-slate-800 px-4 py-3 text-xs text-slate-400">نمایش {contentSubmissions.length.toLocaleString('fa-IR')} اثر اخیر؛ حداکثر ۱۰۰ مورد.</p>
            </section>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">
                مجموع رسانه‌ها و فایل‌ها: <strong className="text-white">{media.length}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setEditingItem({
                    section: 'content',
                    isNew: true,
                    data: {
                      id: 'media-' + Date.now(),
                      title: '',
                      category: 'فایل آموزشی',
                      description: '',
                      downloadUrl: '',
                      viewUrl: '',
                      badgeText: 'سند قابل دانلود',
                      fileType: 'pdf',
                    },
                  })
                }
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن محتوا / رسانه جدید</span>
              </button>
            </div>

            {media.length === 0 ? (
              <div className="dusk-card p-10 text-center text-slate-400">
                <Film size={36} className="mx-auto mb-2 opacity-40 text-amber-400" />
                <p className="font-titr text-white text-base mb-1">هنوز محتوای چندرسانه‌ای ثبت نشده است</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {media.map((m) => (
                  <div key={m.id} className="dusk-card p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                          {m.category} ({m.fileType})
                        </span>
                        <span className="text-xs text-slate-400">{m.badgeText}</span>
                      </div>
                      <h3 className="font-titr text-base text-white mb-2">{m.title}</h3>
                      <p className="text-xs text-slate-300 mb-3">{m.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <span className="text-[11px] text-slate-500 font-mono truncate max-w-[140px]">
                        {m.downloadUrl || m.viewUrl}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingItem({ section: 'content', isNew: false, data: { ...m } })}
                          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 size={14} />
                          <span>ویرایش</span>
                        </button>
                        <button
                          onClick={() => handleDeleteContent(m.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-900/40 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* TAB 10: BACKUP & SYSTEM RESET                                  */}
        {/* -------------------------------------------------------------- */}
        {activeTab === 'backup' && (
          <div className="dusk-card p-6 space-y-6">
            <h3 className="font-titr text-lg text-white pb-3 border-b border-slate-800">
              مدیریت پشتیبان و پایگاه داده
            </h3>

            {/* Neon & Blob Live Connection Status Diagnostic Card */}
            <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database size={20} className="text-sky-400" />
                  <h4 className="font-titr text-white text-base">
                    وضعیت اتصال پایگاه داده و فضای ابری در Vercel
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={refreshBackendStatus}
                  disabled={isCheckingBackend}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={13} className={isCheckingBackend ? 'animate-spin' : ''} />
                  <span>{isCheckingBackend ? 'در حال بررسی...' : 'بررسی وضعیت اتصال'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Neon DB Status */}
                <div className={`p-4 rounded-xl border ${backendStatus?.neon?.connected ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${backendStatus?.neon?.connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      پایگاه داده نئون (Neon Postgres)
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${backendStatus?.neon?.connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {backendStatus?.neon?.connected ? 'متصل و فعال ✓' : 'اتصال برقرار نیست'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {backendStatus?.neon?.connected
                      ? `ارتباط با پایگاه داده نئون با موفقیت برقرار است و تغییرات در جدول site_settings ذخیره می‌شوند.`
                      : backendStatus?.neon?.error || 'رشته اتصال نئون (POSTGRES_URL) در متغیرهای پروژه ورسل یافت نشد.'}
                  </p>
                </div>

                {/* Vercel Blob Status */}
                <div className={`p-4 rounded-xl border ${backendStatus?.blob?.configured ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800 border-slate-700'} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${backendStatus?.blob?.configured ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                      فضای ابری ذخیره فایل (Vercel Blob)
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${backendStatus?.blob?.configured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                      {backendStatus?.blob?.configured ? 'تنظیمات شناسایی شد' : 'تنظیمات یافت نشد'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {backendStatus?.blob?.configured
                      ? 'تنظیمات Blob شناسایی شد؛ این نشانگر به‌تنهایی سلامت اتصال یا نوع دسترسی Store را تأیید نمی‌کند.'
                      : 'تنظیمات Blob شناسایی نشد؛ بارگذاری فایل ممکن است ناموفق باشد.'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-700 text-xs text-slate-300 leading-6">
                <strong className="text-amber-200">سهمیه Neon و Blob: نامشخص</strong>
                <p>این سامانه به آمار مصرف حساب متصل نیست و هشدار خودکار نزدیک‌شدن به سهمیه ندارد. تا زمان اتصال امن، مصرف و اعلان‌ها را در داشبورد خود Neon و Vercel بررسی کنید.</p>
              </div>

              {/* Troubleshooting Note if not connected */}
              {(!backendStatus?.neon?.connected || !backendStatus?.blob?.configured) && (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
                  <div className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span>راهنمای اتصال کامل دیتابیس نئون و بالب در پنل Vercel:</span>
                  </div>
                  <ol className="list-decimal list-inside text-slate-300 space-y-1 leading-relaxed pr-2">
                    <li>وارد داشبورد پروژه خود در سایت <strong>vercel.com</strong> شوید.</li>
                    <li>به تب <strong>Storage</strong> بروید و دیتابیس نئون (Neon) و استورج بالب (Blob) ایجادشده را انتخاب کنید.</li>
                    <li>دکمه <strong>Connect Project</strong> را بزنید و این پروژه را انتخاب نمایید تا متغیر <code>POSTGRES_URL</code> متصل شود.</li>
                    <li>سپس در تب <strong>Deployments</strong> روی آخرین دیپلوی کلیک کرده و گزینه <strong>Redeploy</strong> را بزنید تا تنظیمات در سرور فعال گردند.</li>
                  </ol>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Export */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h4 className="font-titr text-white text-base mb-2">دانلود نسخه پشتیبان (JSON)</h4>
                  <p className="text-xs text-slate-300 mb-4">
                    از کلیه تنظیمات، وبینارها، بخشنامه‌ها، تجارب زیسته و باکس‌ها نسخه کامل تهیه کنید.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full py-2.5 px-3 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download size={15} />
                  <span>دانلود فایل پشتیبان</span>
                </button>
              </div>

              {/* Import */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                <div>
                  <h4 className="font-titr text-white text-base mb-2">بازیابی از فایل پشتیبان</h4>
                  <p className="text-xs text-slate-300 mb-4">
                    فایل پشتیبان ذخیره‌شده را بارگذاری کنید تا تمامی محتوا و تنظیمات درجا اعمال گردند.
                  </p>
                </div>
                <label className="w-full py-2.5 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer">
                  <Upload size={15} />
                  <span>انتخاب فایل JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* ================================================================ */}
      {/* GENERIC EDIT/ADD MODAL FOR ITEMS (افزودن و ویرایش)                */}
      {/* ================================================================ */}
      {attendanceWebinar && <WebinarAttendanceDialog webinar={attendanceWebinar} onClose={() => setAttendanceWebinar(null)} onAuthExpired={() => { setAttendanceWebinar(null); setIsAuthenticated(false) }} notify={notify} />}

      {editingItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingItem(null)}
        >
          <div
            className="dusk-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="font-titr text-lg text-white">
                {editingItem.isNew ? 'افزودن مورد جدید' : 'ویرایش اطلاعات'}
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Webinar Edit Form */}
            {editingItem.section === 'webinar' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSaveWebinar(editingItem.data)
                }}
                className="space-y-4"
              >
                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">عنوان وبینار:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.data.title}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, title: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">نام مدرس:</label>
                    <input
                      type="text"
                      required
                      value={editingItem.data.speaker}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, speaker: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">سمت و مرتبه علمی:</label>
                    <input
                      type="text"
                      value={editingItem.data.role}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, role: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">تاریخ وبینار (شمسی):</label>
                    <JalaliDateInput
                      value={editingItem.data.date || ''}
                      onChange={(date) => setEditingItem({ ...editingItem, data: { ...editingItem.data, date } })}
                      ariaLabel="تاریخ وبینار به تقویم شمسی"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">ساعت برگزاری:</label>
                    <input
                      type="text"
                      value={editingItem.data.time}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, time: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">وضعیت رویداد:</label>
                    <select
                      value={editingItem.data.status}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, status: e.target.value as any },
                        })
                      }
                      className="dusk-input"
                    >
                      <option value="upcoming">در پیش‌رو</option>
                      <option value="recorded">برگزار شده / آرشیو ضبط‌شده</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">توضیحات و سرفصل‌ها:</label>
                  <textarea
                    rows={3}
                    value={editingItem.data.description}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, description: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="space-y-4 pt-2">
                  <h4 className="text-xs font-titr text-sky-400 border-b border-slate-800 pb-2">
                    {editingItem.data.status === 'upcoming'
                      ? 'وبینار پیش‌رو: پوستر و پیوند برگزاری نشست'
                      : 'مستندات وبینار برگزارشده (پوستر، فایل‌های ارائه، حاضران، ضبط و گواهی)'}
                  </h4>

                  {/* 1. پوستر وبینار - آپلود و تبدیل خودکار به WebP */}
                  <div className="border border-slate-800/80 bg-slate-900/50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-sky-300 font-bold flex items-center gap-1.5">
                        <ImageIcon size={15} />
                        <span>۱. آپلود پوستر وبینار (ذخیره‌سازی خودکار به فرمت بهینه WebP):</span>
                      </label>
                      {editingItem.data.posterUrl && (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          پوستر به فرمت WebP آماده است
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <label className="cursor-pointer px-4 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 text-xs font-bold transition flex items-center gap-1.5 shrink-0">
                        {uploadingField === 'posterUrl' ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <UploadCloud size={15} />
                        )}
                        <span>{uploadingField === 'posterUrl' ? 'در حال بهینه‌سازی WebP...' : 'انتخاب و آپلود پوستر'}</span>
                        <input
                          type="file"
                          accept="image/*,.jpg,.jpeg,.png,.webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleWebinarPosterUpload(f)
                          }}
                        />
                      </label>

                      {editingItem.data.posterUrl ? (
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                          <img
                            src={editingItem.data.posterUrl}
                            alt="پیش‌نمایش پوستر"
                            className="w-10 h-10 object-cover rounded-md border border-slate-700 shrink-0"
                          />
                          <span className="text-xs text-slate-300 font-mono truncate flex-1">
                            {editingItem.data.posterFileName || 'poster.webp'}
                          </span>
                          <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded border border-sky-500/30 font-mono">
                            WebP
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingItem({
                                ...editingItem,
                                data: { ...editingItem.data, posterUrl: '', posterFileName: '' },
                              })
                            }
                            className="text-xs text-red-400 hover:text-red-300 p-1 cursor-pointer shrink-0"
                            title="حذف پوستر"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">هنوز فایلی برای پوستر انتخاب نشده است</span>
                      )}
                    </div>
                  </div>

                  {editingItem.data.status === 'upcoming' ? (
                    <>
                    <div className="border border-sky-500/30 bg-sky-500/5 p-4 rounded-xl">
                      <label className="text-xs text-sky-300 font-bold block mb-1.5 flex items-center gap-1.5">
                        <LinkIcon size={15} />
                        <span>۲. لینک برگزاری نشست (برای شرکت‌کنندگان):</span>
                      </label>
                      <input
                        type="url"
                        value={editingItem.data.meetingUrl || ''}
                        onChange={event => setEditingItem({ ...editingItem, data: { ...editingItem.data, meetingUrl: event.target.value } })}
                        placeholder="https://… لینک ورود به جلسه"
                        className="dusk-input font-mono text-sm text-left"
                        dir="ltr"
                      />
                      <span className="text-[11px] text-slate-400 mt-1.5 block">این پیوند در کارت وبینار پیش‌رو برای مخاطبان نمایش داده می‌شود.</span>
                    </div>

                    <div className="border border-cyan-500/30 bg-cyan-500/5 p-4 rounded-xl space-y-3">
                      <div>
                        <label className="text-xs text-cyan-200 font-bold block">۳. بازه زمانی ثبت حضور:</label>
                        <p className="text-[11px] text-slate-400 mt-1">زمان‌ها به وقت ایران (تهران) هستند. پیش از شروع و پس از پایان، فرم عمومی بسته خواهد بود.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
                          <span className="text-[11px] font-bold text-emerald-300">شروع ثبت حضور</span>
                          <JalaliDateInput
                            value={editingItem.data.attendanceStartDate || ''}
                            onChange={date => setEditingItem({ ...editingItem, data: { ...editingItem.data, attendanceStartDate: date } })}
                            placeholder="تاریخ شروع (شمسی)"
                            ariaLabel="تاریخ شروع ثبت حضور به تقویم شمسی"
                          />
                          <input
                            type="time"
                            value={editingItem.data.attendanceStartTime || ''}
                            onChange={event => setEditingItem({ ...editingItem, data: { ...editingItem.data, attendanceStartTime: event.target.value } })}
                            className="dusk-input text-left"
                            dir="ltr"
                            aria-label="ساعت شروع ثبت حضور به وقت تهران"
                          />
                        </div>
                        <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3 space-y-2">
                          <span className="text-[11px] font-bold text-rose-300">پایان ثبت حضور</span>
                          <JalaliDateInput
                            value={editingItem.data.attendanceEndDate || ''}
                            onChange={date => setEditingItem({ ...editingItem, data: { ...editingItem.data, attendanceEndDate: date } })}
                            placeholder="تاریخ پایان (شمسی)"
                            ariaLabel="تاریخ پایان ثبت حضور به تقویم شمسی"
                          />
                          <input
                            type="time"
                            value={editingItem.data.attendanceEndTime || ''}
                            onChange={event => setEditingItem({ ...editingItem, data: { ...editingItem.data, attendanceEndTime: event.target.value } })}
                            className="dusk-input text-left"
                            dir="ltr"
                            aria-label="ساعت پایان ثبت حضور به وقت تهران"
                          />
                        </div>
                      </div>
                      <span className="block text-[11px] text-cyan-100/70">برای فعال‌شدن فرم، تاریخ و ساعت هر دو بخش را تعیین و وبینار را ذخیره کنید.</span>
                    </div>
                    </>
                  ) : (
                    <>
                  {/* 2. فایل‌های ارائه و اسلایدها - بدون محدودیت تعداد */}
                  <div className="border border-slate-800/80 bg-slate-900/50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-emerald-300 font-bold flex items-center gap-1.5">
                        <FileStack size={15} />
                        <span>۲. فایل‌های ارائه و اسلایدها (بدون محدودیت در تعداد فایل - PDF, PPTX, DOCX):</span>
                      </label>
                      {editingItem.data.contentFiles?.length > 0 && (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          تعداد {editingItem.data.contentFiles.length} فایل بارگذاری شده
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer px-4 py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 shrink-0">
                          {uploadingField === 'presentationFiles' ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <UploadCloud size={15} />
                          )}
                          <span>{uploadingField === 'presentationFiles' ? 'در حال افزودن فایل‌ها...' : 'افزودن فایل‌های ارائه (تک یا چندتایی)'}</span>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.pptx,.ppt,.docx"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleAddPresentationFiles(e.target.files)
                              }
                            }}
                          />
                        </label>
                        <span className="text-[11px] text-slate-400">
                          می‌توانید همزمان چندین فایل اسلاید، کتابچه یا فایل پی‌دی‌اف انتخاب کنید.
                        </span>
                      </div>

                      {/* Presentation files list */}
                      {editingItem.data.contentFiles && editingItem.data.contentFiles.length > 0 ? (
                        <div className="space-y-2 mt-2 max-h-48 overflow-y-auto pr-1">
                          {editingItem.data.contentFiles.map((file: WebinarContentFile, idx: number) => (
                            <div
                              key={file.id || idx}
                              className="flex items-center justify-between gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText size={16} className="text-emerald-400 shrink-0" />
                                <input
                                  type="text"
                                  value={file.title}
                                  onChange={(e) => {
                                    const updated = [...editingItem.data.contentFiles]
                                    updated[idx] = { ...updated[idx], title: e.target.value }
                                    setEditingItem({
                                      ...editingItem,
                                      data: { ...editingItem.data, contentFiles: updated },
                                    })
                                  }}
                                  placeholder="عنوان فایل ارائه"
                                  className="dusk-input py-1 text-xs flex-1"
                                />
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                                  {file.fileType}
                                </span>
                                {file.fileSize && (
                                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                                    {file.fileSize}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemovePresentationFile(file.id)}
                                className="text-red-400 hover:text-red-300 p-1 cursor-pointer shrink-0"
                                title="حذف این فایل"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 block">هنوز فایل ارائه‌ای بارگذاری نشده است.</span>
                      )}
                    </div>
                  </div>

                  {/* 3. فایل حضور و غیاب / اکسل حاضران */}
                  <div className="border border-slate-800/80 bg-slate-900/50 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-purple-300 font-bold flex items-center gap-1.5">
                        <FileSpreadsheet size={15} />
                        <span>۳. آپلود فایل اکسل حضور و غیاب (تحلیل اسامی و استان‌ها):</span>
                      </label>
                      {editingItem.data.attendeesList?.length > 0 && (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-bold">
                          <CheckCircle2 size={13} />
                          {editingItem.data.attendeesList.length} شرکت‌کننده استخراج شد
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <label className="cursor-pointer px-4 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-bold transition flex items-center gap-1.5 shrink-0">
                        {uploadingField === 'attendeesExcelUrl' ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <UploadCloud size={15} />
                        )}
                        <span>{uploadingField === 'attendeesExcelUrl' ? 'در حال خواندن اکسل...' : 'انتخاب و آپلود فایل اکسل'}</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleWebinarExcelUpload(f)
                          }}
                        />
                      </label>

                      {editingItem.data.attendeesFileName ? (
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                          <FileSpreadsheet size={20} className="text-purple-400 shrink-0" />
                          <span className="text-xs text-slate-300 font-mono truncate flex-1">
                            {editingItem.data.attendeesFileName}
                          </span>
                          <span className="text-[11px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 shrink-0">
                            {editingItem.data.attendeesList?.length || 0} نفر
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingItem({
                                ...editingItem,
                                data: {
                                  ...editingItem.data,
                                  attendeesExcelUrl: '',
                                  attendeesFileName: '',
                                  attendeesList: [],
                                },
                              })
                            }
                            className="text-xs text-red-400 hover:text-red-300 p-1 cursor-pointer shrink-0"
                            title="حذف فایل اکسل"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">فایل اکسل ثبت‌نام یا حضور و غیاب (استخراج خودکار نام و نام خانوادگی و استان)</span>
                      )}
                    </div>
                  </div>

                  {/* 4. لینک ویدیوی ضبط‌شده - فقط لینک (مطابق درخواست کاربر) */}
                  <div className="border border-slate-800/80 bg-slate-900/50 p-4 rounded-xl">
                    <label className="text-xs text-amber-300 font-bold block mb-1.5 flex items-center gap-1.5">
                      <Video size={15} />
                      <span>۴. لینک ویدیوی ضبط‌شده (فقط پیوند ابری / آپارات / اسکای‌روم):</span>
                    </label>
                    <div className="relative">
                      <input
                        type="url"
                        value={editingItem.data.recordedVideoUrl || ''}
                        onChange={(e) =>
                          setEditingItem({
                            ...editingItem,
                            data: { ...editingItem.data, recordedVideoUrl: e.target.value },
                          })
                        }
                        placeholder="https://www.aparat.com/v/... یا لینک مستقیم ویدیو"
                        className="dusk-input font-mono text-xs pl-8 text-left"
                        dir="ltr"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
                        <LinkIcon size={14} />
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 mt-1.5 block">
                      * با کلیک مخاطبان، این ویدیو در مینی‌پنجره اختصاصی درون‌سایت پخش خواهد شد.
                    </span>
                  </div>

                  {/* 5. تنظیمات صدور گواهی با قالب ثابت خصوصی */}
                  <div className="border border-amber-500/30 bg-amber-500/5 p-4 rounded-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <label className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                        <Award size={16} />
                        <span>۵. تنظیمات صدور گواهی حضور</span>
                      </label>
                      <span className="text-[11px] text-emerald-300 font-bold">قالب ثابت و خصوصی دبیرخانه</span>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      عنوان قرمز گواهی از «عنوان وبینار» بالای فرم گرفته می‌شود. تاریخ و شماره زیر فقط سربرگ را تغییر می‌دهند؛ تاریخ داخل متن گواهی خودکار از تاریخ همین وبینار گرفته می‌شود و روز آن با حروف فارسی درج خواهد شد. مشخصات حاضران از فایل Excel همین وبینار خوانده می‌شوند.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="form-group min-w-0">
                        <label className="text-xs text-slate-300 font-bold block mb-1">تاریخ سربرگ گواهی:</label>
                        <JalaliDateInput
                          value={editingItem.data.certificateIssueDate || ''}
                          onChange={(date) => setEditingItem({ ...editingItem, data: { ...editingItem.data, certificateIssueDate: date } })}
                          placeholder="انتخاب تاریخ سربرگ"
                          ariaLabel="تاریخ سربرگ گواهی"
                        />
                      </div>
                      <div className="form-group min-w-0">
                        <label className="text-xs text-slate-300 font-bold block mb-1">شماره نامه:</label>
                        <input
                          type="text"
                          dir="rtl"
                          value={editingItem.data.certificateLetterNumber || ''}
                          onChange={(e) =>
                            setEditingItem({
                              ...editingItem,
                              data: { ...editingItem.data, certificateLetterNumber: e.target.value },
                            })
                          }
                          placeholder="شماره نامه دبیرخانه"
                          className="dusk-input"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                      فایل Excel حاضران همچنان از بخش بالای همین فرم بارگذاری می‌شود و فقط برای مدیر قابل‌دسترسی است؛ قالب نمونه دارای اطلاعات شخصی در مسیر عمومی قرار نمی‌گیرد.
                    </p>
                  </div>
                    </>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(uploadingField)}
                    className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold"
                  >
                    ذخیره و ثبت
                  </button>
                </div>
              </form>
            )}

            {/* In-Person Edit Form */}
            {editingItem.section === 'inperson' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSaveInPerson(editingItem.data)
                }}
                className="space-y-4"
              >
                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">عنوان رویداد حضوری:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.data.title}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, title: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">استان:</label>
                    <input
                      type="text"
                      required
                      value={editingItem.data.province}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, province: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">شهر / منطقه:</label>
                    <input
                      type="text"
                      value={editingItem.data.city}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, city: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">محل و سالن:</label>
                    <input
                      type="text"
                      value={editingItem.data.venue}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, venue: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">تاریخ و ساعت:</label>
                    <JalaliDateInput
                      value={editingItem.data.date || ''}
                      onChange={(date) => setEditingItem({ ...editingItem, data: { ...editingItem.data, date } })}
                      placeholder="انتخاب تاریخ شمسی؛ ساعت را در ادامه بنویسید"
                      readOnly={false}
                      preserveSuffix
                      ariaLabel="تاریخ شمسی و ساعت نشست حضوری"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">لینک پوستر:</label>
                    <input
                      type="text"
                      value={editingItem.data.posterUrl}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, posterUrl: e.target.value },
                        })
                      }
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">لینک بخشنامه (اختیاری):</label>
                    <input
                      type="text"
                      value={editingItem.data.circularUrl || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, circularUrl: e.target.value },
                        })
                      }
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">لینک محتوا (PDF):</label>
                    <input
                      type="text"
                      value={editingItem.data.contentUrl}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, contentUrl: e.target.value },
                        })
                      }
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-lime-500 hover:bg-lime-400 text-slate-950 text-xs font-bold"
                  >
                    ذخیره و ثبت
                  </button>
                </div>
              </form>
            )}

            {/* Circular Edit Form */}
            {editingItem.section === 'circular' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!editingItem.data.pdfFile) {
                    notify('پیش از ثبت، فایل PDF را بارگذاری کنید یا پیوند فایل را وارد فرمایید.')
                    return
                  }
                  handleSaveCircular(editingItem.data)
                }}
                className="space-y-4"
              >
                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">عنوان بخشنامه یا فراخوان:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.data.title}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, title: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">شماره بخشنامه:</label>
                    <input
                      type="text"
                      value={editingItem.data.number}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, number: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">تاریخ ابلاغ:</label>
                    <JalaliDateInput
                      value={editingItem.data.date || ''}
                      onChange={(date) => setEditingItem({ ...editingItem, data: { ...editingItem.data, date } })}
                      ariaLabel="تاریخ ابلاغ شمسی"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">دسته‌بندی:</label>
                    <select
                      value={editingItem.data.category}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, category: e.target.value as any },
                        })
                      }
                      className="dusk-input"
                    >
                      <option value="شیوه‌نامه">شیوه‌نامه</option>
                      <option value="بخشنامه">بخشنامه</option>
                      <option value="فراخوان">فراخوان</option>
                      <option value="تقویم اجرایی">تقویم اجرایی</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">خلاصه مفاد:</label>
                  <textarea
                    rows={3}
                    value={editingItem.data.summary}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, summary: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="form-group space-y-2">
                  <label className="text-xs text-slate-300 font-bold block">بارگذاری فایل PDF بخشنامه (حداکثر ۴ مگابایت):</label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 text-xs font-bold text-violet-100 hover:bg-violet-500/15 ${uploadingField === 'circularPdf' ? 'opacity-60' : ''}`}>
                      {uploadingField === 'circularPdf' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                      <span>{uploadingField === 'circularPdf' ? 'در حال بارگذاری PDF…' : 'انتخاب و آپلود PDF'}</span>
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        disabled={Boolean(uploadingField)}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) void handleCircularPdfUpload(file)
                          event.currentTarget.value = ''
                        }}
                      />
                    </label>
                    {editingItem.data.pdfFileName && (
                      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                        <CheckCircle2 size={15} className="shrink-0" />
                        <span className="truncate">{editingItem.data.pdfFileName}</span>
                        <button
                          type="button"
                          aria-label="حذف فایل PDF انتخاب‌شده"
                          onClick={() => setEditingItem({ ...editingItem, data: { ...editingItem.data, pdfFile: '', pdfFileName: '', pdfDownloadUrl: '' } })}
                          className="rounded p-1 text-red-300 hover:bg-red-500/10"
                        ><X size={14} /></button>
                      </div>
                    )}
                  </div>
                  <label className="text-[11px] text-slate-400 block">یا پیوند فایل PDF از قبل بارگذاری‌شده:</label>
                  <input
                    type="text"
                    value={editingItem.data.pdfFile}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      data: {
                        ...editingItem.data,
                        pdfFile: e.target.value,
                        pdfFileName: editingItem.data.pdfFileName && e.target.value !== editingItem.data.pdfFile ? '' : editingItem.data.pdfFileName,
                        pdfDownloadUrl: e.target.value !== editingItem.data.pdfFile ? '' : editingItem.data.pdfDownloadUrl,
                      },
                    })}
                    placeholder="https://…/document.pdf"
                    className="dusk-input font-mono text-xs"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-xs font-bold"
                  >
                    ذخیره و ثبت
                  </button>
                </div>
              </form>
            )}

            {/* Narrative / Lived Experience Edit Form */}
            {editingItem.section === 'narrative' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSaveNarrative(editingItem.data)
                }}
                className="space-y-4"
              >
                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">عنوان تجربه زیسته:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.data.title}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, title: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">نام معلم / نویسنده:</label>
                    <input
                      type="text"
                      required
                      value={editingItem.data.author}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, author: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">مدرسه:</label>
                    <input
                      type="text"
                      value={editingItem.data.school}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, school: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">استان:</label>
                    <input
                      type="text"
                      value={editingItem.data.province}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, province: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">چکیده تجربه:</label>
                  <textarea
                    rows={3}
                    value={editingItem.data.summary}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, summary: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">لینک فایل Word (.docx):</label>
                    <input
                      type="text"
                      value={editingItem.data.docxUrl}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, docxUrl: e.target.value },
                        })
                      }
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">لینک فایل PDF:</label>
                    <input
                      type="text"
                      value={editingItem.data.pdfUrl}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, pdfUrl: e.target.value },
                        })
                      }
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-white text-xs font-bold"
                  >
                    ذخیره و ثبت
                  </button>
                </div>
              </form>
            )}

            {/* Clinical Deliverable Form */}
            {editingItem.section === 'clinical' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (uploadingField) return
                  handleSaveClinical(editingItem.data)
                }}
                className="space-y-4"
              >
                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">عنوان سند نظارتی:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.data.title}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, title: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">نقش هدف / مخاطب:</label>
                  <input
                    type="text"
                    value={editingItem.data.role}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, role: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">توضیحات سند:</label>
                  <textarea
                    rows={3}
                    value={editingItem.data.description}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, description: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group space-y-2">
                    <label htmlFor="clinical-pdf-upload" className="text-xs text-slate-300 font-bold block">فایل PDF نظارت بالینی:</label>
                    <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/[0.14] ${uploadingField === 'clinicalPdf' ? 'opacity-60' : ''}`}>
                      {uploadingField === 'clinicalPdf' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                      <span>{uploadingField === 'clinicalPdf' ? 'در حال بارگذاری PDF…' : 'انتخاب و آپلود PDF'}</span>
                      <input
                        id="clinical-pdf-upload"
                        type="file"
                        accept="application/pdf,.pdf"
                        className="sr-only"
                        disabled={Boolean(uploadingField)}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          if (file) void handleClinicalDocumentUpload('pdfUrl', file)
                        }}
                      />
                    </label>
                    <p className="text-xs text-slate-400">{editingItem.data.pdfFileName || (editingItem.data.pdfUrl ? 'پیوند PDF ثبت شده است' : 'فایلی انتخاب نشده است')} · حداکثر ۴ مگابایت</p>
                    {editingItem.data.pdfUrl && <a href={editingItem.data.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm text-cyan-200 underline">مشاهده فایل PDF</a>}
                    <label className="text-xs text-slate-400 block pt-1">یا پیوند مستقیم PDF موجود:</label>
                    <input
                      type="url"
                      aria-label="پیوند مستقیم PDF نظارت بالینی"
                      value={editingItem.data.pdfUrl || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, pdfUrl: e.target.value, pdfFileName: '' } })}
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                  <div className="form-group space-y-2">
                    <label htmlFor="clinical-docx-upload" className="text-xs text-slate-300 font-bold block">فایل Word نظارت بالینی (DOCX):</label>
                    <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-300/25 bg-blue-300/[0.08] px-4 text-sm font-bold text-blue-100 transition hover:bg-blue-300/[0.14] ${uploadingField === 'clinicalDocx' ? 'opacity-60' : ''}`}>
                      {uploadingField === 'clinicalDocx' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                      <span>{uploadingField === 'clinicalDocx' ? 'در حال بارگذاری Word…' : 'انتخاب و آپلود Word'}</span>
                      <input
                        id="clinical-docx-upload"
                        type="file"
                        accept="application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                        className="sr-only"
                        disabled={Boolean(uploadingField)}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          if (file) void handleClinicalDocumentUpload('docxUrl', file)
                        }}
                      />
                    </label>
                    <p className="text-xs text-slate-400">{editingItem.data.docxFileName || (editingItem.data.docxUrl ? 'پیوند Word ثبت شده است' : 'فایلی انتخاب نشده است')} · حداکثر ۴ مگابایت</p>
                    {editingItem.data.docxUrl && <a href={editingItem.data.docxUrl} target="_blank" rel="noreferrer" className="inline-flex text-sm text-blue-200 underline">مشاهده فایل Word</a>}
                    <label className="text-xs text-slate-400 block pt-1">یا پیوند مستقیم Word موجود:</label>
                    <input
                      type="url"
                      aria-label="پیوند مستقیم Word نظارت بالینی"
                      value={editingItem.data.docxUrl || ''}
                      onChange={(e) => setEditingItem({ ...editingItem, data: { ...editingItem.data, docxUrl: e.target.value, docxFileName: '' } })}
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(uploadingField)}
                    className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ذخیره و ثبت
                  </button>
                </div>
              </form>
            )}

            {/* Content Media Form */}
            {editingItem.section === 'content' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSaveContent(editingItem.data)
                }}
                className="space-y-4"
              >
                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">عنوان محتوا:</label>
                  <input
                    type="text"
                    required
                    value={editingItem.data.title}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, title: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">دسته‌بندی:</label>
                    <select
                      value={editingItem.data.category}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, category: e.target.value as any },
                        })
                      }
                      className="dusk-input"
                    >
                      <option value="عکس">عکس و گزارش تصویری</option>
                      <option value="اینفوگراف">اینفوگرافیک</option>
                      <option value="ویدیو ابری">ویدیوهای بارگذاری‌شده ابری</option>
                      <option value="فایل آموزشی">فایل‌های آموزشی (ورد، PDF، PPT)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">فرمت فایل:</label>
                    <select
                      value={editingItem.data.fileType}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, fileType: e.target.value as any },
                        })
                      }
                      className="dusk-input"
                    >
                      <option value="pdf">پی‌دی‌اف (PDF)</option>
                      <option value="docx">ورد (DOCX)</option>
                      <option value="pptx">پاورپوینت (PPTX)</option>
                      <option value="jpg">تصویر (JPG / PNG)</option>
                      <option value="cloud-link">پیوند فضای ابری (Cloud Link)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">توضیحات محتوا:</label>
                  <textarea
                    rows={3}
                    value={editingItem.data.description}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, description: e.target.value },
                      })
                    }
                    className="dusk-input"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">لینک دانلود مستقیم:</label>
                    <input
                      type="text"
                      value={editingItem.data.downloadUrl || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, downloadUrl: e.target.value },
                        })
                      }
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">لینک مشاهده / فضای ابری:</label>
                    <input
                      type="text"
                      value={editingItem.data.viewUrl || ''}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, viewUrl: e.target.value },
                        })
                      }
                      className="dusk-input font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                  >
                    ذخیره و ثبت
                  </button>
                </div>
              </form>
            )}

            {/* Campaign Province Team Form */}
            {editingItem.section === 'team' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (uploadingField) return
                  handleSaveTeam(editingItem.data)
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">نام استان:</label>
                    <input
                      type="text"
                      required
                      value={editingItem.data.province}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, province: e.target.value },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="text-xs text-slate-300 font-bold block mb-1">تعداد تیم‌های فعال:</label>
                    <input
                      type="number"
                      required
                      value={editingItem.data.teamCount}
                      onChange={(e) =>
                        setEditingItem({
                          ...editingItem,
                          data: { ...editingItem.data, teamCount: Number(e.target.value) },
                        })
                      }
                      className="dusk-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="text-xs text-slate-300 font-bold block mb-1">لینک فایل اکسل مشخصات تیم‌ها:</label>
                  <input
                    type="text"
                    value={editingItem.data.excelUrl}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        data: { ...editingItem.data, excelUrl: e.target.value },
                      })
                    }
                    className="dusk-input font-mono text-xs"
                  />
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={Boolean(uploadingField)}
                    className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ذخیره و ثبت
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
