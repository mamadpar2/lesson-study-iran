'use client'

import { useEffect, useRef, useState } from 'react'

export interface DockApp { id: string; name: string; icon: string }
interface MacOSDockProps {
  apps: DockApp[]
  onAppClick: (appId: string) => void
  openApps?: string[]
  className?: string
  label?: string
  orientation?: 'horizontal' | 'vertical'
}

/** An accessible, responsive dock inspired by the supplied macOS component.
 * Each logo keeps the same resting frame; only its image magnifies on hover.
 */
export default function MacOSDock({ apps, onAppClick, openApps = [], className = '', label = 'لوگوهای آموزشی', orientation = 'horizontal' }: MacOSDockProps) {
  const dockRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastPointerType = useRef<string>('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  useEffect(() => {
    if (!pinnedId) return
    const dismiss = (event: globalThis.PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) { setPinnedId(null); setActiveId(null) }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [pinnedId])

  const shownId = activeId || pinnedId
  const shown = apps.find(app => app.id === shownId)
  const shownIndex = apps.findIndex(app => app.id === shownId)
  const selectedItem = shownIndex < 0 ? null : dockRef.current?.querySelectorAll<HTMLButtonElement>('[data-province-logo]')[shownIndex]
  const tooltipStyle = orientation === 'vertical' && selectedItem ? { top: selectedItem.offsetTop + selectedItem.offsetHeight / 2 + (shownIndex < apps.length / 2 ? 1 : -1) * (selectedItem.offsetHeight * 1.4 + 22) - (shownIndex === apps.length - 1 ? selectedItem.offsetHeight * .6 : 0) } : undefined

  return <div ref={wrapRef} className={`mac-dock-wrap ${orientation === 'vertical' ? 'mac-dock-wrap--vertical' : ''} ${className}`}>
    <div className="mac-dock-label" role="tooltip" style={tooltipStyle} aria-hidden={!shown} data-visible={shown ? 'true' : undefined}>{shown?.name}</div>
    <div ref={dockRef} className="mac-dock" role="group" aria-label={label} dir="rtl"
      onPointerLeave={() => setActiveId(null)}>
      {apps.map(app => <button key={app.id} type="button" className="mac-dock-item" data-province-logo={app.id}
        aria-label={app.name} data-magnified={activeId === app.id || (pinnedId === app.id && lastPointerType.current === 'touch' && !activeId) ? 'true' : undefined} aria-pressed={pinnedId === app.id} data-open={openApps.includes(app.id) ? 'true' : undefined}
        onPointerDown={event => { lastPointerType.current = event.pointerType }}
        onPointerEnter={event => { if (event.pointerType !== 'touch') setActiveId(app.id) }}
        onPointerLeave={event => { if (event.pointerType !== 'touch') setActiveId(current => current === app.id ? null : current) }}
        onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setActiveId(app.id) }} onBlur={() => setActiveId(null)}
        onKeyDown={event => { if (event.key === 'Escape') { setPinnedId(null); setActiveId(null); event.currentTarget.blur() } }}
        onClick={() => { setPinnedId(current => current === app.id ? null : app.id); onAppClick(app.id) }}>
        <img src={app.icon} alt="" decoding="async" loading="lazy" />
      </button>)}
    </div>
  </div>
}
