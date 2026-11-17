import { formatJalaliDate, parseJalaliDate, toGregorianDate, toJalaliDate, toLatinDigits, toPersianDigits } from './jalali-date.js'

export type RegistrationWindowPhase = 'unscheduled' | 'before' | 'open' | 'closed'

export interface WebinarRegistrationWindowSource {
  attendanceStartDate?: string
  attendanceStartTime?: string
  attendanceEndDate?: string
  attendanceEndTime?: string
}

/** Convert a Jalali wall-clock date/time in Asia/Tehran to an absolute ISO instant. */
export function parseTehranDateTime(dateValue?: string, timeValue?: string): Date | null {
  const date = parseJalaliDate(dateValue)
  const time = toLatinDigits(String(timeValue || '').normalize('NFKC')).match(/^\s*(\d{1,2})\s*:\s*(\d{2})\s*$/)
  if (!date || !time) return null

  const hour = Number(time[1])
  const minute = Number(time[2])
  if (hour > 23 || minute > 59) return null

  const gregorian = toGregorianDate(date)
  const wallClockAsUtc = Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day, hour, minute, 0, 0)
  let instant = wallClockAsUtc

  try {
    const offsetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      hourCycle: 'h23',
    })
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const zone = offsetFormatter.formatToParts(new Date(instant)).find(part => part.type === 'timeZoneName')?.value || 'GMT+0'
      const offsetMatch = zone.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?$/)
      const sign = offsetMatch?.[1] === '-' ? -1 : 1
      const offsetMinutes = offsetMatch ? sign * (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3] || 0)) : 0
      const next = wallClockAsUtc - offsetMinutes * 60_000
      if (next === instant) break
      instant = next
    }

    const result = new Date(instant)
    const check = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(result)
    const parts = Object.fromEntries(check.map(part => [part.type, part.value]))
    if (
      Number(parts.year) !== gregorian.year || Number(parts.month) !== gregorian.month || Number(parts.day) !== gregorian.day ||
      Number(parts.hour) !== hour || Number(parts.minute) !== minute
    ) return null
    return result
  } catch {
    return null
  }
}

export function getWebinarRegistrationWindow(source: WebinarRegistrationWindowSource) {
  const start = parseTehranDateTime(source.attendanceStartDate, source.attendanceStartTime)
  const end = parseTehranDateTime(source.attendanceEndDate, source.attendanceEndTime)
  const configured = Boolean(start && end && end.getTime() > start.getTime())
  return { start, end, configured }
}

export function getRegistrationWindowPhase(source: WebinarRegistrationWindowSource, now = Date.now()): RegistrationWindowPhase {
  const { start, end, configured } = getWebinarRegistrationWindow(source)
  if (!configured || !start || !end) return 'unscheduled'
  if (now < start.getTime()) return 'before'
  if (now < end.getTime()) return 'open'
  return 'closed'
}

export function formatTehranDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const gregorian = { year: Number(values.year), month: Number(values.month), day: Number(values.day) }
  const jalali = formatJalaliDate(toJalaliDate(gregorian.year, gregorian.month, gregorian.day))
  return `${jalali} ساعت ${toPersianDigits(`${values.hour}:${values.minute}`)}`
}
