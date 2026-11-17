import type { CertificateAttendee } from './word-certificate-renderer'

/**
 * Render a private, uploaded Word certificate template to JPG in the admin browser.
 * Only blue attendee placeholders are changed; the uploaded red title, dates, and
 * letter number remain the source document's own content.
 */
export async function renderPersonalizedDocxCertificateImage(
  templateSource: string,
  attendee: CertificateAttendee,
  quality = 0.95
): Promise<string> {
  if (typeof document === 'undefined' || !document.body) return ''

  const { generatePersonalizedDocxBlob } = await import('./docx-certificate-parser')
  const personalizedDocx = await generatePersonalizedDocxBlob(templateSource, attendee)
  const [{ renderAsync }, html2canvasModule] = await Promise.all([
    import('docx-preview'),
    import('html2canvas'),
  ])

  const renderClassName = 'certificate-docx-preview'
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    zIndex: '-1',
    width: 'max-content',
    height: 'max-content',
    overflow: 'visible',
    pointerEvents: 'none',
  })
  const styleHost = document.createElement('style')
  document.body.appendChild(host)
  document.head.appendChild(styleHost)

  try {
    await renderAsync(personalizedDocx, host, styleHost, {
      className: renderClassName,
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      ignoreLastRenderedPageBreak: false,
      renderChanges: false,
      renderComments: false,
      renderAltChunks: true,
    })

    await document.fonts?.ready
    // docx-preview uses the configured className for both the wrapper and page.
    // Querying the default `.docx` names here returned no nodes for our custom class,
    // which caused the certificate modal's "page not found" error after a successful render.
    const pages = Array.from(host.querySelectorAll<HTMLElement>(`section.${renderClassName}`))
    const page = pages[0] || host.querySelector<HTMLElement>(`.${renderClassName}-wrapper > section.${renderClassName}`)
    if (!page) throw new Error('صفحه‌ای از قالب Word برای تولید تصویر پیدا نشد.')
    if (pages.length > 1) {
      throw new Error('قالب Word گواهی باید تک‌صفحه‌ای باشد تا تصویر JPG درست صادر شود.')
    }

    await Promise.all(
      Array.from(page.querySelectorAll('img')).map((image) =>
        image.decode().catch(() => undefined)
      )
    )

    const width = Math.max(page.scrollWidth, page.offsetWidth)
    const height = Math.max(page.scrollHeight, page.offsetHeight)
    if (!width || !height) throw new Error('ابعاد صفحه Word برای تبدیل به تصویر معتبر نیست.')
    const scale = Math.min(2, Math.sqrt(8_000_000 / (width * height)))
    const canvas = await html2canvasModule.default(page, {
      backgroundColor: '#ffffff',
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width,
      height,
      scrollX: 0,
      scrollY: 0,
    })
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    host.remove()
    styleHost.remove()
  }
}
