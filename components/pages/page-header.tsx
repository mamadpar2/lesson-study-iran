import React from 'react'
import { ArrowRight } from 'lucide-react'
import type { PageRoute } from '@/src/types'

interface PageHeaderProps {
  route?: PageRoute
  title: string
  subtitle: string
  badge?: string
  accentColor?: string
  onBack: () => void
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
}) => {
  return (
    <div className="dusk-page-topbar">
      <div className="container dusk-page-topbar-inner" style={{ justifyContent: 'flex-start' }}>
        <button
          onClick={onBack}
          className="dusk-back-btn"
          aria-label="بازگشت به صفحه اصلی"
        >
          <ArrowRight size={18} />
          <span>بازگشت به صفحه اصلی</span>
        </button>
      </div>

      <div className="container dusk-page-hero">
        <h1 className="dusk-page-title">{title}</h1>
        <p className="dusk-page-subtitle">{subtitle}</p>
      </div>
    </div>
  )
}
