import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays } from 'lucide-react'
import {
  formatJalaliDate,
  getJalaliCalendar,
  getJalaliToday,
  JALALI_MONTHS,
  parseJalaliDate,
  type JalaliDate,
} from '@/lib/jalali-date'

interface JalaliDateInputProps {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  id?: string
  ariaLabel?: string
  readOnly?: boolean
  preserveSuffix?: boolean
}

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const DATE_DIGITS = '[0-9۰-۹٠-٩]'

function timeSuffix(value: string, preserveSuffix: boolean) {
  if (!preserveSuffix) return ''
  const digitDate = new RegExp(`^\\s*${DATE_DIGITS}{3,4}\\s*[./-]\\s*${DATE_DIGITS}{1,2}\\s*[./-]\\s*${DATE_DIGITS}{1,2}([\\s\\S]*)$`)
  const match = value.normalize('NFKC').match(digitDate)
  if (match?.[1]?.trim()) return match[1].trim()
  const timeAt = value.search(/(?:،?\s*ساعت\s*|\s+\d{1,2}[:٫]\d{2})/)
  return timeAt >= 0 ? value.slice(timeAt).trim() : ''
}

export const JalaliDateInput: React.FC<JalaliDateInputProps> = ({
  value,
  onChange,
  className = 'dusk-input',
  placeholder = 'انتخاب تاریخ شمسی',
  id,
  ariaLabel,
  readOnly = true,
  preserveSuffix = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [view, setView] = useState<JalaliDate>(() => parseJalaliDate(value) || getJalaliToday())
  const today = getJalaliToday()
  const selected = parseJalaliDate(value)
  const { weekdayOffset, daysInMonth } = getJalaliCalendar(view.year, view.month)

  const calendarCells = useMemo(() => {
    const cells: Array<number | null> = [
      ...Array.from({ length: weekdayOffset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ]
    while (cells.length % 7) cells.push(null)
    return cells
  }, [weekdayOffset, daysInMonth])

  const yearOptions = useMemo(() => {
    const start = Math.min(today.year - 80, view.year)
    const end = Math.max(today.year + 20, view.year)
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }, [today.year, view.year])

  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false)
      return
    }
    setIsVisible(false)
    const frame = window.requestAnimationFrame(() => setIsVisible(true))
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  const openPicker = () => {
    setView(selected || getJalaliToday())
    setIsOpen(true)
  }

  const moveMonth = (delta: number) => {
    setView(current => {
      let year = current.year
      let month = current.month + delta
      if (month < 1) { month = 12; year -= 1 }
      if (month > 12) { month = 1; year += 1 }
      return { ...current, year, month }
    })
  }

  const selectDay = (day: number) => {
    const dateValue = formatJalaliDate({ ...view, day })
    const suffix = timeSuffix(value, preserveSuffix)
    onChange(suffix ? `${dateValue} ${suffix}` : dateValue)
    setIsOpen(false)
  }

  const selectToday = () => {
    const current = getJalaliToday()
    const dateValue = formatJalaliDate(current)
    const suffix = timeSuffix(value, preserveSuffix)
    onChange(suffix ? `${dateValue} ${suffix}` : dateValue)
    setView(current)
    setIsOpen(false)
  }

  return (
    <>
      <div className="jcal-input-shell">
        <input
          id={id}
          type="text"
          value={value || ''}
          readOnly={readOnly}
          onChange={event => onChange(event.target.value)}
          onClick={openPicker}
          onFocus={openPicker}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`${className} jcal-input`}
          autoComplete="off"
        />
        <button
          type="button"
          className="jcal-input-icon"
          onClick={openPicker}
          aria-label="باز کردن تقویم شمسی"
          title="انتخاب تاریخ شمسی"
        >
          <CalendarDays size={17} />
        </button>
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className={`jcal-overlay${isVisible ? ' open' : ''}`}
          onMouseDown={event => { if (event.target === event.currentTarget) setIsOpen(false) }}
        >
          <section className="jcal" role="dialog" aria-modal="true" aria-label="انتخاب تاریخ شمسی">
            <div className="jcal-head">
              <div className="jcal-title">
                <b>انتخاب تاریخ شمسی</b>
                <button type="button" className="jcal-close" onClick={() => setIsOpen(false)} aria-label="بستن تقویم">×</button>
              </div>
              <div className="jcal-nav">
                <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">›</button>
                <select
                  aria-label="سال"
                  value={view.year}
                  onChange={event => setView(current => ({ ...current, year: Number(event.target.value) }))}
                >
                  {yearOptions.map(year => <option key={year} value={year}>{String(year).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])}</option>)}
                </select>
                <select
                  aria-label="ماه"
                  value={view.month}
                  onChange={event => setView(current => ({ ...current, month: Number(event.target.value) }))}
                >
                  {JALALI_MONTHS.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </select>
                <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">‹</button>
              </div>
            </div>

            <div className="jcal-body">
              <div className="jcal-week">
                {WEEKDAYS.map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
              </div>
              <div className="jcal-days">
                {calendarCells.map((day, index) => day == null ? (
                  <div key={`empty-${index}`} className="jcal-empty" aria-hidden="true" />
                ) : (
                  <button
                    key={day}
                    type="button"
                    className={`jcal-day${today.year === view.year && today.month === view.month && today.day === day ? ' today' : ''}${selected?.year === view.year && selected.month === view.month && selected.day === day ? ' selected' : ''}`}
                    onClick={() => selectDay(day)}
                    aria-label={`${JALALI_MONTHS[view.month - 1]} ${day} ${view.year}`}
                    aria-pressed={selected?.year === view.year && selected.month === view.month && selected.day === day}
                  >
                    {String(day).replace(/\d/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])}
                  </button>
                ))}
              </div>
            </div>

            <div className="jcal-foot">
              <button type="button" className="jcal-today" onClick={selectToday}>امروز</button>
              <button type="button" className="jcal-clear" onClick={() => { onChange(''); setIsOpen(false) }}>پاک کردن</button>
              <button type="button" className="jcal-cancel" onClick={() => setIsOpen(false)}>بستن</button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
