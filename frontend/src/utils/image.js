const MAX_SOURCE_BYTES = 20 * 1024 * 1024

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => { URL.revokeObjectURL(url); resolve(image) }
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read. Choose a JPG, PNG or WebP file.')) }
    image.src = url
  })
}

async function drawResized(file, maxSize) {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new Error('Choose a JPG, PNG or WebP image.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('This image is larger than 20 MB. Choose a smaller photo.')
  const image = await loadImage(file)
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * Resizes an uploaded photo in the browser and returns a compact data URL.
 * Phone photos are often 3–8 MB; storing them as-is made dealer lists slow to load.
 */
export async function compressImage(file, { maxSize = 640, quality = 0.82 } = {}) {
  if (!file) return ''
  const canvas = await drawResized(file, maxSize)
  const webp = canvas.toDataURL('image/webp', quality)
  // Older Safari versions cannot encode WebP and silently return PNG; use JPEG there.
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
}

/** Same as compressImage but returns a File, for multipart uploads such as profile pictures. */
export async function compressImageFile(file, { maxSize = 512, quality = 0.85 } = {}) {
  if (!file) return null
  const canvas = await drawResized(file, maxSize)
  const toBlob = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, quality))
  let blob = await toBlob('image/webp')
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg')
  if (!blob) throw new Error('This image could not be processed. Try another photo.')
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.${extension}`, { type: blob.type })
}
