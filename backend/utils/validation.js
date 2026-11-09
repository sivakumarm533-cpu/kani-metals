import mongoose from 'mongoose'
import { rupeesToPaise } from './money.js'

export function badRequest(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

const imageDataUrl = /^data:image\/(?:png|jpe?g|webp|gif|avif|bmp);base64,[A-Za-z0-9+/]+={0,2}$/
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/** Required trimmed string with a maximum length. */
export function requiredText(value, label, maxLength) {
  if (typeof value !== 'string' || !value.trim()) throw badRequest(`Enter the ${label}.`)
  const text = value.trim()
  if (text.length > maxLength) throw badRequest(`The ${label} must be ${maxLength} characters or fewer.`)
  return text
}

/** Optional trimmed string; missing values become an empty string. */
export function optionalText(value, label, maxLength) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw badRequest(`The ${label} must be text.`)
  const text = value.trim()
  if (text.length > maxLength) throw badRequest(`The ${label} must be ${maxLength} characters or fewer.`)
  return text
}

/**
 * Images are stored as base64 data URLs. Only raster image types are accepted,
 * which prevents arbitrary URLs or scriptable formats from being stored and
 * later rendered in the app.
 */
export function optionalImage(value, label) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') throw badRequest(`The ${label} must be a JPG, PNG, WebP or GIF image.`)
  const approximateBytes = Math.floor((value.length - value.indexOf(',') - 1) * 0.75)
  if (approximateBytes > MAX_IMAGE_BYTES) throw badRequest(`The ${label} must be 3 MB or smaller.`)
  if (!imageDataUrl.test(value)) throw badRequest(`The ${label} must be a JPG, PNG, WebP or GIF image.`)
  return value
}

export function finiteNumber(value, label, { min = 0, max = 1e12 } = {}) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof number !== 'number' || !Number.isFinite(number)) throw badRequest(`Enter a valid ${label}.`)
  if (number < min || number > max) throw badRequest(`The ${label} must be between ${min} and ${max}.`)
  return number
}

export function validDate(value, label) {
  if (typeof value !== 'string' && !(value instanceof Date)) throw badRequest(`Enter a valid ${label}.`)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw badRequest(`Enter a valid ${label}.`)
  return date
}

export function objectId(value, label) {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw badRequest(`The ${label} is invalid.`)
  return value
}

/** Returns only the provided keys of `source`, so partial updates stay partial. */
function pickDefined(source) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined))
}

export function dealerPayload(body = {}, { partial = false } = {}) {
  const has = (key) => body[key] !== undefined
  const category = body.category ?? body.type
  return pickDefined({
    name: !partial || has('name') ? requiredText(body.name, 'dealer name', 120) : undefined,
    phone: !partial || has('phone') ? requiredText(body.phone, 'phone number', 30) : undefined,
    location: !partial || has('location') ? optionalText(body.location, 'location', 200) : undefined,
    category: !partial || category !== undefined ? (optionalText(category, 'dealer category', 60) || 'Regular Dealer') : undefined,
    profileImage: !partial || has('profileImage') ? optionalImage(body.profileImage, 'profile photo') : undefined,
    cardColor: !partial || has('cardColor') ? (/^#[0-9a-f]{6}$/i.test(String(body.cardColor || '')) ? body.cardColor : '#fff3e8') : undefined,
    cardBackground: !partial || has('cardBackground') ? optionalImage(body.cardBackground, 'card background image') : undefined,
    active: has('active') ? activeFlag(body.active) : partial ? undefined : true,
  })
}

function activeFlag(value) {
  if (typeof value !== 'boolean') throw badRequest('Dealer status must be active or inactive.')
  return value
}

export function productPayload(body = {}, { partial = false } = {}) {
  const has = (key) => body[key] !== undefined
  return pickDefined({
    name: !partial || has('name') ? requiredText(body.name, 'product name', 120) : undefined,
    category: !partial || has('category') ? requiredText(body.category, 'product category', 60) : undefined,
    quantity: !partial || has('quantity') ? finiteNumber(body.quantity, 'quantity') : undefined,
    unit: !partial || has('unit') ? requiredText(body.unit, 'unit', 20) : undefined,
    price: !partial || has('price') ? finiteNumber(body.price, 'price') : undefined,
    image: !partial || has('image') ? optionalImage(body.image, 'product image') : undefined,
  })
}

export function billItemsPayload(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest('Add at least one item to the bill.')
  if (items.length > 300) throw badRequest('A bill can contain at most 300 items.')
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw badRequest(`Item ${index + 1} is invalid.`)
    return {
      name: requiredText(item.name, `name of item ${index + 1}`, 120),
      category: requiredText(item.category, `category of item ${index + 1}`, 60),
      // A bill line needs a quantity above zero (the form already requires at least 0.01).
      quantity: finiteNumber(item.quantity, `quantity of item ${index + 1}`, { min: 0.001 }),
      unit: requiredText(item.unit, `unit of item ${index + 1}`, 20),
      price: finiteNumber(item.price, `price of item ${index + 1}`),
      image: optionalImage(item.image, `image of item ${index + 1}`),
      note: optionalText(item.note, `note of item ${index + 1}`, 200),
    }
  })
}

/**
 * Bill totals are stored in rupees, rounded half-up to whole paise. The decimal-string
 * rounding matches rupeesToPaise() used by payments, so e.g. 301.025 (stored in binary as
 * 301.02499…) becomes 301.03 in both places instead of 301.02 here and 301.03 there.
 */
export function billTotal(items) {
  const sum = items.reduce((total, item) => total + item.quantity * item.price, 0)
  const paise = rupeesToPaise(sum.toFixed(9))
  if (paise === null) throw badRequest('The bill total is too large.')
  return paise / 100
}
