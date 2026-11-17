export interface JalaliDate {
  year: number
  month: number
  day: number
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const

function div(a: number, b: number) { return Math.trunc(a / b) }
function mod(a: number, b: number) { return a - Math.trunc(a / b) * b }

function jalCal(year: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178]
  const gy = year + 621
  if (year < breaks[0] || year >= breaks[breaks.length - 1]) return { leap: 0, gy, march: 21 }
  let leapJ = -14
  let jp = breaks[0]
  let jump = 0
  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i]
    jump = jm - jp
    if (year < jm) break
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4)
    jp = jm
  }
  const n = year - jp
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4)
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150
  const march = 20 + leapJ - leapG
  let leap = mod(mod(n + 1, 33) - 1, 4)
  if (leap === -1) leap = 4
  return { leap, gy, march }
}

function gregorianToDayNumber(gy: number, gm: number, gd: number) {
  let day = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
    + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408
  day = day - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752
  return day
}

function dayNumberToGregorian(dayNumber: number) {
  let j = 4 * dayNumber + 139361631
  j += div(div(4 * dayNumber + 183187720, 146097) * 3, 4) * 4 - 3908
  const i = div(mod(j, 1461), 4) * 5 + 308
  const day = div(mod(i, 153), 5) + 1
  const month = mod(div(i, 153), 12) + 1
  const year = div(j, 1461) - 100100 + div(8 - month, 6)
  return { year, month, day }
}

function jalaliToDayNumber(year: number, month: number, day: number) {
  const { gy, march } = jalCal(year)
  return gregorianToDayNumber(gy, 3, march) + (month - 1) * 31 - div(month, 7) * (month - 7) + day - 1
}

function dayNumberToJalali(dayNumber: number): JalaliDate {
  const gy = dayNumberToGregorian(dayNumber).year
  let year = gy - 621
  const { leap, march } = jalCal(year)
  const firstFarvardin = gregorianToDayNumber(gy, 3, march)
  let dayOfYear = dayNumber - firstFarvardin
  if (dayOfYear >= 0) {
    if (dayOfYear <= 185) return { year, month: 1 + div(dayOfYear, 31), day: mod(dayOfYear, 31) + 1 }
    dayOfYear -= 186
  } else {
    year -= 1
    dayOfYear += leap === 1 ? 180 : 179
  }
  return { year, month: 7 + div(dayOfYear, 30), day: mod(dayOfYear, 30) + 1 }
}

export function toJalaliDate(gregorianYear: number, gregorianMonth: number, gregorianDay: number): JalaliDate {
  return dayNumberToJalali(gregorianToDayNumber(gregorianYear, gregorianMonth, gregorianDay))
}

export function toGregorianDate(date: JalaliDate) {
  return dayNumberToGregorian(jalaliToDayNumber(date.year, date.month, date.day))
}

export function isJalaliLeapYear(year: number) {
  return jalCal(year).leap === 0
}

export function jalaliMonthLength(year: number, month: number) {
  if (month < 1 || month > 12) return 0
  if (month <= 6) return 31
  if (month <= 11) return 30
  return isJalaliLeapYear(year) ? 30 : 29
}

export function toLatinDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
}

export function toPersianDigits(value: string) {
  return value.replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0x06f0 - 0x0030))
}

export function parseJalaliDate(value: string | undefined | null): JalaliDate | null {
  const normalized = toLatinDigits(String(value || '').normalize('NFKC'))
  const match = normalized.match(/(\d{3,4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})/)
  if (!match) return null
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  if (date.year < 1 || date.month < 1 || date.month > 12 || date.day < 1 || date.day > jalaliMonthLength(date.year, date.month)) return null
  return date
}

export function formatJalaliDate(date: JalaliDate) {
  const month = String(date.month).padStart(2, '0')
  const day = String(date.day).padStart(2, '0')
  return toPersianDigits(`${date.year}/${month}/${day}`)
}

// Older webinar records sometimes contain a written Persian month instead of a
// numeric date. Only complete dates are sortable; a month alone is ambiguous.
function parseWebinarDate(value: string | undefined | null): JalaliDate | null {
  const numeric = parseJalaliDate(value)
  if (numeric) return numeric
  const text = toLatinDigits(String(value || '').normalize('NFKC'))
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200b\u200c\u200d\ufeff]/g, ' ')
  const months = JALALI_MONTHS.join('|')
  const dayFirst = text.match(new RegExp(`(?:^|[^0-9])(\\d{1,2})\\s+(${months})\\s+(\\d{3,4})(?!\\d)`))
  const yearFirst = text.match(new RegExp(`(?:^|[^0-9])(\\d{3,4})\\s+(${months})\\s+(\\d{1,2})(?!\\d)`))
  const match = dayFirst || yearFirst
  if (!match) return null
  const year = Number(dayFirst ? match[3] : match[1])
  const month = JALALI_MONTHS.findIndex(name => name === match[2]) + 1
  const day = Number(dayFirst ? match[1] : match[3])
  if (year < 1 || month < 1 || day < 1 || day > jalaliMonthLength(year, month)) return null
  return { year, month, day }
}

export function sortByJalaliDateNewestFirst<T extends { date?: string | null }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => {
      const date = parseWebinarDate(item.date)
      return { item, index, dayNumber: date ? jalaliToDayNumber(date.year, date.month, date.day) : null }
    })
    .sort((a, b) => {
      if (a.dayNumber === null) return b.dayNumber === null ? a.index - b.index : 1
      if (b.dayNumber === null) return -1
      return b.dayNumber - a.dayNumber || a.index - b.index
    })
    .map(({ item }) => item)
}

export function getJalaliToday(now = new Date()): JalaliDate {
  return toJalaliDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function getJalaliCalendar(year: number, month: number) {
  const first = toGregorianDate({ year, month, day: 1 })
  const weekdayOffset = (new Date(Date.UTC(first.year, first.month - 1, first.day)).getUTCDay() + 1) % 7
  return { weekdayOffset, daysInMonth: jalaliMonthLength(year, month) }
}
