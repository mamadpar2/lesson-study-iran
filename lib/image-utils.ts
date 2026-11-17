/**
 * Image utilities for automatic WebP conversion and optimization.
 */

export interface WebpConvertResult {
  dataUrl: string
  fileName: string
  width: number
  height: number
  sizeBytes: number
}

/**
 * Converts any image file (PNG, JPG, BMP, etc.) into a high-quality WebP image.
 */
export async function convertImageFileToWebp(
  file: File,
  quality: number = 0.9,
  maxDimension: number = 1920
): Promise<WebpConvertResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('خطا در خواندن فایل تصویر'))
    reader.onload = (e) => {
      const src = e.target?.result as string
      const img = new Image()
      img.onerror = () => reject(new Error('خطا در بارگذاری تصویر'))
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Downscale if image is unreasonably huge
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('عدم دسترسی به بستر رسم Canvas'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        // Export as WebP
        const dataUrl = canvas.toDataURL('image/webp', quality)

        // Change extension to .webp
        const baseName = file.name.replace(/\.[^/.]+$/, '')
        const webpName = `${baseName}.webp`

        // Estimate size in bytes
        const head = 'data:image/webp;base64,'
        const sizeBytes = Math.round(((dataUrl.length - head.length) * 3) / 4)

        resolve({
          dataUrl,
          fileName: webpName,
          width,
          height,
          sizeBytes,
        })
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}

async function loadImageForCanvas(src: string): Promise<HTMLImageElement> {
  // Private certificate assets are served through an authenticated same-origin API.
  // Fetch them with the admin session explicitly, then decode a same-origin object URL;
  // assigning the API URL directly to an <img crossOrigin="anonymous"> can fail in
  // browsers/proxies that don't carry the session cookie on that image request.
  const response = await fetch(src, {
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`دریافت تصویر گواهی ناموفق بود (HTTP ${response.status}).`)
  }

  const blob = await response.blob()
  const contentType = (blob.type || response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new Error('فایل دریافت‌شده قالب تصویر معتبر ندارد.')
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('مرورگر نتوانست تصویر گواهی را رمزگشایی کند.'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Normalize an already-personalized certificate page without repainting any text. */
export async function normalizeCertificateImageToJpeg(imageUrl: string): Promise<string> {
  const image = await loadImageForCanvas(imageUrl)
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height
  if (!sourceWidth || !sourceHeight) throw new Error('تصویر گواهی اندازه معتبری ندارد.')
  const scale = Math.min(1, 3000 / sourceWidth, 3000 / sourceHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sourceWidth * scale))
  canvas.height = Math.max(1, Math.round(sourceHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas تصویر گواهی در دسترس نیست.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.95)
}
