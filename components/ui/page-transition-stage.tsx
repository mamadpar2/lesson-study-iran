'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

export const TRANSITION_IMAGES = [
  '/logo-parts/fig-orange.webp',
  '/logo-parts/fig-green.webp',
  '/logo-parts/fig-pink.webp',
  '/logo-parts/fig-purple.webp',
  '/logo-parts/fig-blue.webp',
  '/logo-parts/crescent.webp',
]

let warmed = false
export function preloadTransitionParts(): void {
  if (typeof window === 'undefined' || warmed) return
  warmed = true
  TRANSITION_IMAGES.forEach((src) => {
    const img = new Image()
    img.src = src
    img.decode?.().catch(() => {})
  })
}

interface PageTransitionStageProps {
  onComplete: () => void
  duration?: number
}

/**
 * صحنه نشان متحرک دبیرخانه — دقیقاً مطابق سایت مرجع:
 * - آدمک‌ها از گوشه‌های بیرون کادر دید پرواز کرده و در مرکز به هم می‌رسند
 * - سپس هلال ماه از پایین بالا می‌آید و زیر آن‌ها می‌نشیند
 * - زیر آن عنوان «دبیرخانه درس پژوهی درس کاوی» با فونت بی تیتر ظاهر می‌شود
 * - زینت رنگی ۵ رنگ دبیرخانه
 * - بدون هیچ مورد اضافی
 */
export const PageTransitionStage: React.FC<PageTransitionStageProps> = ({
  onComplete,
  duration = 1900,
}) => {
  const [ready, setReady] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const completedRef = useRef(false)

  const handleFinish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    setIsExiting(true)
    setTimeout(() => {
      onComplete()
    }, 280)
  }, [onComplete])

  useEffect(() => {
    // شروع انیمیشن بلافاصله بعد از mount
    preloadTransitionParts()
    const rAf = requestAnimationFrame(() => setReady(true))

    const timer = setTimeout(() => {
      handleFinish()
    }, duration)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleFinish()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(rAf)
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [duration, handleFinish])

  return createPortal(
    <div
      className={`page-transition-overlay ${isExiting ? 'is-exiting' : 'is-entering'}`}
      role="dialog"
      aria-modal="true"
      aria-label="در حال ورود به صفحه"
      onClick={handleFinish}
      title="برای ورود سریع‌تر کلیک کنید"
    >
      <div className="pt-backdrop" />

      <div
        className="logo-stage-wrap"
        data-ready={ready ? 'true' : 'false'}
        onClick={handleFinish}
      >
        <div className="logo-stage" role="img" aria-label="نشان دبیرخانه درس پژوهی درس کاوی">
          {/* آدمک نارنجی: پرواز از گوشه بالا-راست */}
          <img
            className="part fig fig-orange"
            src="/logo-parts/fig-orange.webp"
            alt=""
            draggable={false}
            style={
              {
                '--tx': '60vw',
                '--ty': '-55vh',
                '--delay': '0.04s',
              } as React.CSSProperties
            }
          />

          {/* آدمک سبز: پرواز از گوشه بالا-چپ */}
          <img
            className="part fig fig-green"
            src="/logo-parts/fig-green.webp"
            alt=""
            draggable={false}
            style={
              {
                '--tx': '-60vw',
                '--ty': '-55vh',
                '--delay': '0.12s',
              } as React.CSSProperties
            }
          />

          {/* آدمک صورتی/سرخابی: پرواز از سمت راست */}
          <img
            className="part fig fig-pink"
            src="/logo-parts/fig-pink.webp"
            alt=""
            draggable={false}
            style={
              {
                '--tx': '65vw',
                '--ty': '15vh',
                '--delay': '0.20s',
              } as React.CSSProperties
            }
          />

          {/* آدمک بنفش: پرواز از گوشه پایین-راست */}
          <img
            className="part fig fig-purple"
            src="/logo-parts/fig-purple.webp"
            alt=""
            draggable={false}
            style={
              {
                '--tx': '60vw',
                '--ty': '55vh',
                '--delay': '0.28s',
              } as React.CSSProperties
            }
          />

          {/* آدمک آبی: پرواز از سمت چپ/پایین-چپ */}
          <img
            className="part fig fig-blue"
            src="/logo-parts/fig-blue.webp"
            alt=""
            draggable={false}
            style={
              {
                '--tx': '-65vw',
                '--ty': '25vh',
                '--delay': '0.36s',
              } as React.CSSProperties
            }
          />

          {/* هلال ماه: بالا آمدن از پایین و قرار گرفتن زیر آدمک‌ها */}
          <img
            className="part crescent"
            src="/logo-parts/crescent.webp"
            alt=""
            draggable={false}
          />
        </div>

        {/* عنوان زیر لوگو با فونت بی تیتر */}
        <h2 className="stage-title font-titr">
          <span className="w">دبیرخانه</span>
          <span className="w">درس پژوهی</span>
          <span className="w">درس کاوی</span>
        </h2>

        {/* زینت رنگی زیر عنوان با ۵ نقطه ۵ رنگ دبیرخانه */}
        <div className="stage-orn" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>,
    document.body,
  )
}
