import sharp from 'sharp'

/*
 * Every stored image is WebP. Browsers usually send WebP already (see
 * frontend/src/utils/image.js); Safari cannot encode WebP and sends JPEG, and
 * other clients may send PNG or JPEG, so the server converts those here.
 */

const MAX_SIDE = 1600
const QUALITY = 82
/** WebP images above this size are re-encoded too (the app itself sends much smaller ones). */
const MAX_WEBP_BYTES = 400 * 1024
const DATA_URL = /^data:image\/(png|jpe?g|webp|gif|avif|bmp);base64,([A-Za-z0-9+/]+={0,2})$/

function badImage() {
  const error = new Error('This image could not be read. Choose a JPG, PNG or WebP photo.')
  error.statusCode = 400
  return error
}

/** Converts an image buffer to WebP, keeping it within MAX_SIDE pixels and honouring phone rotation. */
export async function toWebpBuffer(buffer) {
  try {
    return await sharp(buffer, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer()
  } catch { throw badImage() }
}

/** Returns a WebP data URL for an image data URL. Anything else (empty, non-image) is returned unchanged for the validators to judge. */
export async function toWebpDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) return value
  const match = value.match(DATA_URL)
  if (!match) return value
  // A WebP is kept as sent unless it is oversized (e.g. a client that skipped the browser resize).
  if (match[1] === 'webp' && match[2].length * 0.75 <= MAX_WEBP_BYTES) return value
  const webp = await toWebpBuffer(Buffer.from(match[2], 'base64'))
  return `data:image/webp;base64,${webp.toString('base64')}`
}

async function convertDeep(value, depth) {
  if (typeof value === 'string') return toWebpDataUrl(value)
  if (depth > 5 || !value || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) value[index] = await convertDeep(value[index], depth + 1)
    return value
  }
  for (const key of Object.keys(value)) value[key] = await convertDeep(value[key], depth + 1)
  return value
}

/** Express middleware: converts every non-WebP image data URL in a JSON body to WebP. */
export async function webpImages(req, _res, next) {
  try {
    if (req.method !== 'GET' && req.body && typeof req.body === 'object') await convertDeep(req.body, 0)
    next()
  } catch (error) { next(error) }
}
