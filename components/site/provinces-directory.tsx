import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, TouchEvent, FocusEvent } from 'react'
import { Map as MapIcon, ArrowUpLeft } from 'lucide-react'
import paths from '@/src/iran-province-paths.json'
import { CASPIAN_SEA_PATH, GULF_SEA_PATH, GULF_SEA_FILL_PATH } from '@/src/iran-sea-paths'
import { PROVINCE_UNITS, SORTED_PROVINCE_UNITS } from '@/src/provinces'
import { publicProvinceRecords } from '@/lib/province-moderation'
import type { ProvinceContentRecord } from '@/src/types'
import MacOSDock from '@/components/ui/mac-os-dock'

const provinceLogos = [
  { id: 'education-council', icon: '/images/province-logos/education-council-white.png', name: 'شورای عالی آموزش و پرورش' },
  { id: 'secondary-education', icon: '/images/province-logos/secondary-education-light-v2.png', name: 'معاونت آموزش متوسطه' },
  { id: 'lower-secondary', icon: '/images/province-logos/lower-secondary-light-v2.png', name: 'دفتر آموزش متوسطه اول' },
  { id: 'upper-secondary', icon: '/images/province-logos/upper-secondary-light-v2.png', name: 'دفتر آموزش متوسطه دوم نظری' },
  { id: 'technical-vocational', icon: '/images/province-logos/technical-vocational-light-v2.png', name: 'دفتر آموزش متوسطه فنی حرفه ای و کاردانش' },
  { id: 'fars-education', icon: '/images/province-logos/fars-education-light.png', name: 'اداره کل آموزش و پرورش استان فارس' },
]

export function ProvincesDirectory({ items, onSelect }: { items: ProvinceContentRecord[]; onSelect: (id: string) => void }) {
  const [tehranOpen, setTehranOpen] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeMap, setActiveMap] = useState<string | null>(null)
  const [activeUnit, setActiveUnit] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [highlight, setHighlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const mapWrap = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const lastTouch = useRef<string | null>(null)
  const suppressClick = useRef(false)
  const mapName = (id: string) => id === 'IR-07' ? 'تهران و شهرستان‌های تهران' : PROVINCE_UNITS.find(unit => unit.mapId === id)?.name || ''
  const highlightedUnit = activeUnit || PROVINCE_UNITS.find(unit => unit.mapId === activeMap)?.id || null

  // A single softly animated background follows the highlighted card; layout is
  // measured again on resize so the effect also works when the grid reflows.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || !highlightedUnit) return
    const measure = () => {
      const target = list.querySelector<HTMLElement>(`[data-province-id="${highlightedUnit}"]`)
      if (target) setHighlight({ x: target.offsetLeft, y: target.offsetTop, width: target.offsetWidth, height: target.offsetHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [highlightedUnit])

  function positionTooltip(clientX: number, clientY: number) {
    const rect = mapWrap.current?.getBoundingClientRect()
    if (rect) setTooltipPos({ x: Math.max(64, Math.min(rect.width - 64, clientX - rect.left)), y: Math.max(42, clientY - rect.top) })
  }
  function moveTooltip(event: MouseEvent<HTMLDivElement>) { positionTooltip(event.clientX, event.clientY) }
  function showMapProvince(id: string, clientX: number, clientY: number) {
    setActiveMap(id); setActiveUnit(null); setHovered(mapName(id)); positionTooltip(clientX, clientY)
  }
  function clearHighlight() { setActiveMap(null); setActiveUnit(null); setHovered(null) }
  function focusProvince(event: FocusEvent<SVGPathElement>, id: string) {
    const rect = event.currentTarget.getBoundingClientRect()
    showMapProvince(id, rect.left + rect.width / 2, rect.top + rect.height / 2)
  }
  function touchProvince(event: TouchEvent<SVGPathElement>, id: string) {
    const touch = event.touches[0]
    if (touch) showMapProvince(id, touch.clientX, touch.clientY)
    suppressClick.current = lastTouch.current !== id
    lastTouch.current = id
  }
  function selectMap(id: string) {
    if (id === 'IR-07') { setTehranOpen(true); return }
    const province = PROVINCE_UNITS.find(unit => unit.mapId === id)
    if (province) onSelect(province.id)
  }
  function clickProvince(id: string) {
    if (suppressClick.current) { suppressClick.current = false; return }
    lastTouch.current = null
    selectMap(id)
  }
  function showListProvince(id: string, mapId: string) {
    lastTouch.current = null
    setActiveUnit(id); setActiveMap(mapId); setHovered(mapName(mapId))
    const path = mapWrap.current?.querySelector<SVGPathElement>(`[data-map-province="${mapId}"]`)
    if (path) { const rect = path.getBoundingClientRect(); positionTooltip(rect.left + rect.width / 2, rect.top + rect.height / 2) }
  }
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const item of publicProvinceRecords(items)) result[item.provinceId] = (result[item.provinceId] || 0) + 1
    return result
  }, [items])
  return <section className="container province-directory" aria-labelledby="province-directory-title" dir="rtl">
    <div className="province-directory-shell">
      <div className="province-directory-heading">
        <span className="province-heading-icon"><MapIcon size={23} /></span>
        <div><p className="province-overline">همراهی در سراسر ایران</p><h2 id="province-directory-title" className="font-titr">فعالیت استان‌ها</h2><p>استان مورد نظر خود را از نقشه یا فهرست انتخاب کنید.</p></div>
      </div>
      <div className="province-map-layout">
        <div className="province-map-panel">
          <div className="province-map-composition">
          <div className="province-map-wrap" ref={mapWrap} onMouseMove={moveTooltip} onMouseLeave={() => { if (!lastTouch.current) clearHighlight() }}>
            {hovered && <div className="province-map-tooltip" role="tooltip" style={{ left: tooltipPos.x, top: tooltipPos.y }}>{hovered}</div>}
            <svg viewBox="-4.45 -10 817 759" className="province-map" aria-label="نقشه انتخاب استان‌ها" role="group">
              <g aria-label="دریای کاسپین" role="img" data-map-sea="caspian">
                <title>دریای کاسپین</title><path className="province-water" d={CASPIAN_SEA_PATH}/>
                <text x="310" y="61" textAnchor="middle" className="province-sea-label province-sea-label-caspian">دریای کاسپین</text>
              </g>
              <g aria-label="خلیج فارس و دریای عمان" role="img" data-map-sea="gulf">
                <title>خلیج فارس و دریای عمان</title><path className="province-water" d={GULF_SEA_PATH}/><path className="province-water province-water-fill" d={GULF_SEA_FILL_PATH}/>
                <text x="350" y="680" textAnchor="middle" className="province-sea-label province-sea-label-gulf" transform="rotate(45, 350, 680)">خلیج فارس</text>
              </g>
              {paths.map(path => <path key={path.id} d={path.d} role="button" tabIndex={0} aria-label={mapName(path.id)} data-map-province={path.id} data-highlighted={activeMap === path.id ? 'true' : undefined}
                onMouseEnter={event => showMapProvince(path.id, event.clientX, event.clientY)} onMouseLeave={() => { if (!lastTouch.current) clearHighlight() }}
                onFocus={event => focusProvince(event, path.id)} onBlur={() => { if (!lastTouch.current) clearHighlight() }}
                onTouchStart={event => touchProvince(event, path.id)}
                onClick={() => clickProvince(path.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectMap(path.id) } }}><title>{mapName(path.id)}</title></path>)}
            </svg>
          </div>
          <div className="province-logo-side" aria-label="لوگوهای آموزش و پرورش">
            <MacOSDock apps={provinceLogos} orientation="vertical" onAppClick={() => {}} />
          </div>
          </div>
          {tehranOpen && <div className="province-tehran-choice" role="group" aria-label="انتخاب واحد تهران"><p>کدام واحد را می‌خواهید ببینید؟</p><div><button onClick={() => onSelect('tehran-city')}>تهران</button><button onClick={() => onSelect('tehran-counties')}>شهرستان‌های تهران</button><button onClick={() => setTehranOpen(false)} aria-label="بستن انتخاب تهران">بستن</button></div></div>}
        </div>
        <div className="province-list-panel"><div className="province-list-header"><div><p className="province-list-eyebrow">از هر گوشه ایران</p><h3 className="font-titr">استان‌های کشور</h3></div><span>مطالب منتشرشده</span></div>
          <div className="province-list" ref={listRef}>
            <span aria-hidden="true" className="province-list-highlight" style={highlight ? { opacity: highlightedUnit ? 1 : 0, width: highlight.width, height: highlight.height, transform: `translate(${highlight.x}px, ${highlight.y}px)` } : { opacity: 0 }} />
            {SORTED_PROVINCE_UNITS.map(province => <button key={province.id} data-province-id={province.id} data-highlighted={activeMap === province.mapId && (!activeUnit || activeUnit === province.id) ? 'true' : undefined}
              onMouseEnter={() => showListProvince(province.id, province.mapId)} onMouseLeave={clearHighlight}
              onFocus={() => showListProvince(province.id, province.mapId)} onBlur={clearHighlight}
              onClick={() => onSelect(province.id)} className="province-list-item">
                <span className="province-list-name">{province.name}</span><span className="province-list-count">{(counts[province.id] || 0).toLocaleString('fa-IR')} مورد</span><ArrowUpLeft size={15} className="province-list-arrow" aria-hidden="true"/>
              </button>)}
          </div>
        </div>
      </div>
      <p className="province-directory-note">فقط مطالب منتشرشده در شمارنده و صفحه استان دیده می‌شوند؛ مطالب جدید نیاز به بررسی و انتشار مدیر دارند.</p>
    </div>
  </section>
}
