import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/** Render the actual pages without reflowing a PDF's content; DOCX remains a separate viewer. */
export function DocumentPreview({ url, type }: { url: string; type: 'pdf' | 'docx' }) {
  const [message, setMessage] = useState('در حال آماده‌سازی پیش‌نمایش…')
  const [documentPdf, setDocumentPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [availableSize, setAvailableSize] = useState({ width: 0, height: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docxRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    let pdf: PDFDocumentProxy | null = null
    setMessage('در حال آماده‌سازی پیش‌نمایش…')
    setPageNumber(1)
    setPageCount(0)
    setZoom(1)
    setDocumentPdf(null)

    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error('File unavailable')
        const data = await response.arrayBuffer()
        if (!active) return
        if (type === 'pdf') {
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc
          pdf = await pdfjs.getDocument({
            data,
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            wasmUrl: '/pdfjs/wasm/',
          }).promise
          if (!active) { await pdf.destroy(); return }
          setPageCount(pdf.numPages)
          setDocumentPdf(pdf)
        } else {
          const { renderAsync } = await import('docx-preview')
          if (!active || !docxRef.current) return
          await renderAsync(data, docxRef.current, undefined, { inWrapper: true, ignoreWidth: true })
          if (active) setMessage('')
        }
      } catch {
        if (active) setMessage('پیش‌نمایش فایل در دسترس نیست. می‌توانید فایل را دانلود یا در زبانه جدید باز کنید.')
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
      if (pdf) void pdf.destroy()
    }
  }, [url, type])

  useEffect(() => {
    const container = viewportRef.current
    if (!container || type !== 'pdf') return
    const measure = () => {
      // The page container has 16px horizontal padding and 12px vertical padding.
      // Fit the entire PDF page inside the visible area, then let zoom deliberately overflow.
      const next = { width: Math.max(1, container.clientWidth - 32), height: Math.max(1, container.clientHeight - 24) }
      setAvailableSize(previous => previous.width === next.width && previous.height === next.height ? previous : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [type])

  useEffect(() => {
    if (!documentPdf || !canvasRef.current || !availableSize.width || !availableSize.height) return
    let cancelled = false
    let task: RenderTask | null = null
    const canvas = canvasRef.current
    const render = async () => {
      try {
        setMessage('در حال آماده‌سازی صفحه…')
        const page = await documentPdf.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const cssScale = Math.min(1.5, availableSize.width / base.width, availableSize.height / base.height) * zoom
        const display = page.getViewport({ scale: cssScale })
        // Keep a sharp display without allocating unbounded canvases on phones.
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (display.width * display.height)))
        const renderViewport = page.getViewport({ scale: cssScale * pixelRatio })
        const buffer = document.createElement('canvas')
        buffer.dir = 'ltr'
        buffer.width = Math.ceil(renderViewport.width)
        buffer.height = Math.ceil(renderViewport.height)
        const context = buffer.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        // PDF drawing coordinates are always LTR, even inside a Persian RTL page.
        context.direction = 'ltr'
        task = page.render({ canvasContext: context, canvas: buffer, viewport: renderViewport })
        await task.promise
        if (cancelled) return
        canvas.width = buffer.width
        canvas.height = buffer.height
        canvas.style.width = `${display.width}px`
        canvas.style.height = `${display.height}px`
        const target = canvas.getContext('2d')
        if (!target) throw new Error('Canvas unavailable')
        target.drawImage(buffer, 0, 0)
        setMessage('')
      } catch {
        if (!cancelled) setMessage('نمایش این صفحه امکان‌پذیر نیست. لطفاً فایل را دانلود کنید.')
      }
    }
    void render()
    return () => { cancelled = true; task?.cancel() }
  }, [documentPdf, pageNumber, zoom, availableSize])

  return (
    <div className="document-preview" dir="rtl">
      {type === 'pdf' && pageCount > 0 && (
        <div className="pdf-toolbar" aria-label="کنترل‌های نمایش فایل PDF">
          <div className="pdf-pagination" role="group" aria-label="صفحه‌های فایل">
            <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(n => n - 1)} className="pdf-nav-button" aria-label="صفحه قبل">
              <ChevronRight size={18} aria-hidden="true" /><span>صفحه قبل</span>
            </button>
            <div className="pdf-page-indicator" aria-live="polite">
              <span>صفحه <strong>{pageNumber.toLocaleString('fa-IR')}</strong> از {pageCount.toLocaleString('fa-IR')}</span>
            </div>
            <button type="button" disabled={pageNumber >= pageCount} onClick={() => setPageNumber(n => n + 1)} className="pdf-nav-button" aria-label="صفحه بعد">
              <span>صفحه بعد</span><ChevronLeft size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="pdf-zoom" role="group" aria-label="بزرگ‌نمایی فایل">
            <button type="button" disabled={zoom <= 1} onClick={() => setZoom(n => Math.max(1, +(n - 0.25).toFixed(2)))} aria-label="کوچک کردن"><Minus size={16} /></button>
            <span dir="ltr">{Math.round(zoom * 100).toLocaleString('fa-IR')}٪</span>
            <button type="button" disabled={zoom >= 2.5} onClick={() => setZoom(n => Math.min(2.5, +(n + 0.25).toFixed(2)))} aria-label="بزرگ کردن"><Plus size={16} /></button>
          </div>
        </div>
      )}
      <div ref={viewportRef} className={`document-preview-viewport ${type === 'pdf' ? 'pdf-viewport' : ''}`} dir={type === 'pdf' ? 'ltr' : 'rtl'}>
        {message && <p role="status" className="document-preview-message" dir="rtl">{message}</p>}
        {type === 'pdf' ? (
          <div className="pdf-page-container"><canvas ref={canvasRef} dir="ltr" className="pdf-page-canvas" aria-label={`صفحه ${pageNumber} فایل PDF`} /></div>
        ) : <div ref={docxRef} className="text-right text-slate-900" />}
      </div>
    </div>
  )
}
