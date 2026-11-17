import { formatWebinarDateForCertificate } from './certificate-date.js'
import {
  B_NAZANIN_FONT_BASE64,
  B_TITR_FONT_BASE64,
  B_ZAR_FONT_BASE64,
} from './certificate-font-data.js'

export interface PublicCertificateFields {
  fullName: string
  personnelCode?: string
  province?: string
  district?: string
  webinarTitle: string
  webinarDate?: string
  issueDate?: string
  letterNumber?: string
}

const PAGE_WIDTH = 595.32
const PAGE_HEIGHT = 841.92
const TEMPLATE_WIDTH = 2481
const TEMPLATE_HEIGHT = 3508

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u064a\u0649]/g, 'ی')
    .replace(/\u0643/g, 'ک')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  })[char] || char)
}

function toPersianDigits(value: string): string {
  return value
    .replace(/[0-9]/g, digit => String.fromCharCode(digit.charCodeAt(0) + 0x06f0 - 0x0030))
    .replace(/[٠-٩]/g, digit => String.fromCharCode(digit.charCodeAt(0) - 0x0660 + 0x06f0))
}

function estimatedWidth(text: string, size: number): number {
  let units = 0
  for (const char of text) {
    if (/\s/.test(char)) units += 0.3
    else if (/[،؛:,.!؟()\-]/.test(char)) units += 0.34
    else units += 0.42
  }
  return units * size
}

function fittedLength(text: string, size: number, maxWidth: number): string {
  return estimatedWidth(text, size) > maxWidth
    ? ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"`
    : ''
}

function textElement(
  text: string,
  options: {
    x: number
    y: number
    maxWidth?: number
    size: number
    font: string
    anchor?: 'start' | 'middle' | 'end'
    color?: string
    weight?: number
  },
): string {
  if (!text) return ''
  const safeText = escapeXml(text)
  const length = options.maxWidth ? fittedLength(text, options.size, options.maxWidth) : ''
  // SVG anchors follow the writing direction: for RTL text, `start` is the right edge.
  // The certificate's measured x coordinates mark the right edge of each reserved field.
  return `<text x="${options.x}" y="${options.y}" text-anchor="${options.anchor || 'start'}" font-family="${options.font}" font-size="${options.size}" font-weight="${options.weight || 700}" fill="${options.color || '#111111'}" direction="rtl" unicode-bidi="plaintext"${length}>${safeText}</text>`
}

function wrapTitle(title: string) {
  const words = title.split(' ').filter(Boolean)
  const firstWidth = 354
  const secondWidth = 231
  const lessonAnalysisIndex = words.findIndex((word, index) =>
    (word === 'درس' && words[index + 1] === 'کاوی') || /درس‌?کاوی/u.test(word)
  )
  if (lessonAnalysisIndex > 0) {
    const preferredFirst = words.slice(0, lessonAnalysisIndex).join(' ')
    const preferredSecond = words.slice(lessonAnalysisIndex).join(' ')
    for (let size = 20; size >= 10; size -= 0.5) {
      if (estimatedWidth(preferredFirst, size) <= firstWidth && estimatedWidth(preferredSecond, size) <= secondWidth) {
        return { lines: [preferredFirst, preferredSecond], size }
      }
    }
  }
  for (let size = 20; size >= 10; size -= 0.5) {
    if (estimatedWidth(title, size) <= firstWidth) return { lines: [title], size }
    for (let split = words.length - 1; split >= 1; split -= 1) {
      const first = words.slice(0, split).join(' ')
      const second = words.slice(split).join(' ')
      if (estimatedWidth(first, size) <= firstWidth && estimatedWidth(second, size) <= secondWidth) {
        return { lines: [first, second], size }
      }
    }
  }

  const size = 10
  const lines: string[] = []
  let current = ''
  let remainder = ''
  let remainderIndex = -1
  for (const [index, word] of words.entries()) {
    const next = current ? `${current} ${word}` : word
    if (!current || estimatedWidth(next, size) <= firstWidth) current = next
    else {
      remainder = word
      remainderIndex = index
      break
    }
  }
  if (current) lines.push(current)
  if (remainder) {
    for (const word of words.slice(remainderIndex + 1)) {
      const next = `${remainder} ${word}`
      if (estimatedWidth(next, size) <= secondWidth - 10) remainder = next
      else break
    }
    while (remainder && estimatedWidth(`${remainder}…`, size) > secondWidth) remainder = remainder.slice(0, -1).trimEnd()
    if (remainder) lines.push(`${remainder}…`)
  }
  return { lines, size }
}

/** Build a single personalized certificate image; the blank source artwork is never served on this route. */
export function renderPublicCertificateSvg(fields: PublicCertificateFields, templateBase64: string): string {
  const fullName = normalizeText(fields.fullName)
  const personnelCode = toPersianDigits(normalizeText(fields.personnelCode))
  const province = normalizeText(fields.province)
  const district = normalizeText(fields.district)
  const issueDate = toPersianDigits(normalizeText(fields.issueDate))
  const letterNumber = toPersianDigits(normalizeText(fields.letterNumber))
  const webinarTitle = toPersianDigits(normalizeText(fields.webinarTitle))
  const webinarDate = formatWebinarDateForCertificate(fields.webinarDate)
  const titleLayout = wrapTitle(webinarTitle)
  const regionLabel = 'ناحیه / منطقه :'
  const regionLabelRight = Math.min(356, 435.7 - estimatedWidth(province, 18) - 14)
  const districtRight = regionLabelRight - 88.4 - 5

  const texts = [
    textElement(issueDate, { x: 133.0, y: 94.58, maxWidth: 102, font: 'B Zar Header', size: 20 }),
    textElement(letterNumber, { x: 332.3, y: 95.54, maxWidth: 119.5, font: 'B Zar Header', size: 22 }),
    textElement(fullName, { x: 178.86, y: 297.29, maxWidth: 76.8, font: 'B Titr', size: 18 }),
    textElement(personnelCode, { x: 422.6, y: 334.25, maxWidth: 76.0, font: 'B Titr', size: 18 }),
    textElement(province, { x: 435.7, y: 371.21, font: 'B Titr', size: 18 }),
    textElement(regionLabel, { x: regionLabelRight, y: 371.21, font: 'B Nazanin', size: 18, weight: 400 }),
    textElement(district, { x: districtRight, y: 371.21, font: 'B Titr', size: 18 }),
    titleLayout.lines[0]
      ? textElement(titleLayout.lines[0], { x: 443.05, y: 443.83, maxWidth: 354, font: 'B Titr', size: titleLayout.size, color: '#ff0000' })
      : '',
    titleLayout.lines[1]
      ? textElement(titleLayout.lines[1], { x: 266.05, y: 484.51, maxWidth: 354, font: 'B Titr', size: titleLayout.size, anchor: 'middle', color: '#ff0000' })
      : '',
    textElement(webinarDate, { x: 474.3, y: 522.79, maxWidth: 134.8, font: 'B Titr', size: 18 }),
  ].join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}" role="img" aria-label="گواهی حضور رسمی">
    <defs>
      <style>
        @font-face{font-family:'B Titr';src:url(data:font/woff;base64,${B_TITR_FONT_BASE64}) format('woff');font-weight:700}
        @font-face{font-family:'B Nazanin';src:url(data:font/woff;base64,${B_NAZANIN_FONT_BASE64}) format('woff');font-weight:400}
        @font-face{font-family:'B Zar Header';src:url(data:font/ttf;base64,${B_ZAR_FONT_BASE64}) format('truetype');font-weight:700}
      </style>
    </defs>
    <image x="0" y="0" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" preserveAspectRatio="none" href="data:image/png;base64,${templateBase64}" />
    ${texts}
  </svg>`
}
