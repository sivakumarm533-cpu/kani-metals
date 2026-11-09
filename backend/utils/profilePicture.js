import { toWebpBuffer } from './webp.js'

/** Checks the upload really is an image and stores it as a WebP data URL. */
export async function profilePictureDataUrl(file) {
  if (!file?.buffer?.length) return ''
  const { buffer, mimetype } = file
  const isPng = mimetype === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const isJpeg = mimetype === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  const isWebp = mimetype === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
  if (!isPng && !isJpeg && !isWebp) {
    const error = new Error('The uploaded file is not a valid JPG, PNG, or WebP image.')
    error.statusCode = 400
    throw error
  }
  const webp = isWebp ? buffer : await toWebpBuffer(buffer)
  return `data:image/webp;base64,${webp.toString('base64')}`
}
