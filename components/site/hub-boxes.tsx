import React from 'react'
import {
  Video,
  UsersRound,
  ScrollText,
  Sparkles,
  BookOpenCheck,
  ScanEye,
  Film,
  ArrowLeft,
} from 'lucide-react'
import { hubBoxes, type HubBox } from '@/src/data'
import type { PageRoute } from '@/src/types'

interface HubBoxesProps {
  onSelect: (route: PageRoute) => void
  boxes?: HubBox[]
  title?: string
}

const iconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Video,
  UsersRound,
  ScrollText,
  Sparkles,
  BookOpenCheck,
  ScanEye,
  Film,
}


export const HubBoxes: React.FC<HubBoxesProps> = ({
  onSelect,
  boxes = hubBoxes,
  title = 'برای ورود و مشارکت، بخش مورد نظر را انتخاب کنید',
}) => {
  return (
    <section className="hub-boxes-section" aria-label="بخش‌های اصلی دبیرخانه">
      {/* Background ambient lighting */}
      <div className="hub-bg-mesh" aria-hidden="true" />

      <div className="container">
        {/* Section Header */}
        <div className="hub-section-header">
          <h2 className="hub-title font-titr">{title}</h2>

          <div className="hub-header-divider" aria-hidden="true">
            <span className="divider-line" />
            <span className="divider-diamond">✦</span>
            <span className="divider-line" />
          </div>
        </div>

        {/* The 7 High-End Luxury Cards Grid */}
        <div className="hub-grid">
          {boxes.map((box: HubBox) => {
            const IconComponent = iconMap[box.iconName] || Sparkles

            return (
              <button
                key={box.id}
                onClick={() => onSelect(box.id)}
                className={`hub-card hub-card--${box.id}`}
                style={{
                  '--card-accent': box.accentColor,
                  '--card-glow': box.glowColor,
                } as React.CSSProperties}
                aria-label={`ورود به صفحه ${box.title}`}
              >
                {/* Background Shimmer & Atmospheric Aura */}
                <div className="hub-card-aura" aria-hidden="true" />
                <div className="hub-card-shimmer" aria-hidden="true" />

                {/* Top Strip: 3D Pod Icon & Status Pill */}
                <div className="hub-card-top">
                  <div
                    className="hub-icon-pod"
                    style={{
                      background: `radial-gradient(135% 135% at 30% 25%, ${box.accentColor}30 0%, rgba(18, 29, 46, 0.95) 85%)`,
                      borderColor: `${box.accentColor}55`,
                      boxShadow: `0 8px 24px -6px ${box.glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.25)`,
                    }}
                  >
                    <IconComponent size={28} className="hub-icon" />
                  </div>

                  <span
                    className="hub-badge"
                    style={{
                      color: box.accentColor,
                      borderColor: `${box.accentColor}44`,
                      background: `linear-gradient(135deg, ${box.accentColor}18 0%, rgba(18, 29, 46, 0.6) 100%)`,
                    }}
                  >
                    <span className="hub-badge-live-dot" style={{ backgroundColor: box.accentColor }} />
                    {box.badge}
                  </span>
                </div>

                {/* Main Card Body */}
                <div className="hub-card-body">
                  <h3 className="hub-card-heading font-titr">{box.title}</h3>
                </div>

                {/* Elevated Action Footer */}
                <div className="hub-card-footer">
                  <div className="hub-action-info">
                    <span className="hub-btn-label font-titr">ورود به بخش</span>
                  </div>
                  <span
                    className="hub-arrow-circle"
                    style={{
                      background: `linear-gradient(135deg, ${box.accentColor} 0%, ${box.accentColor}dd 100%)`,
                      boxShadow: `0 4px 16px ${box.glowColor}`,
                    }}
                  >
                    <ArrowLeft size={17} className="hub-arrow-icon" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
