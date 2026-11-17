import './province-public.css'
import { publicProvinceRecords } from '@/lib/province-moderation'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpLeft, Loader2, X } from 'lucide-react'
import { HubBoxes } from '@/components/site/hub-boxes'
import { ProvincePublishedItems } from '@/components/site/province-published-items'
import { defaultHomepageSettings, type HubBox } from '@/src/data'
import { externalizeDataUrls, fetchServerSettings, saveServerSettings } from '@/lib/api-client'
import { PageTransitionStage, preloadTransitionParts } from '@/components/ui/page-transition-stage'
import type { PageRoute, HomepageSettings, ProvinceContentRecord } from '@/src/types'

const ProvincesDirectory = lazy(() => import('@/components/site/provinces-directory').then(module => ({ default: module.ProvincesDirectory })))
const ProvincePublicPage = lazy(() => import('@/components/pages/province-public-page').then(module => ({ default: module.ProvincePublicPage })))

const HomeHero = lazy(() => import('@/components/site/home-hero').then(module => ({ default: module.HomeHero })))
const WebinarsPage = lazy(() => import('@/components/pages/webinars-page').then(module => ({ default: module.WebinarsPage })))
const InPersonPage = lazy(() => import('@/components/pages/in-person-page').then(module => ({ default: module.InPersonPage })))
const CircularsPage = lazy(() => import('@/components/pages/circulars-page').then(module => ({ default: module.CircularsPage })))
const CampaignPage = lazy(() => import('@/components/pages/campaign-page').then(module => ({ default: module.CampaignPage })))
const LivedExperiencesPage = lazy(() => import('@/components/pages/lived-experiences-page').then(module => ({ default: module.LivedExperiencesPage })))
const ClinicalSupervisionPage = lazy(() => import('@/components/pages/clinical-supervision-page').then(module => ({ default: module.ClinicalSupervisionPage })))
const ContentProductionPage = lazy(() => import('@/components/pages/content-production-page').then(module => ({ default: module.ContentProductionPage })))
const BookReadingPage = lazy(() => import('@/components/pages/book-reading-page').then(module => ({ default: module.BookReadingPage })))
const AdminPage = lazy(() => import('@/components/pages/admin-page').then(module => ({ default: module.AdminPage })))
const OstanPage = lazy(() => import('@/components/pages/ostan-page').then(module => ({ default: module.OstanPage })))

const RouteLoading = () => (
  <div className="route-loading" role="status" aria-live="polite">
    <Loader2 size={20} className="animate-spin" aria-hidden="true" />
    <span>در حال آماده‌سازی صفحه…</span>
  </div>
)

function registrationIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/webinar-registration\/([^/]+)\/?$/i)
  if (!match) return null
  try { return decodeURIComponent(match[1]) } catch { return null }
}

const stripRemovedAdminSettings = <T extends object>(value: T): T => {
  const clean = { ...value } as Record<string, unknown>
  for (const key of ['announcementActive', 'announcementText', 'siteSubtitle', 'ministryTitle', 'sectionEyebrow']) {
    delete clean[key]
  }
  return clean as T
}

/** Keep attendee rows and admin-only source-file URLs out of the public browser cache. */
const toPublicSettings = (value: HomepageSettings): HomepageSettings => ({
  ...value,
  webinars: (value.webinars || []).map((item) => {
    const {
      attendeesList,
      attendeesExcelUrl,
      certificateDocxTemplateUrl,
      certificateDocxFileName,
      certificateTemplateUrl,
      certificateTemplateFileName,
      certificatesPdfUrl,
      certificatesPdfFileName,
      certificatesCount,
      certificateIssueDate,
      certificateLetterNumber,
      ...publicItem
    } = item
    return {
      ...publicItem,
      attendeesCount: attendeesList?.length ?? item.attendeesCount ?? 0,
    }
  }),
  provinceContent: publicProvinceRecords(value.provinceContent || []),
})

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<PageRoute>('home')
  const [publicProvinceId, setPublicProvinceId] = useState('')
  const [registrationWebinarId, setRegistrationWebinarId] = useState<string | null>(null)
  const [settingsReady, setSettingsReady] = useState(false)
  const [transitionTarget, setTransitionTarget] = useState<{
    route: PageRoute
    box?: HubBox
  } | null>(null)
  const [toast, setToast] = useState('')
  const settingsSavePending = useRef(false)
  const [settings, setSettings] = useState<HomepageSettings>(() => {
    try {
      const saved = localStorage.getItem('dars:homepage-settings')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.hubBoxes && parsed.siteTitle) {
          const publicCached = toPublicSettings(stripRemovedAdminSettings(parsed))
          try { localStorage.setItem('dars:homepage-settings', JSON.stringify(publicCached)) } catch {}
          return { ...defaultHomepageSettings, ...publicCached }
        }
      }
    } catch {}
    return defaultHomepageSettings
  })

  // Warm the transition artwork after the first render, so it does not compete with initial page code.
  useEffect(() => {
    const timer = window.setTimeout(() => preloadTransitionParts(), 1800)
    return () => window.clearTimeout(timer)
  }, [])

  const notify = useCallback((message: string) => setToast(message), [])

  // Sync settings from Neon database on startup; shared registration URLs wait until this first read completes.
  useEffect(() => {
    let active = true
    fetchServerSettings()
      .then((serverData) => {
        if (!active || !serverData || (!serverData.hubBoxes && !serverData.provinceContent)) return
        const cleanData = toPublicSettings(stripRemovedAdminSettings(serverData))
        setSettings((previous) => {
          const merged = { ...previous, ...cleanData, hubBoxes: cleanData.hubBoxes || previous.hubBoxes }
          try {
            localStorage.setItem('dars:homepage-settings', JSON.stringify(merged))
          } catch {}
          return merged
        })
      })
      .catch(() => {})
      .finally(() => { if (active) setSettingsReady(true) })
    return () => { active = false }
  }, [])

  const handleSaveSettings = useCallback(
    async (newSettings: HomepageSettings) => {
      if (settingsSavePending.current) { notify('ذخیره قبلی هنوز در حال انجام است؛ لطفاً صبر کنید.'); return false }
      settingsSavePending.current = true
      const cleanSettings = stripRemovedAdminSettings(newSettings)
      try {
        // Large embedded files are moved to Blob first; Neon stores only their small URLs.
        const normalizedSettings = await externalizeDataUrls(cleanSettings)
        const res = await saveServerSettings(normalizedSettings)
        if (!res.ok) {
          notify(`تغییرات در Neon ذخیره نشد: ${res.error || 'خطای اتصال به پایگاه داده'}`)
          return false
        }

        const publicSettings = toPublicSettings(normalizedSettings)
        setSettings(publicSettings)
        try {
          localStorage.setItem('dars:homepage-settings', JSON.stringify(publicSettings))
        } catch {}
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'خطا در انتقال فایل‌های حجیم به فضای ذخیره‌سازی.'
        notify(`ذخیره انجام نشد: ${message}`)
        return false
      } finally {
        settingsSavePending.current = false
      }
    },
    [notify]
  )

  const handleProvinceReviewChanged = useCallback((item: ProvinceContentRecord) => {
    setSettings(previous => {
      const next = { ...previous, provinceContent: [...(previous.provinceContent || []).filter(row => row.id !== item.id), ...publicProvinceRecords([item])] }
      try { localStorage.setItem('dars:homepage-settings', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const handleProvinceContentChange = useCallback((items: ProvinceContentRecord[], provinceId: string) => {
    setSettings((previous) => {
      const retained = (previous.provinceContent || []).filter(item => item.provinceId !== provinceId)
      const safeItems = toPublicSettings({ ...previous, provinceContent: items }).provinceContent || []
      const next = { ...previous, provinceContent: [...retained, ...safeItems] }
      try {
        localStorage.setItem('dars:homepage-settings', JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  // Navigation handler with URL pathname / hash sync
  const navigateTo = useCallback((route: PageRoute) => {
    setRegistrationWebinarId(null)
    setCurrentRoute(route)
    if (route === 'admin') {
      window.history.pushState(null, '', '/admin')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (route === 'ostan') {
      window.history.pushState(null, '', '/ostan')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (route === 'home') {
      window.history.pushState(null, '', '/')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.location.hash = route
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [])

  const openProvince = useCallback((provinceId: string) => {
    setPublicProvinceId(provinceId)
    setCurrentRoute('province')
    window.history.pushState(null, '', `/province/${encodeURIComponent(provinceId)}`)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const openWebinarRegistration = useCallback((webinarId: string) => {
    setRegistrationWebinarId(webinarId)
    setCurrentRoute('webinars')
    setTransitionTarget({ route: 'webinars' })
    window.history.pushState(null, '', `/webinar-registration/${encodeURIComponent(webinarId)}`)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  // Hub Box click handler that triggers the "درس پژوهی و درس کاوی" animation stage before navigating
  const handleHubBoxClick = useCallback(
    (route: PageRoute) => {
      const box = settings.hubBoxes.find((b) => b.id === route)
      setTransitionTarget({ route, box })
      // Navigate to the target route immediately so the target page renders underneath the transition overlay
      navigateTo(route)
    },
    [settings.hubBoxes, navigateTo]
  )

  const handleTransitionComplete = useCallback(() => {
    setTransitionTarget(null)
  }, [])

  // Sync with browser back/forward, initial URL path /admin, and hash
  useEffect(() => {
    const handleUrlRouteSync = () => {
      const path = window.location.pathname.toLowerCase()
      const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase()
      const provinceMatch = path.match(/^\/province\/([^/]+)\/?$/)
      if (provinceMatch) {
        try { setPublicProvinceId(decodeURIComponent(provinceMatch[1])) } catch { setPublicProvinceId('') }
        setRegistrationWebinarId(null)
        setCurrentRoute('province')
        return
      }
      const registrationId = registrationIdFromPath(window.location.pathname)
      if (registrationId) {
        setCurrentRoute('webinars')
        setRegistrationWebinarId(registrationId)
        setTransitionTarget({ route: 'webinars' })
        return
      }
      setRegistrationWebinarId(null)

      if (path === '/admin' || path.startsWith('/admin')) {
        setCurrentRoute('admin')
        return
      }
      if (path === '/ostan' || path.startsWith('/ostan')) {
        setCurrentRoute('ostan')
        return
      }

      const validRoutes: PageRoute[] = [
        'webinars',
        'in-person',
        'circulars',
        'campaign',
        'lived-experiences',
        'clinical-supervision',
        'content-production',
        'book-reading',
      ]
      if (validRoutes.includes(hash as PageRoute)) {
        setCurrentRoute(hash as PageRoute)
      } else {
        setCurrentRoute('home')
      }
    }

    handleUrlRouteSync()
    window.addEventListener('hashchange', handleUrlRouteSync)
    window.addEventListener('popstate', handleUrlRouteSync)
    return () => {
      window.removeEventListener('hashchange', handleUrlRouteSync)
      window.removeEventListener('popstate', handleUrlRouteSync)
    }
  }, [])

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 5500)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <div className="dusk-app-root">
      <a className="skip-link" href="#main">
        رفتن به محتوای اصلی
      </a>

      {toast && (
        <aside className="dusk-toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button
            onClick={() => setToast('')}
            aria-label="بستن پیام"
            className="dusk-toast-close"
          >
            <X size={15} />
          </button>
        </aside>
      )}

      <main id="main">
        <Suspense fallback={<RouteLoading />}>
          {currentRoute === 'home' ? (
          <>
            <HomeHero siteTitle={settings.siteTitle} />

            {/* The 7 High-End Hub Boxes controlled by Admin Settings */}
            <HubBoxes
              onSelect={handleHubBoxClick}
              boxes={settings.hubBoxes}
              title={settings.sectionTitle}
            />
            <ProvincesDirectory items={settings.provinceContent || []} onSelect={openProvince} />
          </>
        ) : currentRoute === 'province' ? (
          <ProvincePublicPage provinceId={publicProvinceId} items={settings.provinceContent || []} onBack={() => navigateTo('home')} />
        ) : currentRoute === 'admin' ? (
          <AdminPage
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onProvinceReviewChanged={handleProvinceReviewChanged}
            onNavigateHome={() => navigateTo('home')}
            notify={notify}
          />
        ) : currentRoute === 'ostan' ? (
          <OstanPage onPublishedContentChange={handleProvinceContentChange} notify={notify} />
        ) : (
          <div className="subpage-container subpage-rise-animation" key={currentRoute}>
            {currentRoute === 'webinars' && (
              registrationWebinarId ? (
                <WebinarsPage
                  items={settings.webinars}
                  onBack={() => navigateTo('home')}
                  notify={notify}
                  registrationWebinarId={registrationWebinarId}
                  registrationLoading={!settingsReady}
                  onOpenRegistration={webinar => openWebinarRegistration(webinar.id)}
                />
              ) : (
                <>
                  <WebinarsPage
                    items={settings.webinars}
                    onBack={() => navigateTo('home')}
                    notify={notify}
                    onOpenRegistration={webinar => openWebinarRegistration(webinar.id)}
                  />
                  <ProvincePublishedItems sectionId="webinars" items={settings.provinceContent || []} />
                </>
              )
            )}
            {currentRoute === 'in-person' && (
              <><InPersonPage items={settings.inPersonEvents} onBack={() => navigateTo('home')} notify={notify} /><ProvincePublishedItems sectionId="in-person" items={settings.provinceContent || []} /></>
            )}
            {currentRoute === 'circulars' && (
              <><CircularsPage items={settings.circulars} onBack={() => navigateTo('home')} notify={notify} /><ProvincePublishedItems sectionId="circulars" items={settings.provinceContent || []} /></>
            )}
            {currentRoute === 'campaign' && (
              <><CampaignPage teams={settings.provinceTeams} campaignPdf={settings.campaignPdf} campaignFiles={settings.campaignFiles} onBack={() => navigateTo('home')} notify={notify} /><ProvincePublishedItems sectionId="campaign" items={settings.provinceContent || []} /></>
            )}
            {currentRoute === 'lived-experiences' && (
              <><LivedExperiencesPage narratives={settings.narratives} onBack={() => navigateTo('home')} notify={notify} /><ProvincePublishedItems sectionId="lived-experiences" items={settings.provinceContent || []} /></>
            )}
            {currentRoute === 'clinical-supervision' && (
              <><ClinicalSupervisionPage items={settings.clinicalItems} onBack={() => navigateTo('home')} notify={notify} /><ProvincePublishedItems sectionId="clinical-supervision" items={settings.provinceContent || []} /></>
            )}
            {currentRoute === 'content-production' && (
              <><ContentProductionPage items={settings.contentMedia} onBack={() => navigateTo('home')} notify={notify} onOpenBookReading={() => navigateTo('book-reading')} /><ProvincePublishedItems sectionId="content-production" items={settings.provinceContent || []} /></>
            )}
            {currentRoute === 'book-reading' && (
              <BookReadingPage onBack={() => navigateTo('content-production')} items={settings.provinceContent || []} />
            )}
          </div>
          )}
        </Suspense>
      </main>

      {/* Page Transition Stage for درس پژوهی و درس کاوی */}
      {transitionTarget && (
        <PageTransitionStage
          onComplete={handleTransitionComplete}
          duration={1900}
        />
      )}

      {/* Unified Dusk Theme Footer */}
      {currentRoute !== 'admin' && currentRoute !== 'ostan' && (
        <footer className="dusk-footer">
          <div className="container dusk-footer-inner">
            <div className="dusk-footer-brand">
              <strong className="font-titr text-center block w-full">{settings.siteTitle}</strong>
              {currentRoute === 'home' && <span>{settings.footerTagline}</span>}
              {currentRoute === 'province' && <a className="province-credit-link" href={`/province-image-credits.html#${encodeURIComponent(publicProvinceId)}`} target="_blank" rel="noopener noreferrer">منابع تصاویر</a>}
            </div>

            {currentRoute === 'home' && (
              <div className="dusk-footer-links">
                <button
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="dusk-footer-top-btn"
                >
                  <span>بازگشت به ابتدای صفحه</span>
                  <ArrowUpLeft size={15} />
                </button>
              </div>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
