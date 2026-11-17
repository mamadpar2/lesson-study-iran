import {
  OFFICIAL_CERTIFICATE_TEMPLATE_BASE64,
  OFFICIAL_SIGNATURE_FARS_BASE64,
  OFFICIAL_WATERMARK_BASE64,
} from './official-template-assets'
import { renderWordCertificate } from './word-certificate-renderer'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * Splits a multi-page PDF into an array of WebP images (data URLs)
 * Each page is rendered to a canvas at high DPI (scale 1.8) and exported as WebP.
 */
export async function splitPdfToWebpImages(
  pdfArrayBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  let pdfDoc: any
  try {
    // Load the sizeable PDF engine only for PDF uploads, not for certificate preview/export.
    const pdfjsLib = await import('pdfjs-dist')
    if (typeof window !== 'undefined') pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
    const loadingTask = pdfjsLib.getDocument({ data: pdfArrayBuffer })
    pdfDoc = await loadingTask.promise
    const totalPages = pdfDoc.numPages
    const MAX_CERTIFICATE_PDF_PAGES = 200
    if (totalPages > MAX_CERTIFICATE_PDF_PAGES) {
      throw new Error(`فایل گواهی بیش از سقف ${MAX_CERTIFICATE_PDF_PAGES} صفحه است.`)
    }
    const outputImages: string[] = []

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const unitViewport = page.getViewport({ scale: 1 })
      const maxDimension = 3000
      const maxPixels = 8_000_000
      const pixelScale = Math.sqrt(maxPixels / (unitViewport.width * unitViewport.height))
      const scale = Math.min(1.8, maxDimension / unitViewport.width, maxDimension / unitViewport.height, pixelScale)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Failed to get 2D canvas context for page ' + pageNum)
      }

      await page.render({
        canvasContext: ctx,
        canvas: canvas as any,
        viewport,
      }).promise

      // Convert each rendered page to high-quality WebP and release PDF page buffers.
      const webpDataUrl = canvas.toDataURL('image/webp', 0.92)
      outputImages.push(webpDataUrl)
      page.cleanup()

      if (onProgress) {
        onProgress(pageNum, totalPages)
      }
    }

    await pdfDoc.destroy()
    return outputImages
  } catch (error) {
    if (pdfDoc) await pdfDoc.destroy().catch(() => {})
    console.error('Error splitting PDF to WebP images:', error)
    throw error
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

function toPersianDigits(str: string | number | undefined): string {
  if (!str) return ''
  const faDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(str).replace(/\d/g, (d) => faDigits[parseInt(d, 10)])
}

/**
 * Generates an official attendance certificate image with Full Name, Personnel Code,
 * Province, and District.
 *
 * Defaults to the authentic official Secretariat Certificate Format (Fars Education Directorate
 * Letterhead, Watermark, and Directorate Signature) matching the official sample provided.
 *
 * When a custom template is uploaded by the admin, it dynamically overlays attendee
 * details onto the custom template.
 *
 * Output format is strictly configurable, defaulting to high-resolution JPEG (`image/jpeg`)
 * for downloads as requested.
 */
export async function generateCertificateImage(
  attendee: {
    fullName: string
    province: string
    personnelCode?: string
    district?: string
  },
  _webinarTitle: string = 'پاییز پرسش ، بهار یادگیری',
  _dateStr: string = '۱۴۰۵/۰۷/۱۱',
  templateImageUrl?: string,
  outputFormat: 'jpeg' | 'webp' = 'jpeg'
): Promise<string> {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // Case A: Custom template uploaded by admin
  if (templateImageUrl && templateImageUrl !== OFFICIAL_CERTIFICATE_TEMPLATE_BASE64) {
    try {
      const img = await loadImage(templateImageUrl)
      const width = img.width || 1200
      const height = img.height || 1700
      canvas.width = width
      canvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      // Sample luminance
      let isDarkBackground = false
      try {
        const sampleX = Math.round(width * 0.25)
        const sampleY = Math.round(height * 0.35)
        const sampleW = Math.round(width * 0.5)
        const sampleH = Math.round(height * 0.35)
        const imgData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH)
        let totalLuminance = 0
        const step = 32
        let sampled = 0
        for (let i = 0; i < imgData.data.length; i += step) {
          const r = imgData.data[i]
          const g = imgData.data[i + 1]
          const b = imgData.data[i + 2]
          totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b
          sampled++
        }
        const avgLum = totalLuminance / (sampled || 1)
        isDarkBackground = avgLum < 130
      } catch {
        isDarkBackground = false
      }

      ctx.textAlign = 'center'
      ctx.direction = 'rtl'
      ctx.shadowColor = isDarkBackground ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)'
      ctx.shadowBlur = 6

      // Name
      ctx.fillStyle = isDarkBackground ? '#ffffff' : '#0f172a'
      ctx.font = `bold ${Math.round(width * 0.038)}px "B Titr", Tahoma, sans-serif`
      ctx.fillText(attendee.fullName, width * 0.5, height * 0.46)

      // Details
      ctx.fillStyle = isDarkBackground ? '#38bdf8' : '#0369a1'
      ctx.font = `bold ${Math.round(width * 0.02)}px "B Nazanin", Tahoma, sans-serif`
      let detailsLine = `استان: ${attendee.province}`
      if (attendee.district) detailsLine += ` • منطقه: ${attendee.district}`
      if (attendee.personnelCode) detailsLine += ` • کد پرسنلی: ${toPersianDigits(attendee.personnelCode)}`
      ctx.fillText(detailsLine, width * 0.5, height * 0.53)

      // Preserve every non-attendee element of an uploaded sample, including its
      // red title, date, and letter number. Only the attendee fields are overlaid.

      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'

      const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/webp'
      return canvas.toDataURL(mimeType, 0.95)
    } catch (e) {
      console.warn('Failed to load custom template, falling back to official layout:', e)
    }
  }

  // Case B: render the official Word-derived template with measured attendee text flow
  // and the original fixed title/date/letter number. Keep the existing
  // local canvas renderer below as a fallback in case a static template asset cannot be loaded.
  try {
    const wordRendered = await renderWordCertificate(attendee, {
      outputFormat,
      quality: 0.95,
    })
    if (wordRendered) return wordRendered
  } catch (err) {
    console.warn('Word-layout certificate renderer unavailable; using canvas fallback:', err)
  }

  // Case B fallback: Authentic Official Secretariat Certificate Layout
  // Resolution: 1748 x 2481 px (300 DPI matching user's official PDF)
  const width = 1748
  const height = 2481
  canvas.width = width
  canvas.height = height

  // Solid white background prevents black border in JPEG conversion
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  try {
    // Ensure fonts are loaded before canvas rendering
    if (typeof document !== 'undefined' && document.fonts) {
      try {
        await document.fonts.ready
      } catch {}
    }

    // Try drawing on the clean 300 DPI official template directly extracted from user's PDF
    let baseLoaded = false
    try {
      const cleanBaseImg = await loadImage('/templates/official_clean_certificate_300dpi.png')
      ctx.drawImage(cleanBaseImg, 0, 0, width, height)
      baseLoaded = true
    } catch {
      baseLoaded = false
    }

    if (baseLoaded) {
      ctx.direction = 'rtl'
      ctx.textAlign = 'right'
      ctx.fillStyle = '#0070C0'

      // 1. Full Name: Placed at exact coordinate after "سرکار خانم / جناب آقای:"
      ctx.font = 'bold 54px "B Titr", "BTitr", Tahoma, sans-serif'
      ctx.fillText(attendee.fullName, 508, 888)

      // 2. Personnel Code: Placed at exact coordinate after "به شماره پرسنلی:"
      const personnelStr = attendee.personnelCode
        ? toPersianDigits(attendee.personnelCode)
        : '---'
      ctx.font = 'bold 50px "B Titr", "BTitr", Tahoma, sans-serif'
      ctx.fillText(personnelStr, 1041, 992)

      // 3. Province: Placed at exact coordinate after "شاغل در استان:"
      ctx.font = 'bold 48px "B Titr", "BTitr", Tahoma, sans-serif'
      ctx.fillText(attendee.province || 'فارس', 1258, 1102)

      // 4. District: Placed at exact coordinate after "ناحیه / منطقه:"
      ctx.fillText(attendee.district || 'سراسری', 866, 1102)

      const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/webp'
      return canvas.toDataURL(mimeType, 0.95)
    }

    // Secondary fallback if template image unavailable:
    const bgImg = await loadImage(OFFICIAL_CERTIFICATE_TEMPLATE_BASE64)
    ctx.drawImage(bgImg, 47, 43, 1650, 2380)

    // 2. Draw Subtle Watermark Logo in center background (from Word Drawing 0 Image 3)
    try {
      const wmImg = await loadImage(OFFICIAL_WATERMARK_BASE64)
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.drawImage(wmImg, 200, 495, 796, 795)
      ctx.restore()
    } catch (err) {
      console.warn('Watermark load failed:', err)
    }

    // 3. Draw Director General Stamp & Signature (from Word Drawing 0 Image 4)
    try {
      const sigImg = await loadImage(OFFICIAL_SIGNATURE_FARS_BASE64)
      ctx.drawImage(sigImg, 148, 1249, 437, 168)
    } catch (err) {
      console.warn('Signature image load failed:', err)
    }

    // 4. Top Letterhead Numbers (sits directly to the left of "تاریخ :" and "شماره :")
    ctx.direction = 'rtl'
    ctx.textAlign = 'right'
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 36px "B Zar", "B Titr", "BTitr", Tahoma, sans-serif'

    const cleanDate = '۱۴۰۵/۰۷/۱۱' // exact date printed in the built-in sample
    ctx.fillText(cleanDate, 255, 185)
    ctx.fillText('۱۴۰۵/۱۷۰۰۵/۴۷', 690, 183)

    // 5. Title: «بسمه تعالی» (Word P5: centered, B Titr 20pt = 40px bold)
    ctx.textAlign = 'center'
    ctx.font = 'bold 40px "B Titr", "BTitr", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText('بسمه تعالی', 595.5, 316)

    // 6. Subject: «موضوع : گواهی حضور در وبینار کشوری» (Word P8: right-aligned, B Titr 16pt = 32px bold)
    const rightMargin = 1080
    ctx.textAlign = 'right'
    ctx.font = 'bold 32px "B Titr", "BTitr", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText('موضوع : گواهی حضور در وبینار کشوری', rightMargin, 414)

    // 7. Body Line 1 (Word P10: B Nazanin 18pt = 36px bold + B Titr 18pt = 36px bold in blue)
    const p1Prefix = 'با سلام و احترام گواهی می شود : سرکار خانم / جناب آقای : '
    ctx.font = 'bold 36px "B Nazanin", "BNazanin", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText(p1Prefix, rightMargin, 506)

    const p1w = ctx.measureText(p1Prefix).width
    ctx.font = 'bold 36px "B Titr", "BTitr", Tahoma, sans-serif'
    ctx.fillStyle = '#0070C0'
    ctx.fillText(attendee.fullName, rightMargin - p1w - 8, 506)

    // 8. Body Line 2 (Word P11: B Nazanin 18pt = 36px bold + B Titr 18pt = 36px bold in blue)
    const p2Prefix = 'به شماره پرسنلی :  '
    ctx.font = 'bold 36px "B Nazanin", "BNazanin", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText(p2Prefix, rightMargin, 568)

    const p2w = ctx.measureText(p2Prefix).width
    const personnelStr = attendee.personnelCode
      ? toPersianDigits(attendee.personnelCode)
      : '۵۸۰۲۰۵۸۱'
    ctx.font = 'bold 36px "B Titr", "BTitr", Tahoma, sans-serif'
    ctx.fillStyle = '#0070C0'
    ctx.fillText(personnelStr, rightMargin - p2w - 8, 568)

    // 9. Body Line 3 (Word P12: B Nazanin 18pt = 36px bold + B Titr 18pt = 36px bold in blue)
    const p3Prefix1 = 'شاغل در استان : '
    ctx.font = 'bold 36px "B Nazanin", "BNazanin", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText(p3Prefix1, rightMargin, 630)

    const p3w1 = ctx.measureText(p3Prefix1).width
    const provVal = attendee.province || 'فارس'
    ctx.font = 'bold 36px "B Titr", "BTitr", Tahoma, sans-serif'
    ctx.fillStyle = '#0070C0'
    ctx.fillText(provVal, rightMargin - p3w1 - 6, 630)

    const provW = ctx.measureText(provVal).width
    const p3Prefix2 = '       ناحیه / منطقه : '
    const startP3_2 = rightMargin - p3w1 - provW - 20
    ctx.font = 'bold 36px "B Nazanin", "BNazanin", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText(p3Prefix2, startP3_2, 630)

    const p3w2 = ctx.measureText(p3Prefix2).width
    const distVal = attendee.district || 'سراسری'
    ctx.font = 'bold 36px "B Titr", "BTitr", Tahoma, sans-serif'
    ctx.fillStyle = '#0070C0'
    ctx.fillText(distVal, startP3_2 - p3w2 - 6, 630)

    // 10. Body Line 4 (Word P13: B Nazanin 18pt = 36px bold)
    ctx.font = 'bold 36px "B Nazanin", "BNazanin", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText('در دوره خودآموزی ، دانش افزایی و مهارت شغلی درس پژوهی/ درس کاوی', rightMargin, 694)

    // 11. Fixed title row copied from the official sample; do not re-typeset it.
    const titleImage = await loadImage('/templates/word-certificate-title.png')
    ctx.drawImage(titleImage, 0, 0, width, height)

    // 12. Preserve the date/duration row from the official sample as original artwork.
    const dateImage = await loadImage('/templates/word-certificate-date.png')
    ctx.drawImage(dateImage, 0, 0, width, height)

    // 13. Body Line 7: Hosting Secretariat (Word P16: B Nazanin 18pt = 36px bold)
    ctx.font = 'bold 36px "B Nazanin", "BNazanin", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText('درس کاوی مستقر در استان فارس برگزار گردید ، شرکت داشته‌اند.', rightMargin, 880)

    // 14. Body Line 8: Legal Entitlement (Word P17: B Nazanin 18pt = 36px bold)
    ctx.font = 'bold 36px "B Nazanin", "BNazanin", Tahoma, sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText('این گواهی به منظور بهره‌مندی نامبرده از امتیازات قانونی صادر گردیده است.', rightMargin, 942)

    const mimeType = outputFormat === 'jpeg' ? 'image/jpeg' : 'image/webp'
    return canvas.toDataURL(mimeType, 0.95)
  } catch (err) {
    console.error('Failed to generate official certificate:', err)
    return ''
  }
}
