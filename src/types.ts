import type {
  HubBox,
  WebinarItem,
  InPersonEvent,
  CircularItem,
  ProvinceTeamsData,
  CampaignPublicFile,
  NarrativeSample,
  ContentMediaItem,
  WebinarContentFile,
  WebinarAttendee,
} from './data.js'

export type { WebinarContentFile, WebinarAttendee }

export type PageRoute =
  | 'home'
  | 'webinars'
  | 'in-person'
  | 'circulars'
  | 'campaign'
  | 'lived-experiences'
  | 'clinical-supervision'
  | 'content-production'
  | 'book-reading'
  | 'admin'
  | 'ostan'
  | 'province'

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

export type ProvinceContentSectionId = HubBox['id'] | 'book-reading'

export interface ProvinceAttachment {
  id: string
  label: string
  fileName: string
  access: 'public' | 'private'
  url?: string
  pathname?: string
  contentType?: string
  publishable?: boolean
}

export interface ProvinceContentRecord {
  id: string
  provinceId: string
  provinceName: string
  sectionId: ProvinceContentSectionId
  title: string
  description: string
  date?: string
  /** Full internal detail for daily activity reports and book-club session notes. */
  internalDetails?: string
  recordType?: 'content' | 'daily-activity'
  attachments?: ProvinceAttachment[]
  /** Legacy single-attachment fields kept for older provincial records. */
  attachmentUrl?: string
  attachmentName?: string
  linkUrl?: string
  createdAt: string
  reviewStatus?: 'pending' | 'approved' | 'rejected' | 'published'
  reviewNote?: string
  reviewedAt?: string
  revision?: string
}

export interface HomepageSettings {
  siteTitle: string
  sectionTitle: string
  footerTagline: string
  hubBoxes: HubBox[]
  // Dynamic collections manageable from Admin Panel:
  webinars?: WebinarItem[]
  inPersonEvents?: InPersonEvent[]
  circulars?: CircularItem[]
  provinceTeams?: ProvinceTeamsData[]
  campaignPdf?: CampaignPublicFile
  campaignFiles?: CampaignPublicFile[]
  narratives?: NarrativeSample[]
  contentMedia?: ContentMediaItem[]
  clinicalItems?: ClinicalItemData[]
  provinceContent?: ProvinceContentRecord[]
}

export type Modal =
  | { type: 'search' | 'library' | 'about' | 'submit' | 'dashboard' | 'faq' }
  | { type: 'article' | 'resource' | 'event'; id: string }
  | null

export interface Experience {
  id: string
  name: string
  nationalCode?: string
  personnelCode?: string
  serviceYears?: number
  school: string
  province: string
  district?: string
  phone?: string
  email: string
  kind: string
  title: string
  summary: string
  fileName: string
  fileUrl?: string
  fileUploadToken?: string
  savedAt: string
}

export interface InPersonRegistration {
  id: string
  eventId: string
  fullName: string
  nationalCode: string
  phone: string
  school: string
  province: string
  registeredAt: string
}

export interface CampaignPledge {
  id: string
  fullName: string
  personnelCode: string
  province: string
  grade: string
  district: string
  phone: string
  school: string
  pledgeText: string
  joinedAt: string
}
