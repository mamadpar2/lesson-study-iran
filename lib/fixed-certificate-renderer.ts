export interface FixedCertificateFields {
  webinarId: string
  personnelCode: string
  province: string
}

async function loadSvgImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob)
    } catch {
      // Safari and older browsers can decode SVG more reliably through an Image element.
    }
  }
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Retrieve a verified, personalized SVG; the blank template stays behind the admin-only API route. */
export async function renderFixedCertificateImage(fields: FixedCertificateFields): Promise<string> {
  if (!fields.webinarId || !fields.personnelCode || !fields.province) {
    throw new Error('شناسه وبینار یا شرکت‌کننده برای صدور گواهی موجود نیست.')
  }

  let response: Response
  try {
    response = await fetch(`/api/certificate-media`, {
      method: 'POST',
      body: JSON.stringify({ webinarId: fields.webinarId, personnelCode: fields.personnelCode, province: fields.province }),
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'image/svg+xml, application/json', 'Content-Type': 'application/json' },
    })
  } catch {
    throw new Error('ارتباط با سرویس صدور گواهی برقرار نشد؛ اتصال اینترنت یا دسترسی سایت را بررسی کنید.')
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || `دریافت تصویر گواهی ناموفق بود (HTTP ${response.status}).`)
  }

  const image = await loadSvgImage(await response.blob()).catch(() => {
    throw new Error('تصویر گواهی از سرور دریافت شد اما مرورگر نتوانست آن را باز کند.')
  })
  const canvas = document.createElement('canvas')
  canvas.width = image instanceof HTMLImageElement ? image.naturalWidth : image.width
  canvas.height = image instanceof HTMLImageElement ? image.naturalHeight : image.height
  const context = canvas.getContext('2d')
  if (!context) {
    if (image instanceof ImageBitmap) image.close()
    throw new Error('مرورگر امکان ساخت تصویر گواهی را فراهم نکرد.')
  }
  context.drawImage(image, 0, 0)
  if (image instanceof ImageBitmap) image.close()

  try {
    return canvas.toDataURL('image/jpeg', 0.96)
  } catch {
    throw new Error('تبدیل تصویر گواهی به JPG انجام نشد.')
  }
}
