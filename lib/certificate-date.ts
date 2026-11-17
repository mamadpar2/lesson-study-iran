const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

const PERSIAN_ORDINAL_DAYS = [
  '', 'یکم', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم',
  'دهم', 'یازدهم', 'دوازدهم', 'سیزدهم', 'چهاردهم', 'پانزدهم', 'شانزدهم',
  'هفدهم', 'هجدهم', 'نوزدهم', 'بیستم', 'بیست‌ویکم', 'بیست‌ودوم',
  'بیست‌وسوم', 'بیست‌وچهارم', 'بیست‌وپنجم', 'بیست‌وششم', 'بیست‌وهفتم',
  'بیست‌وهشتم', 'بیست‌ونهم', 'سی‌ام', 'سی‌ویکم',
]

function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
}

function toPersianDigits(value: string): string {
  return value.replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0x06f0 - 0x0030))
}

function gregorianToPersian(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
  return { year: value('year'), month: value('month'), day: value('day') }
}

function buildPersianDate(day: number, month: number, year?: number): string | null {
  if (!Number.isInteger(day) || day < 1 || day > 31 || !Number.isInteger(month) || month < 1 || month > 12) return null
  const ordinal = PERSIAN_ORDINAL_DAYS[day]
  const yearText = year ? ` ${toPersianDigits(String(year))}` : ''
  return `${ordinal} ${PERSIAN_MONTHS[month - 1]} ماه${yearText}`
}

/** Convert a webinar's entered date into the written Persian date used on the certificate. */
export function formatWebinarDateForCertificate(input: string | undefined): string {
  const raw = String(input || '').normalize('NFKC').trim()
  if (!raw) return ''
  const value = toLatinDigits(raw)

  // The admin form convention is Solar Hijri YYYY/MM/DD (also accepts dashes or dots).
  const yearFirst = value.match(/(?:^|\D)(\d{4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?!\d)/)
  if (yearFirst) {
    let [, yearText, monthText, dayText] = yearFirst
    let year = Number(yearText), month = Number(monthText), day = Number(dayText)
    if (year >= 1700) {
      const converted = gregorianToPersian(year, month, day)
      if (converted) ({ year, month, day } = converted)
    }
    return buildPersianDate(day, month, year) || toPersianDigits(raw)
  }

  // Persian text dates such as "۸ آبان ۱۴۰۵" or "آبان ۸، ۱۴۰۵".
  const monthIndex = PERSIAN_MONTHS.findIndex(month => value.includes(month))
  if (monthIndex >= 0) {
    const numericTokens = (value.match(/\d+/g) || []).map(Number)
    const year = numericTokens.find(number => number >= 1000 && number <= 3000)
    const dayMatch = numericTokens.find(number => number !== year && number >= 1 && number <= 31)
    if (dayMatch) return buildPersianDate(dayMatch, monthIndex + 1, year) || toPersianDigits(raw)
    if (year) return `${PERSIAN_MONTHS[monthIndex]} ماه ${toPersianDigits(String(year))}`
  }

  // If the year is last, interpret the numeric date in the Persian day/month/year order.
  const yearLast = value.match(/(?:^|\D)(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{4})(?!\d)/)
  if (yearLast) {
    let [, dayText, monthText, yearText] = yearLast
    let day = Number(dayText), month = Number(monthText), year = Number(yearText)
    if (year >= 1700) {
      const converted = gregorianToPersian(year, month, day)
      if (converted) ({ year, month, day } = converted)
    }
    return buildPersianDate(day, month, year) || toPersianDigits(raw)
  }

  // A day/month without a year is still more useful than leaving the old fixed sample date.
  const shortNumeric = value.match(/(?:^|\D)(\d{1,2})\s*[\/.-]\s*(\d{1,2})(?!\d)/)
  if (shortNumeric) {
    const day = Number(shortNumeric[1]), month = Number(shortNumeric[2])
    return buildPersianDate(day, month) || toPersianDigits(raw)
  }

  return toPersianDigits(raw.replace(/\s+/g, ' '))
}
