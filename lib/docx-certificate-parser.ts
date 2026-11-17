import JSZip from 'jszip'
import { generateCertificateImage } from './pdf-splitter'

export interface DocxCertificateTemplate {
  fileName: string
  fileDataUrl: string
  hasBlueSlots: boolean
  detectedSlots: {
    fieldType: 'fullName' | 'personnelCode' | 'province' | 'district' | 'title' | 'unknown'
    originalText: string
    color: string
  }[]
}

const KNOWN_PROVINCES = [
  'تهران', 'فارس', 'اصفهان', 'خراسان', 'یزد', 'کردستان', 'خوزستان', 'کرمان', 'مازندران',
  'گیلان', 'سمنان', 'مرکزی', 'همدان', 'لرستان', 'ایلام', 'بوشهر', 'زنجان', 'قم', 'قزوین',
  'گلستان', 'اردبیل', 'کرمانشاه', 'چهارمحال و بختیاری', 'کهگیلویه و بویراحمد', 'هرمزگان',
  'البرز', 'سیستان و بلوچستان'
]

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Checks if a Word XML color hex or name corresponds to blue shades
 * Covers: 0000FF, 0070C0, 002060, 1F497D, 2E75B6, 418AB3, 00A2E8, 000080, navy, blue, etc.
 */
export function isBlueColor(val?: string): boolean {
  if (!val) return false
  const clean = val.trim().toLowerCase()
  if (['blue', 'navy', 'darkblue', 'skyblue', 'mediumblue', 'royalblue'].includes(clean)) {
    return true
  }
  if (/^[0-9a-f]{6}$/.test(clean)) {
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    // Blue is dominant and sufficiently saturated
    return b >= 70 && b > r && b >= (g - 30) && (b - r >= 20)
  }
  return false
}

/**
 * Checks if a Word XML color hex corresponds to red shades
 */
export function isRedColor(val?: string): boolean {
  if (!val) return false
  const clean = val.trim().toUpperCase()
  if (['EE0000', 'FF0000', 'C00000', 'CC0000', 'B22222'].includes(clean)) {
    return true
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const r = parseInt(clean.substring(0, 2), 16)
    const g = parseInt(clean.substring(2, 4), 16)
    const b = parseInt(clean.substring(4, 6), 16)
    return r >= 150 && r > g * 1.5 && r > b * 1.5
  }
  return false
}

/**
 * Parses an uploaded Word (.docx) certificate template:
 * - Detects blue-font text runs intended as dynamic placeholders
 * - Extracts embedded media (backgrounds, logos, signatures)
 */
export async function parseDocxCertificateTemplate(file: File): Promise<DocxCertificateTemplate> {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Read only the document XML needed for placeholder detection. The original DOCX
  // remains intact in private storage and keeps its embedded images/fonts.
  // Parse word/document.xml
  const docFile = zip.file('word/document.xml')
  if (!docFile) {
    throw new Error('فایل معتبر Word (document.xml) یافت نشد.')
  }

  const docXml = await docFile.async('string')
  const detectedSlots: DocxCertificateTemplate['detectedSlots'] = []

  const pRegex = /<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/g
  let pMatch: RegExpExecArray | null

  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1]
    const rRegex = /<w:r(?: [^>]*)?>([\s\S]*?)<\/w:r>/g
    let rMatch: RegExpExecArray | null
    let precedingText = ''

    while ((rMatch = rRegex.exec(pContent)) !== null) {
      const rContent = rMatch[1]
      const colorMatch = rContent.match(/<w:color[^>]+w:val=\"([^\"]+)\"/)
      const textMatch = rContent.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/)
      const text = textMatch ? textMatch[1] : ''

      if (colorMatch && isBlueColor(colorMatch[1])) {
        let fieldType: DocxCertificateTemplate['detectedSlots'][0]['fieldType'] = 'unknown'
        const immediatePreceding = precedingText.trim().slice(-30)

        if (/نام|خانم|آقای/i.test(immediatePreceding)) {
          fieldType = 'fullName'
        } else if (/پرسنلی/i.test(immediatePreceding) || /^\d+$/.test(text.replace(/[۰-۹]/g, '1'))) {
          fieldType = 'personnelCode'
        } else if (/منطقه|ناحیه|شهرستان/i.test(immediatePreceding)) {
          fieldType = 'district'
        } else if (/استان/i.test(immediatePreceding) || KNOWN_PROVINCES.some((p) => text.includes(p))) {
          fieldType = 'province'
        } else if (/عنوان/i.test(immediatePreceding)) {
          fieldType = 'title'
        } else {
          // Heuristic based on position among slots
          if (detectedSlots.length === 0) fieldType = 'fullName'
          else if (detectedSlots.length === 1) fieldType = 'personnelCode'
          else if (detectedSlots.length === 2) fieldType = 'province'
          else if (detectedSlots.length === 3) fieldType = 'district'
        }

        detectedSlots.push({
          fieldType,
          originalText: text,
          color: colorMatch[1],
        })
      }

      precedingText += text
    }
  }

  // Convert array buffer to base64 dataUrl for storage
  const base64Docx = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  )
  const fileDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64Docx}`

  return {
    fileName: file.name,
    fileDataUrl,
    hasBlueSlots: detectedSlots.length > 0,
    detectedSlots,
  }
}

/**
 * Replaces the blue-colored text runs in the Word (.docx) document
 * with the exact attendee information from the Excel list,
 * producing a personalized .docx file!
 */
export async function generatePersonalizedDocxBlob(
  docxTemplateSource: string,
  attendee?: {
    fullName: string
    province: string
    personnelCode?: string
    district?: string
  },
): Promise<Blob> {
  const currentAttendee = attendee || {
    fullName: 'همکار محترم',
    province: 'فارس',
  }

  const source = docxTemplateSource.trim()
  if (!source) throw new Error('قالب DOCX برای صدور گواهی موجود نیست.')

  let arrayBuffer: ArrayBuffer
  if (source.startsWith('data:')) {
    const base64Index = source.indexOf('base64,')
    const base64Str = base64Index !== -1 ? source.substring(base64Index + 7) : source
    const binaryStr = atob(base64Str)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    arrayBuffer = bytes.buffer
  } else {
    // Relative or HTTP URL
    const response = await fetch(source, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to fetch docx template from ${source}`)
    }
    arrayBuffer = await response.arrayBuffer()
  }

  const zip = await JSZip.loadAsync(arrayBuffer)
  const docFile = zip.file('word/document.xml')
  if (!docFile) {
    return new Blob([arrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
  }

  let docXml = await docFile.async('string')

  // Find all paragraphs and replace blue runs with attendee details
  let slotIndex = 0
  docXml = docXml.replace(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g, (pBlock) => {
    let precedingInP = ''
    return pBlock.replace(/<w:r(?: [^>]*)?>[\s\S]*?<\/w:r>/g, (rBlock) => {
      const colorMatch = rBlock.match(/<w:color[^>]+w:val=\"([^\"]+)\"/)
      const textMatch = rBlock.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/)
      const currentText = textMatch ? textMatch[1] : ''

      if (colorMatch && isBlueColor(colorMatch[1]) && textMatch) {
        const immediatePreceding = precedingInP.trim().slice(-30)
        let replacement = currentText

        if (/عنوان|وبینار|جلسه|موضوع/i.test(immediatePreceding)) {
          // Blue title/subject text is static template content, not an attendee slot.
        } else if (/نام|خانم|آقای/i.test(immediatePreceding) || slotIndex === 0) {
          replacement = currentAttendee.fullName
        } else if (
          /پرسنلی/i.test(immediatePreceding) ||
          /^\d+$/.test(currentText.replace(/[۰-۹]/g, '1')) ||
          slotIndex === 1
        ) {
          replacement = currentAttendee.personnelCode || '—'
        } else if (/منطقه|ناحیه|شهرستان/i.test(immediatePreceding) || slotIndex === 3) {
          const trailingSpaces = currentText.length - currentText.trimEnd().length
          replacement = (currentAttendee.district || 'سراسری') + (trailingSpaces > 0 ? ' '.repeat(trailingSpaces) : '')
        } else if (
          /استان/i.test(immediatePreceding) ||
          KNOWN_PROVINCES.some((p) => currentText.includes(p)) ||
          slotIndex === 2
        ) {
          const trailingSpaces = currentText.length - currentText.trimEnd().length
          replacement = (currentAttendee.province || 'فارس') + ' '.repeat(Math.max(trailingSpaces, 4))
        }

        slotIndex++
        precedingInP += replacement
        return rBlock.replace(
          /<w:t(?: [^>]*)?>[^<]*<\/w:t>/,
          `<w:t xml:space="preserve">${escapeXml(replacement)}</w:t>`
        )
      }

      precedingInP += currentText
      return rBlock
    })
  })

  // The red title belongs to the supplied certificate sample and stays untouched.
  // Only the event date below is dynamically personalized.

  // Preserve the uploaded sample's red title, event date, header date and letter number.
  // Only blue attendee placeholders above are personalized.

  zip.file('word/document.xml', docXml)
  const modifiedBuffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new Blob([modifiedBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

/**
 * High-resolution canvas renderer that produces the JPG certificate image
 * representing the personalized attendee certificate.
 */
export async function renderAttendeeCertificateImage(
  attendee: {
    fullName: string
    province: string
    personnelCode?: string
    district?: string
  },
  _webinarTitle: string = 'وبینار تخصصی کشوری',
  _dateStr: string = '۱۴۰۵',
  templateImageUrl?: string
): Promise<string> {
  // Render locally in the browser; no server-side image-rendering endpoint is needed.
  return await generateCertificateImage(
    attendee,
    _webinarTitle,
    _dateStr,
    templateImageUrl,
    'jpeg'
  )
}
