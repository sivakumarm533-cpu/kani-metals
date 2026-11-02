import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'
import { generateSecret, generateURI } from 'otplib'
import QRCode from 'qrcode'

function encryptionKey() {
  const value = String(process.env.TOTP_ENCRYPTION_KEY || '').trim()
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64')
  if (key.length !== 32) {
    const error = new Error('TOTP_ENCRYPTION_KEY must contain a secure 32-byte key (base64 or 64-character hex).')
    error.statusCode = 503
    throw error
  }
  return key
}

export function totpEncryptionKeyConfigured() {
  try { encryptionKey(); return true } catch { return false }
}

export function encryptTotpSecret(secret) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`
}

export function decryptTotpSecret(payload) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = String(payload || '').split(':')
  if (version !== 'v1' || !ivEncoded || !tagEncoded || !ciphertextEncoded) throw new Error('Stored TOTP secret is invalid.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64'))
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertextEncoded, 'base64')), decipher.final()]).toString('utf8')
}

export function hashChallenge(challenge) {
  return createHash('sha256').update(challenge).digest('hex')
}

export function newChallenge() {
  return randomBytes(32).toString('base64url')
}

export function newTotpSecret() {
  return generateSecret()
}

export async function makeTotpQr(email, secret) {
  const uri = generateURI({ issuer: 'Kani Metals', label: email, secret, algorithm: 'sha1', digits: 6, period: 30 })
  return QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 240 })
}

export function newRecoveryCodes() {
  return Array.from({ length: 10 }, () => randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g).join('-'))
}
