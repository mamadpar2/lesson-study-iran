import { useEffect, useRef } from 'react'

/**
 * Lightning Text — adapted from the 21st.dev "lightning-text" component.
 * Differences from the original:
 *  - transparent canvas (no black full-screen background) so it can sit on the hero sky
 *  - sized to its container, not the window; device-pixel aware
 *  - RTL/Persian text, revealed right-to-left so connected letters appear naturally
 *  - TypeScript, no `any`
 */

type Point = { x: number; y: number }

class Thunder {
  lifespan: number
  maxlife: number
  color: string
  glow: string
  x: number
  y: number
  width: number
  segments: { direct: number; length: number; change: number }[]

  constructor(p: Point, scale: number) {
    this.lifespan = Math.round(Math.random() * 8 + 8)
    this.maxlife = this.lifespan
    this.color = '#fffdf5'
    this.glow = '#f4cda2'
    this.x = p.x
    this.y = p.y
    this.width = 1.4
    const direct = Math.random() * Math.PI * 2
    const max = Math.round(Math.random() * 6 + 8)
    this.segments = Array.from({ length: max }, () => ({
      direct: direct + (Math.PI * Math.random() * 0.2 - 0.1),
      length: (Math.random() * 6 + 10) * scale,
      change: Math.random() * 0.04 - 0.02,
    }))
  }

  update() {
    this.segments.forEach((s) => {
      s.direct += s.change
      if (Math.random() > 0.96) s.change *= -1
    })
    this.lifespan--
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.lifespan <= 0) return
    ctx.beginPath()
    ctx.globalAlpha = this.lifespan / this.maxlife
    ctx.strokeStyle = this.color
    ctx.lineWidth = this.width
    ctx.shadowBlur = 18
    ctx.shadowColor = this.glow
    ctx.moveTo(this.x, this.y)
    let prev: Point = { x: this.x, y: this.y }
    this.segments.forEach((s) => {
      const x = prev.x + Math.cos(s.direct) * s.length
      const y = prev.y + Math.sin(s.direct) * s.length
      prev = { x, y }
      ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.closePath()
    ctx.shadowBlur = 0

    const strength = Math.random() * 40 + 24
    const light = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, strength)
    light.addColorStop(0, 'rgba(250, 205, 130, 0.55)')
    light.addColorStop(0.15, 'rgba(250, 205, 130, 0.18)')
    light.addColorStop(0.5, 'rgba(250, 205, 130, 0.04)')
    light.addColorStop(1, 'rgba(250, 205, 130, 0)')
    ctx.beginPath()
    ctx.fillStyle = light
    ctx.arc(this.x, this.y, strength, 0, Math.PI * 2)
    ctx.fill()
    ctx.closePath()
  }
}

class Spark {
  x: number
  y: number
  prev: Point
  v: { direct: number; weight: number; friction: number }
  a: { change: number; min: number; max: number }
  g: { direct: number; weight: number }
  width: number
  lifespan: number
  maxlife: number
  color = '#f8d58a'

  constructor(p: Point) {
    this.x = p.x
    this.y = p.y
    this.prev = { x: p.x, y: p.y }
    const direct = Math.random() * Math.PI * 2
    this.v = { direct, weight: Math.random() * 5 + 1, friction: 0.88 }
    this.a = { change: Math.random() * 0.4 - 0.2, min: direct - Math.PI * 0.4, max: direct + Math.PI * 0.4 }
    this.g = { direct: Math.PI * 0.5 + (Math.random() * 0.4 - 0.2), weight: Math.random() * 0.2 + 0.15 }
    this.width = Math.random() * 1.6 + 0.4
    this.lifespan = Math.round(Math.random() * 16 + 24)
    this.maxlife = this.lifespan
  }

  update() {
    this.prev = { x: this.x, y: this.y }
    this.x += Math.cos(this.v.direct) * this.v.weight + Math.cos(this.g.direct) * this.g.weight
    this.y += Math.sin(this.v.direct) * this.v.weight + Math.sin(this.g.direct) * this.g.weight
    if (this.v.weight > 0.2) this.v.weight *= this.v.friction
    this.v.direct += this.a.change
    if (this.v.direct > this.a.max || this.v.direct < this.a.min) this.a.change *= -1
    this.lifespan--
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.lifespan <= 0) return
    ctx.beginPath()
    ctx.globalAlpha = this.lifespan / this.maxlife
    ctx.strokeStyle = this.color
    ctx.lineWidth = this.width
    ctx.moveTo(this.x, this.y)
    ctx.lineTo(this.prev.x, this.prev.y)
    ctx.stroke()
    ctx.closePath()
  }
}

class Particles {
  sparks: Spark[]
  constructor(p: Point) {
    this.sparks = Array.from({ length: Math.round(Math.random() * 6 + 6) }, () => new Spark(p))
  }
  update() {
    this.sparks.forEach((s) => s.update())
    this.sparks = this.sparks.filter((s) => s.lifespan > 0)
  }
  render(ctx: CanvasRenderingContext2D) {
    this.sparks.forEach((s) => s.render(ctx))
  }
  get alive() {
    return this.sparks.length > 0
  }
}

class RevealText {
  data: ImageData
  x: number
  y: number
  width: number
  height: number
  index = 0 // revealed columns, counted from the right edge (RTL)
  delay: number
  basedelay: number
  hold = 0
  columnMask: Uint8Array

  constructor(opts: { copy: string; font: string; size: number; color: string; stroke: string }, w: number, h: number) {
    const pool = document.createElement('canvas')
    pool.width = Math.max(1, w)
    pool.height = Math.max(1, h)
    const buffer = pool.getContext('2d')!
    buffer.direction = 'rtl'
    buffer.textAlign = 'center'
    buffer.textBaseline = 'middle'
    buffer.font = `${opts.size}px ${opts.font}`
    buffer.lineJoin = 'round'
    buffer.lineWidth = Math.max(2, opts.size * 0.08)
    buffer.strokeStyle = opts.stroke
    buffer.strokeText(opts.copy, w / 2, h / 2)
    buffer.fillStyle = opts.color
    buffer.fillText(opts.copy, w / 2, h / 2)

    const m = buffer.measureText(opts.copy)
    this.width = Math.min(w, Math.ceil(m.width + opts.size * 0.6))
    this.height = h
    this.x = Math.max(0, Math.floor(w / 2 - this.width / 2))
    this.y = 0
    this.data = buffer.getImageData(this.x, 0, this.width, h)
    this.delay = 1
    this.basedelay = this.delay

    // precompute which columns contain glyph pixels so lightning only strikes on strokes
    this.columnMask = new Uint8Array(this.width)
    const d = this.data.data
    for (let c = 0; c < this.width; c++) {
      for (let r = 0; r < h; r += 2) {
        if (d[(r * this.width + c) * 4 + 3] > 40) {
          this.columnMask[c] = 1
          break
        }
      }
    }
  }

  /** returns y positions of glyph pixels in the current column (sampled) */
  strikePoints(col: number): number[] {
    const out: number[] = []
    const d = this.data.data
    for (let r = 0; r < this.height; r += 3) {
      if (d[(r * this.width + col) * 4 + 3] > 40 && Math.random() > 0.9) out.push(r)
    }
    return out
  }

  update(thunder: Thunder[], particles: Particles[], scale: number) {
    if (this.index >= this.width) {
      // fully revealed: hold, then loop
      if (this.hold++ > 420) {
        this.hold = 0
        this.index = 0
      }
      return
    }
    const col = this.width - 1 - this.index
    if (this.columnMask[col]) {
      for (const r of this.strikePoints(col)) {
        const p = { x: this.x + col, y: this.y + r }
        if (Math.random() > 0.35) thunder.push(new Thunder(p, scale))
        if (Math.random() > 0.5) particles.push(new Particles(p))
      }
    }
    if (this.delay-- < 0) {
      this.index += 3
      this.delay += this.basedelay
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const revealed = Math.min(this.index, this.width)
    if (revealed <= 0) return
    const sx = this.width - revealed
    ctx.putImageData(this.data, this.x, this.y, sx, 0, revealed, this.height)
  }
}

export type LightningTextProps = {
  text: string
  fontFamily?: string
  fontSize?: number
  /** Pixels to reduce after fitting to the available width. */
  fontSizeReduction?: number
  color?: string
  stroke?: string
  className?: string
  height?: number
}

export default function LightningText({
  text,
  fontFamily = "'B Titr', 'Vazirmatn', sans-serif",
  fontSize = 48,
  fontSizeReduction = 0,
  color = '#fff8ea',
  stroke = 'rgba(23, 33, 36, 0.55)',
  className,
  height = 110,
}: LightningTextProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let text_: RevealText | null = null
    let thunder: Thunder[] = []
    let particles: Particles[] = []
    let w = 0
    let h = 0
    let scale = 1

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      canvas.width = w
      canvas.height = h
      scale = Math.min(1, w / 900)
      // Measure the shaped Persian text rather than estimating from character count.
      // This keeps the complete title inside the strip on narrow screens.
      let size = fontSize
      ctx.font = `${size}px ${fontFamily}`
      while (size > 14 && ctx.measureText(text).width > w - 24) {
        size -= 1
        ctx.font = `${size}px ${fontFamily}`
      }
      // Apply the requested reduction after responsive fitting, including mobile.
      size = Math.max(12, size - Math.max(0, fontSizeReduction))
      canvas.dataset.renderedFontSize = String(size)
      text_ = new RevealText({ copy: text, font: fontFamily, size, color, stroke }, w, h)
      if (reduced) text_.index = text_.width
      thunder = []
      particles = []
    }

    const loop = () => {
      if (!text_) return
      text_.update(thunder, particles, scale)
      thunder.forEach((t) => t.update())
      thunder = thunder.filter((t) => t.lifespan > 0)
      particles.forEach((p) => p.update())
      particles = particles.filter((p) => p.alive)

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, w, h)
      text_.render(ctx)
      ctx.globalCompositeOperation = 'lighter'
      thunder.forEach((t) => t.render(ctx))
      particles.forEach((p) => p.render(ctx))
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1

      if (!reduced) raf = requestAnimationFrame(loop)
    }

    const start = () => {
      build()
      cancelAnimationFrame(raf)
      loop()
    }

    // wait for local fonts so the glyph bitmap uses the right typeface
    let mounted = true
    const ready = 'fonts' in document ? document.fonts.load(`${fontSize}px ${fontFamily}`).then(() => undefined) : Promise.resolve()
    ready.catch(() => undefined).finally(() => { if (mounted) start() })

    const ro = new ResizeObserver(() => start())
    ro.observe(canvas)

    const onClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const p = { x: e.clientX - r.left, y: e.clientY - r.top }
      thunder.push(new Thunder(p, scale))
      particles.push(new Particles(p))
    }
    canvas.addEventListener('click', onClick)

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('click', onClick)
    }
  }, [text, fontFamily, fontSize, fontSizeReduction, color, stroke])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height }}
      aria-hidden="true"
    />
  )
}
