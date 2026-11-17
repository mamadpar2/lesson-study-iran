/**
 * Sample the user's original PNG emblem (five colored people + crescent).
 * No text below it; words are animated sequentially in subsequent flight stages.
 * Run: node scripts/generate-logo.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'

const root = new URL('../', import.meta.url)
const original = await readFile(new URL('public/images/secretariat-logo.png', root))
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage()
  const sampled = await page.evaluate(
    async (uri) => {
      const image = new Image()
      image.src = uri
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = 365
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(image, 0, 0)
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const rgba = pixels.data
      const w = canvas.width
      const h = canvas.height
      const labels = new Int32Array(w * h).fill(-1)
      const components = []
      const queue = new Int32Array(w * h)

      // Separate the crescent and five people
      for (let index = 0; index < w * h; index++) {
        if (labels[index] !== -1 || rgba[index * 4 + 3] < 32) continue
        const label = components.length
        let head = 0
        let tail = 1
        queue[0] = index
        labels[index] = label
        const indexes = []
        while (head < tail) {
          const p = queue[head++]
          indexes.push(p)
          const x = p % w
          const y = Math.floor(p / w)
          for (const [nx, ny] of [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
          ]) {
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
            const next = ny * w + nx
            if (labels[next] !== -1 || rgba[next * 4 + 3] < 32) continue
            labels[next] = label
            queue[tail++] = next
          }
        }
        components.push({ label, indexes })
      }
      const main = components.filter((part) => part.indexes.length > 300)
      const crescent = main.reduce((a, b) => (a.indexes.length > b.indexes.length ? a : b))
      const parts = new Int8Array(w * h).fill(-1)
      const centers = [24, 97, 330, 279, 200]
      const hue = (r, g, b) => {
        const max = Math.max(r, g, b),
          min = Math.min(r, g, b),
          delta = max - min
        if (!delta) return 200
        const raw = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
        return (raw * 60 + 360) % 360
      }
      let left = w,
        top = h,
        right = 0,
        bottom = 0
      const opaque = []
      for (const component of main) {
        let r = 0,
          g = 0,
          b = 0,
          count = 0
        for (const index of component.indexes) {
          if (rgba[index * 4 + 3] < 160) continue
          r += rgba[index * 4]
          g += rgba[index * 4 + 1]
          b += rgba[index * 4 + 2]
          count++
        }
        const angle = hue(r / count, g / count, b / count)
        const distances = centers.map((value) =>
          Math.min(Math.abs(value - angle), 360 - Math.abs(value - angle)),
        )
        const piece = component === crescent ? 5 : distances.indexOf(Math.min(...distances))
        for (const index of component.indexes) {
          parts[index] = piece
          const x = index % w,
            y = Math.floor(index / w)
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
          if (rgba[index * 4 + 3] >= 160)
            opaque.push([rgba[index * 4], rgba[index * 4 + 1], rgba[index * 4 + 2]])
        }
      }

      // Weighted median-cut: 44 source colors preserve original gradients
      const bounds = (values) => {
        const lo = [255, 255, 255],
          hi = [0, 0, 0]
        for (const pixel of values)
          for (let c = 0; c < 3; c++) {
            lo[c] = Math.min(lo[c], pixel[c])
            hi[c] = Math.max(hi[c], pixel[c])
          }
        const ranges = hi.map((value, c) => value - lo[c])
        const channel = ranges.indexOf(Math.max(...ranges))
        return { values, channel, score: ranges[channel] * Math.sqrt(values.length) }
      }
      const boxes = [bounds(opaque)]
      while (boxes.length < 44) {
        boxes.sort((a, b) => b.score - a.score)
        const box = boxes.shift()
        box.values.sort((a, b) => a[box.channel] - b[box.channel])
        const middle = Math.floor(box.values.length / 2)
        boxes.push(bounds(box.values.slice(0, middle)), bounds(box.values.slice(middle)))
      }
      const distance = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
      const palette = boxes.map(({ values }) => {
        const mean = [0, 0, 0]
        for (const pixel of values) for (let c = 0; c < 3; c++) mean[c] += pixel[c] / values.length
        return values.reduce((best, pixel) => (distance(pixel, mean) < distance(best, mean) ? pixel : best))
      })

      const points = []
      const counts = [0, 0, 0, 0, 0, 0]
      for (let y = top; y <= bottom; y += 2)
        for (let x = left; x <= right; x += 2) {
          const index = y * w + x
          if (parts[index] < 0 || rgba[index * 4 + 3] < 160) continue
          const color = [rgba[index * 4], rgba[index * 4 + 1], rgba[index * 4 + 2]]
          let nearest = 0
          for (let p = 1; p < palette.length; p++)
            if (distance(color, palette[p]) < distance(color, palette[nearest])) nearest = p
          points.push((x - left) | ((y - top) << 9) | (nearest << 18) | (parts[index] << 24))
          counts[parts[index]]++
        }
      for (let index = 0; index < w * h; index++) if (parts[index] < 0) rgba[index * 4 + 3] = 0
      ctx.putImageData(pixels, 0, 0)
      const cropped = document.createElement('canvas')
      cropped.width = right - left + 1
      cropped.height = bottom - top + 1
      cropped
        .getContext('2d')
        .drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
      return {
        width: cropped.width,
        height: cropped.height,
        colors: palette.map((rgb) => '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('')),
        points,
        counts,
        png: cropped.toDataURL('image/png').split(',')[1],
      }
    },
    `data:image/png;base64,${original.toString('base64')}`,
  )

  const shape = {
    id: 'secretariat-original',
    label: 'دبیرخانه کشوری درس‌پژوهی و درس‌کاوی',
    sourceSha256: createHash('sha256').update(original).digest('hex'),
    width: sampled.width,
    height: sampled.height,
    colors: sampled.colors,
    pieces: [
      { name: 'پیکره نارنجی', origin: [0.76, 0.02], delay: 0 },
      { name: 'پیکره سبز', origin: [0.06, 0.28], delay: 0.13 },
      { name: 'پیکره صورتی', origin: [0.96, 0.3], delay: 0.26 },
      { name: 'پیکره بنفش', origin: [0.9, 0.86], delay: 0.39 },
      { name: 'پیکره آبی', origin: [0.06, 0.82], delay: 0.52 },
      { name: 'هلال آبی', origin: [0.46, 1.04], delay: 1.05 },
    ],
    points: sampled.points,
  }
  await mkdir(new URL('lib/', root), { recursive: true })
  await writeFile(new URL('lib/secretariat-shape.json', root), JSON.stringify(shape) + '\n')
  await writeFile(new URL('public/images/secretariat-symbol.png', root), Buffer.from(sampled.png, 'base64'))
  console.log(
    `Sampled ${shape.points.length} targets; ${shape.colors.length} original colors; ${shape.width}×${shape.height}.`,
  )
  console.log('Targets per colored figure / crescent:', sampled.counts)
} finally {
  await browser.close()
}
