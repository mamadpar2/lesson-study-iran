import type { FC } from 'react'
import MurmurationWordmark from '@/components/ui/murmuration-wordmark'
import LightningText from '@/components/ui/lightning-text'
import secretariatShape from '@/lib/secretariat-shape.json'
import secondaryEducationShape from '@/lib/secondary-education-shape.json'

const extraHeroShapes = [secondaryEducationShape]

export const HomeHero: FC<{ siteTitle: string }> = () => (
  <section
    id="home"
    className="hero hero--logo"
    aria-label="بخش اصلی: نشان متحرک دبیرخانه کشوری درس پژوهی درس کاوی"
  >
    <MurmurationWordmark
      shape={secretariatShape}
      extraShapes={extraHeroShapes}
      words={['درس‌پژوهی', 'درس‌کاوی']}
      birds={3200}
      preset="dusk"
      palette={{ skyTop: '#1c2d43', skyLow: '#dba58b', sun: '#f4cda2', ink: '#172124' }}
      fontFamily="'B Titr', 'BTitr', sans-serif"
      flyFor={1.3}
      holdFor={3.6}
      height="var(--flock-height)"
      className="hero-canvas"
    >
    <div className="hero-veil" />
    <div className="hero-grain" />
    <img
      className="hero-secondary-logo"
      src="/images/province-logos/secondary-hero-light.png"
      alt="لوگوی معاونت آموزش متوسطه"
      decoding="async"
    />
    <div className="hero-title-wrap" dir="rtl">
      <h1 id="hero-title" className="sr-only">سامانه جامع درس‌پژوهی و درس‌کاوی</h1>
      <LightningText
        text="سامانه جامع درس‌پژوهی و درس‌کاوی"
        fontFamily="'B Titr', 'BTitr', 'Vazirmatn', sans-serif"
        fontSize={54}
        fontSizeReduction={4}
        height={120}
        className="hero-lightning"
      />
    </div>
    </MurmurationWordmark>
    <div className="container hero-inner">
      <div className="hero-bottom-right font-titr">
        <span className="tiny-star">✳</span> خانه ای برای رشد حرفه ای معلمان
      </div>
    </div>
  </section>
)
