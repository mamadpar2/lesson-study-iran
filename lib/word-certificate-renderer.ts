/**
 * Word-exact certificate renderer.
 *
 * Everything is measured / extracted from the official certificate exported by Microsoft Word
 * (A5 page, 419.52 × 595.32 pt, rendered here at 1748 × 2481 px = 300 dpi):
 *
 *  - word-certificate-bg.png      pictures of the page (frame, letterhead, header date/number,
 *                                 watermark, signature, footer) – no body text
 *  - word-certificate-text-dynamic.png fixed body text (except static title/date rows)
 *  - word-certificate-title.png / word-certificate-date.png original title and date rows
 *  - word-certificate-movers.png  the label words whose position depends on the attendee
 *                                 ("به شماره پرسنلی:" and "ناحیه / منطقه:")
 *
 * The attendee values (name, personnel code, province, district) are drawn with B Titr Bold
 * (same size as Word) and flow exactly like in Word: from the right margin to the left,
 * wrapping to the next line at the left margin. The original title/date/letter number remain
 * fixed template artwork and are never regenerated from webinar metadata.
 */

export const CERT_PAGE_W_PT = 419.52
export const CERT_PAGE_H_PT = 595.32
export const CERT_CANVAS_W = 1748
export const CERT_CANVAS_H = 2481

const BG_URL = '/templates/word-certificate-bg.png'
// This derivative clears the title/date rows; the title is restored from the sample as
// exact raster artwork, and the event-date row is restored from the same sample.
const TEXT_URL = '/templates/word-certificate-text-dynamic.png'
const TITLE_URL = '/templates/word-certificate-title.png'
const DATE_URL = '/templates/word-certificate-date.png'
const MOVERS_URL = '/templates/word-certificate-movers.png'

const BLACK = '#000000'

const RIGHT_EDGE = 373.7 // right margin of the text block (pt)
const LEFT_EDGE = 51.5 // left margin of the text block (pt)
const LINE_PITCH = 24.6 // line pitch of the name / code paragraph (pt)
const NAME_BASELINE = 212.5 // first line of the name paragraph (pt)
const AREA_BASELINE = 261.7 // province / district line (pt)
const SPLIT_Y = 225 // everything below this y (pt) in the text layer moves with the paragraph

// Label words that move: source box in movers.png (px) + original right edge (pt) + baseline (pt)
interface Mover {
  box: [number, number, number, number]
  right: number
  baseline: number
  w: number // advance width in pt (distance to the next word is `gap`)
}
const MOVERS: Record<'beh' | 'shomare' | 'personnel' | 'area', Mover> = {
  beh: { box: [1330, 956, 1377, 1028], right: 328.76, baseline: 237.1, w: 7.92 },
  shomare: { box: [1216, 956, 1333, 1028], right: 318.26, baseline: 237.1, w: 24.8 },
  personnel: { box: [1063, 956, 1219, 1028], right: 291.0, baseline: 237.1, w: 34.37 },
  area: { box: [878, 1059, 1136, 1131], right: 271.01, baseline: AREA_BASELINE, w: 271.01 - 212.35 },
}

// Gaps (pt) measured in the Word PDF
const GAP_LABEL_NAME = 9.73 // after "آقای:" before the name
const GAP_NAME_WORDS = 4.66 // between the words of the name
const GAP_DISTRICT_WORDS = 2.73 // between the words of the district
const GAP_NAME_LABEL = 8.18 // after the name before "به شماره پرسنلی:"
const GAP_BEH_SHOMARE = 2.58
const GAP_SHOMARE_PERSONNEL = 2.46
const GAP_LABEL_CODE = 6.12 // after "پرسنلی:" before the code
const AQAYE_LEFT = 125.09 // left edge of the static "آقای:"

// province line
const AREA_FIXED_LEFT = 308.26 // left edge of the static "شاغل در استان:"
const GAP_STATE_PROVINCE = 4.91
const GAP_PROVINCE_AREA = 2.57
const GAP_STATE_AREA = 4.91
const GAP_AREA_DISTRICT = 4.65
const AREA_FIXED_RIGHT = 373.59

export interface CertificateAttendee {
  fullName: string
  province: string
  personnelCode?: string
  district?: string
}

// ---------------------------------------------------------------------------------------

let fontsPromise: Promise<void> | null = null

/** Load the fonts used by dynamic certificate fields. */
function ensureFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise
  fontsPromise = (async () => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return
    const faces = [
      new FontFace('CertTitr', 'url(/fonts/BTitrBold.ttf)', { weight: '400', style: 'normal' }),
      new FontFace('CertNazanin', 'url(/fonts/BNazanin.ttf)', { weight: '400', style: 'normal' }),
    ]
    await Promise.all(faces.map(async (face) => {
      try {
        await face.load()
        document.fonts.add(face)
      } catch (e) {
        console.warn(`Certificate font ${face.family} failed to load:`, e)
      }
    }))
  })()
  return fontsPromise
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}


export interface WordCertificateOptions {
  outputFormat?: 'jpeg' | 'webp' | 'png'
  quality?: number
}

interface Tok {
  kind: 'text' | 'mover'
  t: string
  w: number
  gap: number
  size: number
  mover?: keyof typeof MOVERS
}
interface Placed {
  tok: Tok
  right: number
  baseline: number
}

function layoutNameParagraph(
  measure: (t: string, size: number) => number,
  name: string,
  code: string,
  scale: number
): { placed: Placed[]; lines: number } {
  const size = 14 * scale
  const toks: Tok[] = []
  name
    .split(/\s+/)
    .filter(Boolean)
    .forEach((t, i) =>
      toks.push({ kind: 'text', t, w: measure(t, size), gap: i === 0 ? GAP_LABEL_NAME : GAP_NAME_WORDS, size })
    )
  if (code) {
    toks.push({ kind: 'mover', t: '', w: MOVERS.beh.w, gap: GAP_NAME_LABEL, size: 12, mover: 'beh' })
    toks.push({ kind: 'mover', t: '', w: MOVERS.shomare.w, gap: GAP_BEH_SHOMARE, size: 12, mover: 'shomare' })
    toks.push({ kind: 'mover', t: '', w: MOVERS.personnel.w, gap: GAP_SHOMARE_PERSONNEL, size: 12, mover: 'personnel' })
    toks.push({ kind: 'text', t: code, w: measure(code, size), gap: GAP_LABEL_CODE, size })
  }

  const placed: Placed[] = []
  let line = 0
  let x = AQAYE_LEFT // line 0 continues after the static label "…آقای:"
  let first = false // true when the token starts a new line
  for (const tok of toks) {
    let right = first ? x : x - tok.gap
    if (!first && right - tok.w < LEFT_EDGE) {
      line++
      right = RIGHT_EDGE
    }
    placed.push({ tok, right, baseline: NAME_BASELINE + line * LINE_PITCH })
    x = right - tok.w
    first = false
  }
  return { placed, lines: line + 1 }
}

/**
 * Renders the certificate exactly like the Word template and returns a data URL.
 * Throws when an asset or font is unavailable so the caller can handle it.
 */
export async function renderWordCertificate(
  attendee: CertificateAttendee,
  options: WordCertificateOptions = {}
): Promise<string> {
  const { outputFormat = 'jpeg', quality = 0.95 } = options

  const [, bg, text, movers, titleImage, dateImage] = await Promise.all([
    ensureFonts(),
    loadImage(BG_URL),
    loadImage(TEXT_URL),
    loadImage(MOVERS_URL),
    loadImage(TITLE_URL),
    loadImage(DATE_URL),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = CERT_CANVAS_W
  canvas.height = CERT_CANVAS_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  const S = CERT_CANVAS_W / CERT_PAGE_W_PT
  const W = canvas.width
  const H = canvas.height

  const name = (attendee.fullName || '').trim()
  const code = (attendee.personnelCode || '').trim()
  const province = (attendee.province || '').trim()
  const district = (attendee.district || '').trim()

  const measure = (t: string, size: number) => {
    ctx.font = `bold ${size * S}px "CertTitr", "B Titr", Tahoma, sans-serif`
    return ctx.measureText(t).width / S
  }

  // name + personnel code paragraph (shrink only for absurdly long names)
  let scale = 1
  let para = layoutNameParagraph(measure, name, code, scale)
  while (para.lines > 3 && scale > 0.6) {
    scale -= 0.05
    para = layoutNameParagraph(measure, name, code, scale)
  }
  const shift = (para.lines - 2) * LINE_PITCH // Word moves the text below up / down
  const shiftPx = Math.round(shift * S)

  // 1. pictures
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.drawImage(bg, 0, 0, W, H)

  // 2. fixed text: upper part stays, lower part moves with the paragraph
  const splitPx = Math.round(SPLIT_Y * S)
  ctx.drawImage(text, 0, 0, W, splitPx, 0, 0, W, splitPx)
  ctx.drawImage(text, 0, splitPx, W, H - splitPx, 0, splitPx + shiftPx, W, H - splitPx)

  // Restore the title row from the original sample at its exact, fixed page coordinates.
  // Raster artwork preserves the Persian wording, red color, font, size, and placement.
  ctx.drawImage(titleImage, 0, 0, W, H)

  // Keep the sample's event date and duration fixed as part of the certificate template.
  ctx.drawImage(dateImage, 0, 0, W, H)

  // 3. moving label words
  const drawMover = (key: keyof typeof MOVERS, right: number, baseline: number) => {
    const m = MOVERS[key]
    const [l, t, r, b] = m.box
    const dx = Math.round((right - m.right) * S)
    const dy = Math.round((baseline - m.baseline) * S)
    ctx.drawImage(movers, l, t, r - l, b - t, l + dx, t + dy, r - l, b - t)
  }

  // 4. attendee values, B Titr Bold, black (as printed by Word)
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = BLACK
  const drawText = (t: string, right: number, baseline: number, size: number) => {
    ctx.font = `bold ${size * S}px "CertTitr", "B Titr", Tahoma, sans-serif`
    ctx.fillText(t, right * S, baseline * S)
  }

  for (const p of para.placed) {
    if (p.tok.kind === 'mover') drawMover(p.tok.mover!, p.right, p.baseline)
    else drawText(p.tok.t, p.right, p.baseline, p.tok.size)
  }

  // شاغل در استان: [استان] ناحیه / منطقه: [منطقه]   (compressed only if it would overflow)
  {
    const y = AREA_BASELINE + shift
    const pw = province ? measure(province, 12) : 0
    const dWords = district.split(/\s+/).filter(Boolean)
    const dSpace = GAP_DISTRICT_WORDS
    const dw = dWords.reduce((s, w) => s + measure(w, 14), 0) + Math.max(0, dWords.length - 1) * dSpace

    let total = AREA_FIXED_RIGHT - AREA_FIXED_LEFT
    total += (province ? GAP_STATE_PROVINCE + pw + GAP_PROVINCE_AREA : GAP_STATE_AREA) + MOVERS.area.w
    if (district) total += GAP_AREA_DISTRICT + dw
    const k = total > RIGHT_EDGE - LEFT_EDGE ? (RIGHT_EDGE - LEFT_EDGE) / total : 1

    ctx.save()
    ctx.translate(RIGHT_EDGE * S, 0)
    ctx.scale(k, 1)
    ctx.translate(-RIGHT_EDGE * S, 0)

    let x = AREA_FIXED_LEFT
    if (province) {
      x -= GAP_STATE_PROVINCE
      drawText(province, x, y, 12)
      x -= pw + GAP_PROVINCE_AREA
    } else {
      x -= GAP_STATE_AREA
    }
    drawMover('area', x, y)
    x -= MOVERS.area.w
    if (district) {
      x -= GAP_AREA_DISTRICT
      for (const w of dWords) {
        drawText(w, x, y, 14)
        x -= measure(w, 14) + dSpace
      }
    }
    ctx.restore()
  }

  const mime = outputFormat === 'png' ? 'image/png' : outputFormat === 'webp' ? 'image/webp' : 'image/jpeg'
  return canvas.toDataURL(mime, quality)
}
