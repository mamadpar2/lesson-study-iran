'use client'

// A curl-noise flock that sequentially assembles:
// Stage 0: The authentic Secretariat emblem (5 colored people + crescent, 44 source colors).
// Subsequent stages form the Persian words «درس‌پژوهی» and «درس‌کاوی».
// Optional extra shapes can be inserted before the words when requested.
// Transitions occur seamlessly during free murmuration flight (pull = 0).
// React + Canvas only; no runtime asset fetching.

import * as React from 'react'

export interface MurmurationPalette {
  skyTop: string
  skyLow: string
  sun: string
  /** Reeds and ink. */
  ink: string
}

export type MurmurationPreset = 'dusk' | 'dawn' | 'paper' | 'night'

export interface MurmurationShape {
  id: string
  label: string
  width: number
  height: number
  /** Actual RGB colors sampled from the original artwork. */
  colors: readonly string[]
  /** Packed targets: x:9, y:9, color:6, piece:3 bits; coordinates 0–511. */
  points: readonly number[]
  /** Normalized departure points and staggered arrival times in seconds. */
  pieces: readonly { name: string; origin: readonly number[]; delay: number }[]
}

export interface StageTiming {
  name: string
  type: 'logo' | 'shape' | 'word'
  label: string
  flyFor: number
  assembleFor: number
  stagger: number
  holdFor: number
  releaseFor: number
}

export interface MurmurationWordmarkProps {
  /** Used when no shape is supplied. Short, bold words read best. */
  word?: string
  /** A sampled, colored logo. The original word API remains supported. */
  shape?: MurmurationShape
  /** Additional sampled logos formed after the main logo and before the words. */
  extraShapes?: readonly MurmurationShape[]
  /** Sequential words to form in cycle with the logos. */
  words?: readonly string[]
  /** Callback fired when the active stage index changes. */
  onStageChange?: (stageIndex: number, stageName: string) => void
  /** Increment to restart the complete flight/assembly sequence from stage 0. */
  replayKey?: number
  /** Number of birds, reduced responsively. Defaults to 4200. */
  birds?: number
  preset?: MurmurationPreset
  /** Sky/reed overrides; logo colors are never tinted by this. */
  palette?: { skyTop?: string; skyLow?: string; sun?: string; ink?: string }
  flyFor?: number
  holdFor?: number
  reeds?: boolean
  interactive?: boolean
  fontFamily?: string
  children?: React.ReactNode
  /** A definite CSS length, never a percentage. */
  height?: string
  className?: string
  /** Keeps the last rendered frame, without advancing the simulation. */
  paused?: boolean
}

const PRESETS: { [K in MurmurationPreset]: MurmurationPalette } = {
  dusk: { skyTop: '#1d2b44', skyLow: '#e89a6a', sun: '#ffd2a0', ink: '#14100f' },
  dawn: { skyTop: '#9fb4c9', skyLow: '#f3d6c2', sun: '#fff3df', ink: '#1f2329' },
  paper: { skyTop: '#efe9dd', skyLow: '#e6ddcc', sun: '#ffffff', ink: '#1a1714' },
  night: { skyTop: '#05070d', skyLow: '#1a2236', sun: '#4a5d86', ink: '#dfe6f5' },
}

const SANS_STACK = "'B Titr', 'BTitr', Arial, sans-serif"

// #region flock
// Pure helpers, lifted out and executed by tests/murmuration-wordmark.test.mjs.

/** Small seeded PRNG (mulberry32). */
export function mmwRandom(seed: number) {
  let a = seed >>> 0 || 1
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Divergence-free travelling-wave current: the curl of a scalar field. */
export function mmwCurl(x: number, y: number, t: number) {
  const a = 1.7 * x + t
  const b = 1.3 * y - 0.6 * t
  const c = 2.9 * y + 1.1 * x - 0.8 * t
  const d = 4.3 * x - 3.7 * y + 1.3 * t
  const dpdx = 1.7 * Math.cos(a) * Math.cos(b) + 0.6 * 1.1 * Math.cos(c) - 0.35 * 4.3 * Math.sin(d)
  const dpdy = -1.3 * Math.sin(a) * Math.sin(b) + 0.6 * 2.9 * Math.cos(c) + 0.35 * 3.7 * Math.sin(d)
  return [dpdy, -dpdx]
}

/** The flock's wandering centre in unit space. */
export function mmwCentre(t: number) {
  return [0.42 * Math.sin(t * 0.21) + 0.12 * Math.sin(t * 0.53 + 1), 0.16 * Math.sin(t * 0.33 + 2) - 0.08]
}

export function mmwEase(k: number) {
  const x = k < 0 ? 0 : k > 1 ? 1 : k
  return x * x * (3 - 2 * x)
}

/** Assign and shuffle targets; reuse round-robin if there are more birds. */
export function mmwAssign(birds: number, points: number, seed: number) {
  const out = new Int32Array(birds)
  if (points <= 0) return out.fill(-1)
  const order = new Int32Array(points)
  for (let i = 0; i < points; i++) order[i] = i
  const rand = mmwRandom(seed)
  for (let i = points - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  for (let i = 0; i < birds; i++) out[i] = order[i % points]
  return out
}

/** A color at an alpha, for #rgb / #rrggbb. */
export function mmwAlpha(hex: string, alpha: number) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return hex
  const h =
    m[1].length === 3
      ? m[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : m[1]
  return (
    'rgba(' +
    parseInt(h.slice(0, 2), 16) +
    ',' +
    parseInt(h.slice(2, 4), 16) +
    ',' +
    parseInt(h.slice(4, 6), 16) +
    ',' +
    alpha +
    ')'
  )
}

/** Decode a compact target without changing any source color or silhouette. */
export function mmwShapePoint(point: number) {
  return { x: point & 511, y: (point >>> 9) & 511, color: (point >>> 18) & 63, piece: (point >>> 24) & 7 }
}

/** One shared cycle, with an independent arrival delay for each logo piece. */
export function mmwFormation(
  time: number,
  options: { flyFor: number; holdFor: number; assembleFor?: number; stagger?: number; releaseFor?: number },
  delay = 0,
) {
  const fly = Math.max(0.5, options.flyFor)
  const hold = Math.max(0.5, options.holdFor)
  const assemble = Math.max(0.1, options.assembleFor ?? 2.4)
  const stagger = Math.max(0, options.stagger ?? 0)
  const release = Math.max(0.1, options.releaseFor ?? 0.6)
  const holdStart = fly + assemble + stagger
  const releaseStart = holdStart + hold
  const cycle = releaseStart + release
  let elapsed = time % cycle
  if (elapsed < 0) elapsed += cycle
  const state =
    elapsed < fly
      ? 'flying'
      : elapsed < holdStart
        ? 'forming'
        : elapsed < releaseStart
          ? 'holding'
          : 'releasing'
  const pull =
    elapsed < releaseStart
      ? mmwEase((elapsed - fly - Math.min(stagger, Math.max(0, delay))) / assemble)
      : 1 - mmwEase((elapsed - releaseStart) / release)
  return { pull, state, elapsed, cycle }
}

/** Multi-stage timeline: calculates current active stage index and local stage elapsed time. */
export function mmwStage(clock: number, stages: readonly StageTiming[]) {
  if (!stages || stages.length === 0) {
    return { stageIndex: 0, stageTime: 0, totalCycle: 1 }
  }
  const durations = stages.map(
    (s) => Math.max(0.5, s.flyFor) + Math.max(0.1, s.assembleFor) + Math.max(0, s.stagger) + Math.max(0.5, s.holdFor) + Math.max(0.1, s.releaseFor),
  )
  const totalCycle = durations.reduce((a, b) => a + b, 0)
  let elapsed = clock % totalCycle
  if (elapsed < 0) elapsed += totalCycle
  let accumulated = 0
  for (let i = 0; i < stages.length; i++) {
    const d = durations[i]
    if (elapsed < accumulated + d || i === stages.length - 1) {
      return {
        stageIndex: i,
        stageTime: elapsed - accumulated,
        stageDuration: d,
        totalCycle,
      }
    }
    accumulated += d
  }
  return {
    stageIndex: 0,
    stageTime: 0,
    stageDuration: durations[0],
    totalCycle,
  }
}

/** Fit the original mark without stretching, leaving room for its caption. */
export function mmwShapeFit(
  w: number,
  h: number,
  markW: number,
  markH: number,
  fit: { center?: number; width?: number; height?: number; offsetY?: number } = {},
) {
  const compact = w < 600
  const scale = Math.min(
    (w * (fit.width ?? (compact ? 0.88 : 0.74))) / Math.max(1, markW),
    (h * (fit.height ?? (compact ? 0.72 : 0.72))) / Math.max(1, markH),
  )
  const centerX = w * (fit.center ?? 0.5)
  const top = Math.max(0, Math.min(h - markH * scale, (h - markH * scale) * 0.44 + (fit.offsetY ?? 0)))
  return {
    scale,
    left: centerX - (markW * scale) / 2,
    top,
    centerX,
    captionTop: top + markH * scale + (compact ? 11 : 12),
  }
}

/** Evaluates a 3D cubic Bezier curve point & derivative */
function mmwEvalBezier(
  p0: readonly [number, number, number],
  p1: readonly [number, number, number],
  p2: readonly [number, number, number],
  p3: readonly [number, number, number],
  u: number,
) {
  const u2 = u * u
  const u3 = u2 * u
  const inv = 1 - u
  const inv2 = inv * inv
  const inv3 = inv2 * inv

  const x = inv3 * p0[0] + 3 * inv2 * u * p1[0] + 3 * inv * u2 * p2[0] + u3 * p3[0]
  const y = inv3 * p0[1] + 3 * inv2 * u * p1[1] + 3 * inv * u2 * p2[1] + u3 * p3[1]
  const z = inv3 * p0[2] + 3 * inv2 * u * p1[2] + 3 * inv * u2 * p2[2] + u3 * p3[2]

  const dx = 3 * inv2 * (p1[0] - p0[0]) + 6 * inv * u * (p2[0] - p1[0]) + 3 * u2 * (p3[0] - p2[0])
  const dy = 3 * inv2 * (p1[1] - p0[1]) + 6 * inv * u * (p2[1] - p1[1]) + 3 * u2 * (p3[1] - p2[1])
  const dz = 3 * inv2 * (p1[2] - p0[2]) + 6 * inv * u * (p2[2] - p1[2]) + 3 * u2 * (p3[2] - p2[2])

  return { x, y, z, dx, dy, dz }
}

/** Adjusts hex color brightness/saturation for natural feathered tonal depth */
function mmwShadeColor(hex: string, percent: number) {
  if (!hex || hex[0] !== '#') return hex
  let num = parseInt(hex.slice(1), 16)
  if (hex.length === 4) {
    const r = ((num >> 8) & 0xf) * 17
    const g = ((num >> 4) & 0xf) * 17
    const b = (num & 0xf) * 17
    num = (r << 16) | (g << 8) | b
  }
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round(255 * (percent / 100))))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100))))
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round(255 * (percent / 100))))
  return `rgb(${r},${g},${b})`
}

/** Renders an anatomically graceful, realistic starling/swift silhouette in authentic logo colors (no black) */
function drawRealisticBird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  vx: number,
  vy: number,
  span: number,
  flapCycle: number,
  roll = 0,
  color = '#f37023',
  alpha = 1,
) {
  ctx.save()
  ctx.translate(x, y)

  const speed = Math.hypot(vx, vy)
  const heading = speed > 0.001 ? Math.atan2(vy, vx) : 0
  ctx.rotate(heading)
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))

  // Natural starling flap-glide duty cycle:
  // Flap for ~60% of cycle, glide with slight dihedral for ~40%
  const cycleMod = flapCycle % (Math.PI * 2)
  const isFlapping = cycleMod < Math.PI * 1.35
  const flapPhase = isFlapping ? cycleMod / 1.35 : 0
  const flapSin = isFlapping ? Math.sin(flapPhase * 2) : 0.15

  // 3D Roll foreshortening:
  const cosRoll = Math.cos(roll)
  const sinRoll = Math.sin(roll)
  const leftSpan = span * Math.max(0.32, cosRoll - sinRoll * 0.45)
  const rightSpan = span * Math.max(0.32, cosRoll + sinRoll * 0.45)

  const wingSweep = span * (0.82 - flapSin * 0.14)
  const wingDip = span * flapSin * 0.38

  const bodyLen = span * 0.88
  const bodyW = span * 0.16
  const headLen = span * 0.28
  const tailLen = span * 0.58

  // Authentic logo color with feathered tonal depth
  const deepTone = mmwShadeColor(color, -22)
  const brightTone = mmwShadeColor(color, 24)

  if (span > 12) {
    ctx.shadowColor = 'rgba(10, 18, 28, 0.35)'
    ctx.shadowBlur = span * 0.32
    ctx.shadowOffsetY = span * 0.2
  }

  // Left wing (-Y)
  ctx.beginPath()
  ctx.moveTo(bodyLen * 0.12, -bodyW * 0.4)
  const lWristX = bodyLen * 0.2
  const lWristY = -leftSpan * 0.46
  const lTipX = -wingSweep * 0.24
  const lTipY = -leftSpan + wingDip

  ctx.bezierCurveTo(bodyLen * 0.28, -leftSpan * 0.2, lWristX, lWristY, lTipX, lTipY)
  ctx.bezierCurveTo(
    lTipX - span * 0.14,
    lTipY * 0.8,
    -bodyLen * 0.1,
    -leftSpan * 0.32,
    -bodyLen * 0.28,
    -bodyW * 0.32,
  )
  ctx.closePath()

  const lGrad = ctx.createLinearGradient(0, 0, lTipX, lTipY)
  lGrad.addColorStop(0, color)
  lGrad.addColorStop(0.5, brightTone)
  lGrad.addColorStop(1, color)
  ctx.fillStyle = lGrad
  ctx.fill()

  if (span > 10) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = Math.max(0.6, span * 0.025)
    ctx.stroke()
  }

  // Right wing (+Y)
  ctx.beginPath()
  ctx.moveTo(bodyLen * 0.12, bodyW * 0.4)
  const rWristX = bodyLen * 0.2
  const rWristY = rightSpan * 0.46
  const rTipX = -wingSweep * 0.24
  const rTipY = rightSpan - wingDip

  ctx.bezierCurveTo(bodyLen * 0.28, rightSpan * 0.2, rWristX, rWristY, rTipX, rTipY)
  ctx.bezierCurveTo(
    rTipX - span * 0.14,
    rTipY * 0.8,
    -bodyLen * 0.1,
    rightSpan * 0.32,
    -bodyLen * 0.28,
    bodyW * 0.32,
  )
  ctx.closePath()

  const rGrad = ctx.createLinearGradient(0, 0, rTipX, rTipY)
  rGrad.addColorStop(0, color)
  rGrad.addColorStop(0.5, brightTone)
  rGrad.addColorStop(1, color)
  ctx.fillStyle = rGrad
  ctx.fill()

  if (span > 10) {
    ctx.stroke()
    ctx.shadowColor = 'transparent'
  }

  // Forked tail
  ctx.beginPath()
  ctx.moveTo(-bodyLen * 0.26, -bodyW * 0.3)
  ctx.lineTo(-bodyLen * 0.26 - tailLen, -bodyW * 0.8)
  ctx.quadraticCurveTo(-bodyLen * 0.26 - tailLen * 0.65, 0, -bodyLen * 0.26 - tailLen, bodyW * 0.8)
  ctx.lineTo(-bodyLen * 0.26, bodyW * 0.3)
  ctx.closePath()
  ctx.fillStyle = deepTone
  ctx.fill()

  // Fuselage body in authentic logo color
  ctx.beginPath()
  ctx.moveTo(bodyLen * 0.48 + headLen, 0)
  ctx.bezierCurveTo(
    bodyLen * 0.48 + headLen * 0.3,
    -bodyW * 0.38,
    bodyLen * 0.2,
    -bodyW * 0.52,
    0,
    -bodyW * 0.48,
  )
  ctx.bezierCurveTo(-bodyLen * 0.22, -bodyW * 0.4, -bodyLen * 0.32, -bodyW * 0.18, -bodyLen * 0.42, 0)
  ctx.bezierCurveTo(-bodyLen * 0.32, bodyW * 0.18, -bodyLen * 0.22, bodyW * 0.4, 0, bodyW * 0.48)
  ctx.bezierCurveTo(
    bodyLen * 0.2,
    bodyW * 0.52,
    bodyLen * 0.48 + headLen * 0.3,
    bodyW * 0.38,
    bodyLen * 0.48 + headLen,
    0,
  )
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // Dorsal rim highlight catching the twilight sun
  if (span > 8) {
    ctx.beginPath()
    ctx.moveTo(bodyLen * 0.42, 0)
    ctx.lineTo(-bodyLen * 0.2, 0)
    ctx.lineWidth = Math.max(0.8, span * 0.04)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  ctx.restore()
}
// #endregion

const MMW_CSS = `
.mmw-root { position: relative; width: 100%; overflow: hidden; isolation: isolate; background: var(--mmw-sky); }
.mmw-root > canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; max-width: none; }
.mmw-root > .mmw-sky-canvas { z-index: 0; pointer-events: none; }
.mmw-root > .mmw-bird-canvas { z-index: 2; pointer-events: none; }
.mmw-over { position: relative; z-index: 1; height: 100%; pointer-events: none; }
.mmw-over [data-interactive], .mmw-over a, .mmw-over button { pointer-events: auto; }
.mmw-sr { position: absolute; top: 0; left: 0; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); clip-path: inset(50%); white-space: nowrap; border: 0; opacity: 0; pointer-events: none; }
`

export default function MurmurationWordmark({
  word = 'flock',
  shape,
  extraShapes,
  words = ['درس‌پژوهی', 'درس‌کاوی'],
  onStageChange,
  replayKey = 0,
  birds = 4200,
  preset = 'dusk',
  palette,
  flyFor = 2.2,
  holdFor = 5.2,
  reeds = true,
  interactive = true,
  fontFamily = SANS_STACK,
  children,
  height = '100svh',
  className = '',
  paused = false,
}: MurmurationWordmarkProps) {
  const colors = { ...(PRESETS[preset] || PRESETS.dusk), ...(palette || {}) }
  const rootRef = React.useRef<HTMLDivElement | null>(null)
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const skyRef = React.useRef<HTMLCanvasElement | null>(null)
  const srRef = React.useRef<HTMLSpanElement | null>(null)
  const opts = React.useRef({ flyFor, holdFor, interactive, paused, onStageChange })
  opts.current = { flyFor, holdFor, interactive, paused, onStageChange }
  const wordsKey = words ? words.join('~') : ''
  const key = [
    word,
    wordsKey,
    birds,
    colors.skyTop,
    colors.skyLow,
    colors.sun,
    colors.ink,
    reeds,
    fontFamily,
    replayKey,
  ].join('|')

  React.useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const skyCanvas = skyRef.current
    if (!root || !canvas || !skyCanvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches
    let reduced = reducedQuery.matches
    let compact = false
    let lastFrameAt = 0
    let w = 1,
      h = 1,
      dpr = 1,
      n = 0,
      raf = 0
    let visible = true
    let needsPaint = true
    let px = new Float32Array(0),
      py = new Float32Array(0)
    let vx = new Float32Array(0),
      vy = new Float32Array(0)
    let depth = new Float32Array(0),
      phase = new Float32Array(0)
    let birdPull = new Float32Array(0)
    let batches: number[][] = []
    let markScale = 1
    let hx = -1e5,
      hy = -1e5
    let last = performance.now()
    let clock = 0
    const rand = mmwRandom(11)
    // Keep the original palette indices intact and add any additional logo colors.
    const birdColors = [...(shape?.colors.length ? shape.colors : [colors.ink])]
    for (const extra of extraShapes || []) {
      for (const color of extra.colors) if (!birdColors.includes(color)) birdColors.push(color)
    }
    const stagger = shape ? Math.max(0, ...shape.pieces.map((piece) => piece.delay)) : 0

    // Targets storage per stage
    let stage0_tx = new Float32Array(0)
    let stage0_ty = new Float32Array(0)
    let stage0_color = new Uint8Array(0)
    let stage0_piece = new Uint8Array(0)
    let target0 = new Int32Array(0)

    interface WordStageData {
      word: string
      type: 'shape' | 'word'
      label: string
      tx: Float32Array
      ty: Float32Array
      color: Uint8Array
      target: Int32Array
    }
    let wordStagesData: WordStageData[] = []
    let stagesTiming: StageTiming[] = []
    let lastStageIndex = -1

    interface HeroSwooper {
      birdIndex: number
      color: string
      p0: [number, number, number]
      p1: [number, number, number]
      p2: [number, number, number]
      p3: [number, number, number]
      phase: number
      bank: number
      z: number
    }
    let heroSwoopers: HeroSwooper[] = []

    const rebuildBatches = (activeStageIdx: number) => {
      batches = Array.from({ length: birdColors.length * 2 }, () => [])
      for (let i = 0; i < n; i++) {
        let col = 0
        if (activeStageIdx === 0) {
          const ti = target0[i]
          col = ti >= 0 ? stage0_color[ti] : 0
        } else {
          const ws = wordStagesData[activeStageIdx - 1]
          if (ws) {
            const ti = ws.target[i]
            col = ti >= 0 ? ws.color[ti] : 36
          }
        }
        batches[col * 2 + (depth[i] > 0.78 ? 1 : 0)]?.push(i)
      }

      // Update hero swoopers' takeoff and destination for the active stage
      if (heroSwoopers.length > 0) {
        for (let k = 0; k < heroSwoopers.length; k++) {
          const hs = heroSwoopers[k]
          const bi = hs.birdIndex
          hs.p0 = [px[bi] || w / 2, py[bi] || h * 0.44, 0]
          if (activeStageIdx > 0 && wordStagesData[activeStageIdx - 1]) {
            const ws = wordStagesData[activeStageIdx - 1]
            const ptIdx = Math.floor((k / heroSwoopers.length) * (ws.tx.length - 1))
            hs.p3 = [ws.tx[ptIdx] || w / 2, ws.ty[ptIdx] || h * 0.44, 0]
            hs.color = birdColors[ws.color[ptIdx]] || '#64cafb'
          } else if (activeStageIdx === 0 && stage0_tx.length > 0) {
            const ti = target0[bi] >= 0 ? target0[bi] : k
            hs.p3 = [stage0_tx[ti] || w / 2, stage0_ty[ti] || h * 0.44, 0]
            hs.color = birdColors[stage0_color[ti]] || colors.ink
          }
        }
      }
    }

    const layout = () => {
      needsPaint = true
      const oldW = w,
        oldH = h
      const rect = root.getBoundingClientRect()
      w = Math.max(1, Math.round(rect.width))
      h = Math.max(1, Math.round(rect.height))
      compact = w < 600 || (coarsePointer && w < 900)
      dpr = Math.min(window.devicePixelRatio || 1, compact ? 1.25 : 2)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      skyCanvas.width = canvas.width
      skyCanvas.height = canvas.height
      const s = skyCanvas.getContext('2d')
      if (s) {
        s.setTransform(dpr, 0, 0, dpr, 0, 0)
        const g = s.createLinearGradient(0, 0, 0, h)
        g.addColorStop(0, colors.skyTop)
        g.addColorStop(0.78, colors.skyLow)
        g.addColorStop(1, colors.skyLow)
        s.fillStyle = g
        s.fillRect(0, 0, w, h)
        const sun = s.createRadialGradient(w * 0.62, h * 0.86, 0, w * 0.62, h * 0.86, Math.max(w, h) * 0.55)
        sun.addColorStop(0, colors.sun)
        sun.addColorStop(0.25, mmwAlpha(colors.sun, 0.5))
        sun.addColorStop(1, mmwAlpha(colors.sun, 0))
        s.globalAlpha = 0.55
        s.fillStyle = sun
        s.fillRect(0, 0, w, h)
        s.globalAlpha = 1
        const gr = mmwRandom(5)
        const noiseCount = Math.min(2500, Math.round((w * h) / 400))
        for (let i = 0; i < noiseCount; i++) {
          s.fillStyle = gr() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.035)'
          s.fillRect(gr() * w, gr() * h, 1, 1)
        }
        if (reeds) {
          s.strokeStyle = colors.ink
          s.fillStyle = colors.ink
          const base = h - Math.max(6, h * 0.012)
          s.fillRect(0, base, w, h - base)
          for (let x = -10; x < w + 10; x += 2 + gr() * 9) {
            if (gr() < 0.18) x += gr() * 30
            const tall = Math.pow(gr(), 1.6) * Math.max(34, h * 0.13) + 6
            const lean = (gr() - 0.3) * 10
            s.lineWidth = 0.6 + gr() * 1.2
            s.beginPath()
            s.moveTo(x, base + 2)
            s.quadraticCurveTo(x + lean * 0.3, base - tall * 0.6, x + lean, base - tall)
            s.stroke()
            if (gr() < 0.07) {
              s.beginPath()
              s.ellipse(x + lean, base - tall - 4, 1.8, 6, lean * 0.04, 0, Math.PI * 2)
              s.fill()
            }
          }
        }
      }

      // Mobile keeps the full logo silhouette with fewer particles and lower canvas resolution.
      const responsive = shape ? Math.sqrt((w * h) / (1100 * 620)) : (w * h) / (1440 * 860)
      const particleBudget = compact ? Math.min(1450, Math.max(600, birds)) : Math.max(600, Math.min(9000, birds))
      const minimumParticles = shape ? (compact ? (extraShapes?.length ? 1550 : 1050) : 1800) : 500
      const want = Math.max(
        minimumParticles,
        Math.round(particleBudget * Math.min(1, responsive)),
      )
      const fresh = want !== n
      if (fresh) {
        n = want
        px = new Float32Array(n)
        py = new Float32Array(n)
        vx = new Float32Array(n)
        vy = new Float32Array(n)
        depth = new Float32Array(n)
        phase = new Float32Array(n)
        birdPull = new Float32Array(n)
      }

      // A CSS-controlled vertical shift moves all formations together on mobile.
      const shiftValue = Number.parseFloat(getComputedStyle(root).getPropertyValue('--mmw-formation-shift'))
      const formationOffset = h * (Number.isFinite(shiftValue) ? Math.max(0, Math.min(0.25, shiftValue)) : 0)
      root.dataset.formationOffset = String(formationOffset)
      root.dataset.formationWordCenter = String(h * 0.44 + formationOffset)

      // 1. Stage 0: Shape (Logo)
      if (shape) {
        const style = getComputedStyle(root)
        const ratio = (name: string) => {
          const value = Number.parseFloat(style.getPropertyValue(name))
          return Number.isFinite(value) && value > 0 && value <= 1 ? value : undefined
        }
        const fit = mmwShapeFit(w, h, shape.width, shape.height, {
          center: ratio('--mmw-formation-center'),
          width: ratio('--mmw-formation-width'),
          height: ratio('--mmw-formation-height'),
          offsetY: formationOffset,
        })
        root.style.setProperty('--mmw-formation-top', `${fit.top}px`)
        markScale = fit.scale
        root.style.setProperty('--mmw-mark-width', shape.width * fit.scale + 'px')
        root.style.setProperty('--mmw-mark-x', fit.centerX + 'px')
        root.style.setProperty('--mmw-caption-y', fit.captionTop + 'px')

        stage0_tx = new Float32Array(shape.points.length)
        stage0_ty = new Float32Array(shape.points.length)
        stage0_color = new Uint8Array(shape.points.length)
        stage0_piece = new Uint8Array(shape.points.length)
        for (let i = 0; i < shape.points.length; i++) {
          const point = mmwShapePoint(shape.points[i])
          stage0_tx[i] = fit.left + (point.x + (rand() - 0.5) * 0.55) * fit.scale
          stage0_ty[i] = fit.top + (point.y + (rand() - 0.5) * 0.55) * fit.scale
          stage0_color[i] = point.color
          stage0_piece[i] = point.piece
        }
        target0 = mmwAssign(n, stage0_tx.length, 23)
      } else {
        // Fallback for word-only mode
        const m = document.createElement('canvas')
        m.width = w
        m.height = h
        const mc = m.getContext('2d', { willReadFrequently: true })
        const pts: number[] = []
        if (mc) {
          mc.font = 'bold 100px ' + fontFamily
          mc.direction = /[\u0600-\u06ff]/.test(word) ? 'rtl' : 'ltr'
          const wordW = mc.measureText(word || ' ').width || 1
          const size = Math.min(((w * 0.76) / wordW) * 100, (h * 0.44) / 0.72)
          mc.font = 'bold ' + Math.round(size) + 'px ' + fontFamily
          mc.textAlign = 'center'
          mc.textBaseline = 'middle'
          mc.fillText(word || ' ', w / 2, h * 0.44 + formationOffset)
          const img = mc.getImageData(0, 0, w, h).data
          const step = Math.max(2, Math.round(Math.sqrt((w * h) / 80000)))
          for (let y = 0; y < h; y += step)
            for (let x = 0; x < w; x += step) {
              if (img[(y * w + x) * 4 + 3] > 110) pts.push(x, y)
            }
        }
        stage0_tx = new Float32Array(pts.filter((_, i) => i % 2 === 0))
        stage0_ty = new Float32Array(pts.filter((_, i) => i % 2 === 1))
        stage0_color = new Uint8Array(stage0_tx.length)
        stage0_piece = new Uint8Array(stage0_tx.length)
        target0 = mmwAssign(n, stage0_tx.length, 23)
      }

      // 2. Sequential Words Stages («درس‌پژوهی», «درس‌کاوی»)
      const activeWords = shape && words && words.length > 0 ? words : []

      // Extract authentic colors grouped by piece (Orange, Green, Pink, Purple, Blue)
      const pieceColorIndices: number[][] = [[], [], [], [], [], []]
      if (shape) {
        for (const packed of shape.points) {
          const pt = mmwShapePoint(packed)
          if (pt.piece < 6 && !pieceColorIndices[pt.piece].includes(pt.color)) {
            pieceColorIndices[pt.piece].push(pt.color)
          }
        }
      }

      // Unified Celestial Blue palette for «درس» (Piece 4 & 5 Blue & Crescent shades)
      const darsColors = [...pieceColorIndices[4], ...pieceColorIndices[5]].length
        ? [...pieceColorIndices[4], ...pieceColorIndices[5]]
        : [4]

      // Suffix palettes from logo pieces:
      // For wIdx 0 («پژوهی»): Warm Orange (Piece 0)
      // For wIdx 1 («کاوی»): Fresh Lime Green (Piece 1)
      const suffixPalettes = [
        pieceColorIndices[0].length ? pieceColorIndices[0] : [0], // Piece 0: Orange for «پژوهی»
        pieceColorIndices[1].length ? pieceColorIndices[1] : [1], // Piece 1: Green for «کاوی»
        pieceColorIndices[2].length ? pieceColorIndices[2] : [2], // Piece 2: Pink
        pieceColorIndices[3].length ? pieceColorIndices[3] : [3], // Piece 3: Purple
      ]

      const additionalLogoStages: WordStageData[] = (shape ? extraShapes || [] : []).map((extra, index) => {
        const style = getComputedStyle(root)
        const ratio = (name: string) => {
          const value = Number.parseFloat(style.getPropertyValue(name))
          return Number.isFinite(value) && value > 0 && value <= 1 ? value : undefined
        }
        const fit = mmwShapeFit(w, h, extra.width, extra.height, {
          center: ratio('--mmw-formation-center'),
          width: ratio('--mmw-formation-width'),
          height: ratio('--mmw-formation-height'),
          offsetY: formationOffset,
        })
        const tx = new Float32Array(extra.points.length)
        const ty = new Float32Array(extra.points.length)
        const color = new Uint8Array(extra.points.length)
        for (let i = 0; i < extra.points.length; i++) {
          const point = mmwShapePoint(extra.points[i])
          tx[i] = fit.left + (point.x + (rand() - 0.5) * 0.55) * fit.scale
          ty[i] = fit.top + (point.y + (rand() - 0.5) * 0.55) * fit.scale
          color[i] = Math.max(0, birdColors.indexOf(extra.colors[point.color]))
        }
        return { word: extra.id, type: 'shape', label: extra.label, tx, ty, color, target: mmwAssign(n, tx.length, 73 + index * 19) }
      })

      const additionalWordStages: WordStageData[] = activeWords.map((wText, wIdx) => {
        const m = document.createElement('canvas')
        m.width = w
        m.height = h
        const mc = m.getContext('2d', { willReadFrequently: true })
        const ptsX: number[] = []
        const ptsY: number[] = []
        const colCounts = new Int32Array(w)
        if (mc) {
          mc.font = 'bold 100px ' + fontFamily
          mc.direction = 'rtl'
          const wordW = mc.measureText(wText).width || 1
          const maxRatio = w < 600 ? 0.86 : 0.74
          const size = Math.min(((w * maxRatio) / wordW) * 100, (h * 0.44) / 0.7)
          mc.font = 'bold ' + Math.round(size) + 'px ' + fontFamily
          mc.textAlign = 'center'
          mc.textBaseline = 'middle'
          mc.fillText(wText, w / 2, h * 0.44 + formationOffset)
          const img = mc.getImageData(0, 0, w, h).data
          const step = Math.max(2, Math.round(Math.sqrt((w * h) / 75000)))
          for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
              if (img[(y * w + x) * 4 + 3] > 100) {
                ptsX.push(x + (rand() - 0.5) * step * 0.3)
                ptsY.push(y + (rand() - 0.5) * step * 0.3)
                colCounts[x]++
              }
            }
          }
        }

        let firstX = -1,
          lastX = -1
        for (let x = 0; x < w; x++) {
          if (colCounts[x] > 0) {
            if (firstX === -1) firstX = x
            lastX = x
          }
        }

        // Measure 'درس' alone with the exact same font size to locate the precise gap between 'درس' and the suffix
        let splitX = (firstX + lastX) * 0.5
        if (mc && firstX >= 0 && lastX > firstX) {
          mc.clearRect(0, 0, w, h)
          mc.fillText('درس', w / 2, h * 0.44 + formationOffset)
          const imgD = mc.getImageData(0, 0, w, h).data
          let minD = Infinity,
            maxD = -Infinity
          for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
              if (imgD[(y * w + x) * 4 + 3] > 100) {
                if (x < minD) minD = x
                if (x > maxD) maxD = x
              }
            }
          }
          const darsW = maxD > minD ? maxD - minD : (lastX - firstX) * 0.45
          const splitEst = lastX - darsW

          // Find the exact zero-gap span around splitEst
          let zeroStart = -1,
            zeroEnd = -1
          const searchMin = Math.max(0, Math.round(splitEst - 35))
          const searchMax = Math.min(w - 1, Math.round(splitEst + 35))
          for (let x = searchMin; x <= searchMax; x++) {
            if (colCounts[x] === 0) {
              if (zeroStart === -1) zeroStart = x
              zeroEnd = x
            }
          }
          splitX = zeroStart >= 0 ? (zeroStart + zeroEnd) * 0.5 : splitEst
        }

        const suffixColors = suffixPalettes[wIdx % suffixPalettes.length]
        const colorArr = new Uint8Array(ptsX.length)
        for (let i = 0; i < ptsX.length; i++) {
          // In Persian RTL: x >= splitX is 'درس' (solid Blue), x < splitX is suffix ('پژوهی' in Orange, 'کاوی' in Green)
          const isDars = ptsX[i] >= splitX
          const pal = isDars ? darsColors : suffixColors
          colorArr[i] = pal[i % pal.length]
        }
        const wsTx = new Float32Array(ptsX)
        const wsTy = new Float32Array(ptsY)
        return {
          word: wText,
          type: 'word',
          label: `واژه «${wText}»، دبیرخانه کشوری درس‌پژوهی و درس‌کاوی`,
          tx: wsTx,
          ty: wsTy,
          color: colorArr,
          target: mmwAssign(n, wsTx.length, 37 + wIdx * 19),
        }
      })

      wordStagesData = [...additionalLogoStages, ...additionalWordStages]

      // 3. Define stages timing
      stagesTiming = [
        {
          name: 'logo',
          type: 'logo',
          label: shape?.label ?? 'دبیرخانه کشوری درس‌پژوهی و درس‌کاوی',
          flyFor: Math.max(1.0, opts.current.flyFor),
          assembleFor: 1.8,
          stagger: stagger * 0.7,
          holdFor: Math.max(2.4, opts.current.holdFor),
          releaseFor: 0.8,
        },
        ...wordStagesData.map((ws) => ({
          name: ws.word,
          type: ws.type,
          label: ws.label,
          flyFor: 1.2,
          assembleFor: 1.6,
          stagger: 0,
          holdFor: Math.max(2.2, opts.current.holdFor - 0.4),
          releaseFor: 0.8,
        })),
      ]

      // Initialize bird positions if fresh
      for (let i = 0; i < n; i++) {
        const ti = target0[i]
        if (fresh) {
          const a = rand() * Math.PI * 2
          const r = Math.sqrt(rand())
          const origin = shape?.pieces[stage0_piece[ti]]?.origin
          px[i] = w * (origin?.[0] ?? 0.5) + Math.cos(a) * r * w * (shape ? 0.13 : 0.22)
          py[i] = h * (origin?.[1] ?? 0.4) + Math.sin(a) * r * h * (shape ? 0.12 : 0.16)
          depth[i] = 0.55 + rand() * 0.45
          phase[i] = rand() * Math.PI * 2
        } else {
          px[i] *= w / oldW
          py[i] *= h / oldH
        }
        if (reduced && ti >= 0) {
          px[i] = stage0_tx[ti]
          py[i] = stage0_ty[ti]
          vx[i] = 0
          vy[i] = 0
        }
      }

      heroSwoopers = []
      if (shape && stage0_tx.length > 0) {
        const pieceAnchorIdxs: number[][] = [[], [], [], [], [], []]
        for (let i = 0; i < stage0_piece.length; i++) {
          const pc = stage0_piece[i]
          if (pc < 6 && pieceAnchorIdxs[pc].length < 3) {
            pieceAnchorIdxs[pc].push(i)
          }
        }

        const swoopCurves: [
          [number, number, number],
          [number, number, number],
          [number, number, number],
        ][] = [
          [
            [w * 0.52, h * 0.38, 0],
            [w * 0.82, h * 0.65, 0.95],
            [w * 0.62, h * 0.80, 0.85],
          ],
          [
            [w * 0.45, h * 0.40, 0],
            [w * 0.18, h * 0.62, 0.92],
            [w * 0.36, h * 0.78, 0.82],
          ],
          [
            [w * 0.54, h * 0.42, 0],
            [w * 0.58, h * 0.20, 0.88],
            [w * 0.38, h * 0.28, 0.85],
          ],
          [
            [w * 0.52, h * 0.50, 0],
            [w * 0.76, h * 0.46, 0.80],
            [w * 0.56, h * 0.68, 0.75],
          ],
          [
            [w * 0.48, h * 0.48, 0],
            [w * 0.48, h * 0.72, 0.98],
            [w * 0.32, h * 0.54, 0.85],
          ],
          [
            [w * 0.35, h * 0.35, 0],
            [w * 0.25, h * 0.28, 0.88],
            [w * 0.72, h * 0.30, 0.82],
          ],
        ]

        for (let pc = 0; pc < 6; pc++) {
          const [c0, c1, c2] = swoopCurves[pc]
          const targets = pieceAnchorIdxs[pc]
          for (let m = 0; m < targets.length; m++) {
            const ti = targets[m]
            const tx = stage0_tx[ti]
            const ty = stage0_ty[ti]
            const col = birdColors[stage0_color[ti]] || colors.ink
            let bi = -1
            for (let j = 0; j < target0.length; j++) {
              if (target0[j] === ti) {
                bi = j
                break
              }
            }
            if (bi < 0) bi = pc * 3 + m
            const jx = (m - 1) * w * 0.035
            const jy = (m - 1) * h * 0.04
            heroSwoopers.push({
              birdIndex: bi,
              color: col,
              p0: [c0[0] + jx, c0[1] + jy, c0[2]],
              p1: [c1[0] + jx * 1.5, c1[1] + jy * 1.5, c1[2]],
              p2: [c2[0] + jx * 1.2, c2[1] + jy * 1.2, c2[2]],
              p3: [tx, ty, 0],
              phase: rand() * Math.PI * 2 + m * 0.9,
              bank: 0,
              z: 0,
            })
          }
        }
      }

      rebuildBatches(0)
      lastStageIndex = 0
      root.dataset.birds = String(n)
      root.dataset.colors = String(birdColors.length)
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (!visible || document.hidden || ((opts.current.paused || reduced) && !needsPaint)) {
        last = now
        return
      }
      const frameInterval = compact ? 1000 / 30 : 1000 / 60
      if (!reduced && !opts.current.paused && now - lastFrameAt < frameInterval) return
      lastFrameAt = now
      const dt = reduced || opts.current.paused ? 0 : Math.min(0.05, (now - last) / 1000)
      last = now
      clock += dt
      const skip = (window as unknown as { __mmwSkipClock?: number }).__mmwSkipClock || 0
      if (skip > 0) {
        clock += skip
        ;(window as unknown as { __mmwSkipClock?: number }).__mmwSkipClock = 0
      }

      const stageInfo = mmwStage(clock, stagesTiming)
      const stageIndex = reduced ? 0 : stageInfo.stageIndex
      const stageTiming = stagesTiming[stageIndex]
      const stageTime = reduced
        ? stageTiming.flyFor + stageTiming.assembleFor + stageTiming.stagger + 1
        : stageInfo.stageTime
      const formation = mmwFormation(stageTime, stageTiming)
      const state = reduced ? 'holding' : formation.state

      // Handle stage transition
      if (stageIndex !== lastStageIndex) {
        lastStageIndex = stageIndex
        rebuildBatches(stageIndex)
        opts.current.onStageChange?.(stageIndex, stageTiming.name)
      }

      if (root.dataset.state !== state) root.dataset.state = state
      if (root.dataset.stage !== stageTiming.name) root.dataset.stage = stageTiming.name
      if (root.dataset.formation !== stageTiming.type) root.dataset.formation = stageTiming.type
      if (srRef.current && srRef.current.textContent !== stageTiming.label) {
        srRef.current.textContent = stageTiming.label
      }

      const u = Math.min(w, h)
      const cen = mmwCentre(clock)
      const cxp = w / 2 + cen[0] * w * 0.5
      const cyp = h * 0.42 + cen[1] * h
      const t = clock * 0.35
      const hawk = opts.current.interactive && hx > -1e4 && !reduced
      // A finger covers more space than a mouse pointer; keep the desktop response unchanged.
      const hawkR = u * (coarsePointer ? 0.23 : 0.16)

      // Update hero swoopers (birds that fly forward toward the monitor during flight)
      const swoopDuration = Math.min(2.8, stageTiming.flyFor + 0.8)
      const uSwoop = Math.min(1, Math.max(0, stageTime / swoopDuration))
      const isSwooping = !reduced && uSwoop < 1 && formation.state !== 'holding'

      for (let k = 0; k < heroSwoopers.length; k++) {
        const hs = heroSwoopers[k]
        if (isSwooping) {
          const pt = mmwEvalBezier(hs.p0, hs.p1, hs.p2, hs.p3, uSwoop)
          const zProgress = Math.sin(Math.PI * uSwoop) ** 1.4
          const currentZ = pt.z * zProgress
          hs.z = currentZ

          const sp = Math.hypot(pt.dx, pt.dy) / swoopDuration
          hs.phase += dt * (14 + sp * 0.02)
          hs.bank = Math.max(-0.45, Math.min(0.45, (pt.dx * pt.dy > 0 ? 0.35 : -0.35) * currentZ))

          const bi = hs.birdIndex
          px[bi] = pt.x
          py[bi] = pt.y
          vx[bi] = pt.dx / swoopDuration
          vy[bi] = pt.dy / swoopDuration
          birdPull[bi] = 1 - currentZ
        } else {
          hs.z = 0
        }
      }

      // Fast O(1) lookup table for active hero swoopers
      const isHeroActive = new Uint8Array(n)
      if (!reduced && isSwooping) {
        for (let k = 0; k < heroSwoopers.length; k++) {
          const hs = heroSwoopers[k]
          if (hs.z > 0.04 && hs.birdIndex >= 0 && hs.birdIndex < n) {
            isHeroActive[hs.birdIndex] = 1
          }
        }
      }

      // Stage-specific target and pull logic
      if (stageIndex === 0) {
        // Logo formation
        const piecePulls = shape
          ? shape.pieces.map((piece) =>
              reduced ? 1 : mmwFormation(stageTime, stageTiming, piece.delay).pull,
            )
          : [reduced ? 1 : formation.pull]

        for (let i = 0; i < n; i++) {
          if (isHeroActive[i]) continue
          const ti = target0[i]
          const pull = piecePulls[stage0_piece[ti] ?? 0] ?? 0
          birdPull[i] = pull
          const x = px[i],
            y = py[i]
          let ax = 0,
            ay = 0
          const fx = (x - w / 2) / u,
            fy = (y - h / 2) / u
          const cv = mmwCurl(fx * 2.2 + depth[i] * 0.25, fy * 2.2, t)
          const free = (1 - pull) ** 2
          ax += cv[0] * 420 * free
          ay += cv[1] * 420 * free
          const dxC = cxp - x,
            dyC = (cyp - y) * 1.6
          const dC = Math.hypot(dxC, dyC) / u
          const hold = dC < 0.14 ? 0.15 : 0.15 + (dC - 0.14) * 6
          ax += dxC * hold * 2.2 * free
          ay += dyC * hold * 1.6 * free

          if (pull > 0 && ti >= 0) {
            const spring = 44
            const damping = 12.2
            ax += ((stage0_tx[ti] - x) * spring - vx[i] * damping) * pull
            ay += ((stage0_ty[ti] - y) * spring - vy[i] * damping) * pull
          }
          if (hawk) {
            const dx = x - hx,
              dy = y - hy
            const d2 = dx * dx + dy * dy
            if (d2 < hawkR * hawkR) {
              const d = Math.sqrt(d2) + 0.01
              const f = (1 - d / hawkR) * 5200
              ax += (dx / d) * f
              ay += (dy / d) * f
            }
          }
          let nvx = (vx[i] + ax * dt) * (1 - 1.1 * dt)
          let nvy = (vy[i] + ay * dt) * (1 - 1.1 * dt)
          const sp = Math.hypot(nvx, nvy)
          const cap = 520 + 380 * pull
          if (sp > cap) {
            nvx = (nvx / sp) * cap
            nvy = (nvy / sp) * cap
          }
          vx[i] = nvx
          vy[i] = nvy
          px[i] = x + nvx * dt
          py[i] = y + nvy * dt
          phase[i] += dt * (9 + sp * 0.02)
        }
      } else {
        // Sequential Word formation («درس‌پژوهی» or «درس‌کاوی»)
        const ws = wordStagesData[stageIndex - 1]
        const pull = reduced ? 1 : formation.pull
        const spring = 42
        const damping = 11.8

        for (let i = 0; i < n; i++) {
          if (isHeroActive[i]) continue
          const ti = ws ? ws.target[i] : -1
          birdPull[i] = pull
          const x = px[i],
            y = py[i]
          let ax = 0,
            ay = 0
          const fx = (x - w / 2) / u,
            fy = (y - h / 2) / u
          const cv = mmwCurl(fx * 2.2 + depth[i] * 0.25, fy * 2.2, t)
          const free = (1 - pull) ** 2
          ax += cv[0] * 420 * free
          ay += cv[1] * 420 * free
          const dxC = cxp - x,
            dyC = (cyp - y) * 1.6
          const dC = Math.hypot(dxC, dyC) / u
          const hold = dC < 0.14 ? 0.15 : 0.15 + (dC - 0.14) * 6
          ax += dxC * hold * 2.2 * free
          ay += dyC * hold * 1.6 * free

          if (pull > 0 && ws && ti >= 0) {
            ax += ((ws.tx[ti] - x) * spring - vx[i] * damping) * pull
            ay += ((ws.ty[ti] - y) * spring - vy[i] * damping) * pull
          }
          if (hawk) {
            const dx = x - hx,
              dy = y - hy
            const d2 = dx * dx + dy * dy
            if (d2 < hawkR * hawkR) {
              const d = Math.sqrt(d2) + 0.01
              const f = (1 - d / hawkR) * 5200
              ax += (dx / d) * f
              ay += (dy / d) * f
            }
          }
          let nvx = (vx[i] + ax * dt) * (1 - 1.1 * dt)
          let nvy = (vy[i] + ay * dt) * (1 - 1.1 * dt)
          const sp = Math.hypot(nvx, nvy)
          const cap = 520 + 380 * pull
          if (sp > cap) {
            nvx = (nvx / sp) * cap
            nvy = (nvy / sp) * cap
          }
          vx[i] = nvx
          vy[i] = nvy
          px[i] = x + nvx * dt
          py[i] = y + nvy * dt
          phase[i] += dt * (9 + sp * 0.02)
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      for (let batch = 0; batch < batches.length; batch++) {
        const pass = batch % 2
        const indices = batches[batch]
        if (!indices.length) continue
        ctx.beginPath()
        for (const i of indices) {
          if (isHeroActive[i]) continue
          const pull = birdPull[i]
          const s = (1.5 + depth[i] * 1.6) * (1 - 0.5 * pull) * Math.max(0.55, Math.min(1.15, markScale))
          const sp = Math.hypot(vx[i], vy[i])
          const dx = sp > 0.001 ? vx[i] / sp : 1
          const dy = sp > 0.001 ? vy[i] / sp : 0
          const flap = 0.55 + 0.45 * Math.sin(phase[i])
          const bx = px[i],
            by = py[i]
          const wx = -dx * s,
            wy = -dy * s
          const nx = -dy * s * flap,
            ny = dx * s * flap
          ctx.moveTo(bx + wx + nx, by + wy + ny)
          ctx.lineTo(bx, by)
          ctx.lineTo(bx + wx - nx, by + wy - ny)
        }
        ctx.strokeStyle = birdColors[Math.floor(batch / 2)] || colors.ink
        ctx.globalAlpha = pass === 0 ? 0.9 : 1
        ctx.lineWidth = (pass === 0 ? 0.9 : 1.15) * Math.max(0.75, Math.min(1.1, markScale)) * (stageTiming.type === 'shape' ? 1.3 : 1)
        ctx.stroke()
      }

      // Render prominent Hero Birds swooping in the foreground toward the monitor
      if (!reduced && isSwooping) {
        for (let k = 0; k < heroSwoopers.length; k++) {
          const hs = heroSwoopers[k]
          if (hs.z > 0.04) {
            const birdSpan = (3.5 + hs.z * 22) * Math.max(0.65, Math.min(1.15, markScale))
            const bi = hs.birdIndex
            drawRealisticBird(
              ctx,
              px[bi],
              py[bi],
              vx[bi],
              vy[bi],
              birdSpan,
              hs.phase,
              hs.bank,
              hs.color,
              Math.min(1, 0.45 + hs.z * 0.8),
            )
          }
        }
      }

      ctx.globalAlpha = 1
      needsPaint = false
    }

    const onMotion = () => {
      reduced = reducedQuery.matches
      layout()
    }
    let touchId: number | null = null
    let touchReleaseTimer: number | undefined
    const clearInteraction = () => {
      hx = -1e5
      hy = -1e5
      delete root.dataset.pointerActive
    }
    const setInteraction = (clientX: number, clientY: number) => {
      if (!opts.current.interactive || reduced) return
      const b = canvas.getBoundingClientRect()
      hx = clientX - b.left
      hy = clientY - b.top
      root.dataset.pointerActive = 'true'
    }
    const onMove = (event: PointerEvent) => {
      // Touch events are handled separately so passive scrolling is never blocked.
      if (event.pointerType !== 'touch' && touchId === null) setInteraction(event.clientX, event.clientY)
    }
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' && touchId === null) clearInteraction()
    }
    const onTouchStart = (event: TouchEvent) => {
      if (touchId !== null || !event.changedTouches.length) return
      window.clearTimeout(touchReleaseTimer)
      const touch = event.changedTouches[0]
      touchId = touch.identifier
      setInteraction(touch.clientX, touch.clientY)
    }
    const onTouchMove = (event: TouchEvent) => {
      if (touchId === null) return
      const touch = Array.from(event.touches).find(item => item.identifier === touchId)
      if (touch) setInteraction(touch.clientX, touch.clientY)
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (touchId === null || !Array.from(event.changedTouches).some(item => item.identifier === touchId)) return
      touchId = null
      // Leave a brief response after a tap, but allow the flock to settle again.
      window.clearTimeout(touchReleaseTimer)
      touchReleaseTimer = window.setTimeout(clearInteraction, 250)
    }
    reducedQuery.addEventListener('change', onMotion)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: true })
    root.addEventListener('touchend', onTouchEnd, { passive: true })
    root.addEventListener('touchcancel', onTouchEnd, { passive: true })
    layout()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(layout)
    ro.observe(root)
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true
    })
    io.observe(root)
    let alive = true
    if (document.fonts?.ready)
      document.fonts.ready.then(() => {
        if (alive) layout()
      })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      reducedQuery.removeEventListener('change', onMotion)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEnd)
      root.removeEventListener('touchcancel', onTouchEnd)
      window.clearTimeout(touchReleaseTimer)
      clearInteraction()
    }
  }, [key, shape, extraShapes])

  return (
    <div
      ref={rootRef}
      className={'mmw-root ' + className}
      data-formation="logo"
      data-stage="logo"
      data-state="holding"
      data-colors={String(shape?.colors.length ?? 1)}
      style={{ height, '--mmw-sky': colors.skyTop } as React.CSSProperties}
    >
      <style>{MMW_CSS}</style>
      <canvas ref={skyRef} className="mmw-sky-canvas" aria-hidden="true" />
      <canvas ref={canvasRef} className="mmw-bird-canvas" aria-hidden="true" />
      <span ref={srRef} className="mmw-sr">
        {shape?.label ?? word}
      </span>
      {children ? <div className="mmw-over">{children}</div> : null}
    </div>
  )
}
