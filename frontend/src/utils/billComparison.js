const quantityScale = 1_000_000n
const microCurrencyPerCent = 10_000n

function decimalParts(value) {
  if (value === null || value === undefined || value === '') return null
  const match = String(value).trim().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match) return null
  const sign = match[1] === '-' ? -1n : 1n
  const fraction = match[3] || ''
  let scale = fraction.length - Number(match[4] || 0)
  let integer = BigInt(`${match[2]}${fraction || ''}`) * sign
  if (scale < 0) {
    integer *= 10n ** BigInt(-scale)
    scale = 0
  }
  return { integer, scale }
}

function roundDivision(numerator, denominator) {
  if (denominator === 0n) return null
  const sign = numerator < 0n ? -1n : 1n
  const absolute = numerator < 0n ? -numerator : numerator
  return sign * ((absolute + denominator / 2n) / denominator)
}

function scaledInteger(value, digits = 6) {
  const parts = decimalParts(value)
  if (!parts) return null
  if (parts.scale <= digits) return parts.integer * 10n ** BigInt(digits - parts.scale)
  return roundDivision(parts.integer, 10n ** BigInt(parts.scale - digits))
}

export function productAmountMicro(quantity, price) {
  const quantityParts = decimalParts(quantity)
  const priceParts = decimalParts(price)
  if (!quantityParts || !priceParts) return null
  const denominator = 10n ** BigInt(quantityParts.scale + priceParts.scale)
  return roundDivision(quantityParts.integer * priceParts.integer * quantityScale, denominator)
}

export function decimalToCents(value) {
  const parts = decimalParts(value)
  if (!parts) return null
  return parts.scale <= 2
    ? parts.integer * 10n ** BigInt(2 - parts.scale)
    : roundDivision(parts.integer * 100n, 10n ** BigInt(parts.scale))
}

export function microCurrencyToCents(value) {
  return value == null ? null : roundDivision(value, microCurrencyPerCent)
}

export function percentChange(previous, current) {
  if (previous == null || current == null || previous === 0n) return null
  const tenthsOfPercent = roundDivision((current - previous) * 1000n, previous)
  return tenthsOfPercent == null ? null : Number(tenthsOfPercent) / 10
}

export function normalizeProductPart(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function comparisonIdentity(item) {
  return `${normalizeProductPart(item?.name)}\u001f${normalizeProductPart(item?.category || 'Uncategorized')}`
}

export function comparisonProductKey(item) {
  const identity = comparisonIdentity(item)
  return Array.from(new TextEncoder().encode(identity), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function unitDescriptor(value) {
  const unit = String(value || '').trim()
  const normalized = unit.toLocaleLowerCase('en')
  const table = {
    kg: ['mass', 'kg', '1'], kgs: ['mass', 'kg', '1'], kilogram: ['mass', 'kg', '1'], kilograms: ['mass', 'kg', '1'],
    g: ['mass', 'kg', '0.001'], gram: ['mass', 'kg', '0.001'], grams: ['mass', 'kg', '0.001'],
    ton: ['mass', 'kg', '1000'], tonne: ['mass', 'kg', '1000'], tonnes: ['mass', 'kg', '1000'],
    pcs: ['pieces', 'pcs', '1'], pc: ['pieces', 'pcs', '1'], piece: ['pieces', 'pcs', '1'], pieces: ['pieces', 'pcs', '1'],
    box: ['box', 'box', '1'], boxes: ['box', 'box', '1'],
    m: ['length', 'm', '1'], meter: ['length', 'm', '1'], metre: ['length', 'm', '1'], meters: ['length', 'm', '1'], metres: ['length', 'm', '1'],
    l: ['volume', 'L', '1'], liter: ['volume', 'L', '1'], litre: ['volume', 'L', '1'], liters: ['volume', 'L', '1'], litres: ['volume', 'L', '1'],
  }
  const [dimension, baseUnit, factor] = table[normalized] || [`unit:${normalized}`, unit || 'unit', '1']
  return { dimension, baseUnit, factorMicro: scaledInteger(factor) || quantityScale }
}

function priceInBaseCents(price, factorMicro) {
  const cents = decimalToCents(price)
  return cents == null ? null : roundDivision(cents * quantityScale, factorMicro)
}

function addItemToProduct(target, item) {
  if (!target.name) {
    target.name = String(item.name || '').trim()
    target.category = String(item.category || 'Uncategorized').trim()
  }
  const descriptor = unitDescriptor(item.unit)
  if (!target.dimensions.has(descriptor.dimension)) {
    target.dimensions.set(descriptor.dimension, {
      dimension: descriptor.dimension,
      unit: descriptor.baseUnit,
      quantityMicro: 0n,
      quantityAvailable: true,
      amountMicro: 0n,
      amountAvailable: true,
      priceCandidates: new Set(),
    })
  }
  const bucket = target.dimensions.get(descriptor.dimension)
  const quantity = scaledInteger(item.quantity)
  const price = decimalParts(item.price) ? item.price : null
  if (quantity == null) bucket.quantityAvailable = false
  else bucket.quantityMicro += roundDivision(quantity * descriptor.factorMicro, quantityScale)
  if (price == null || quantity == null) bucket.amountAvailable = false
  else {
    bucket.amountMicro += productAmountMicro(item.quantity, item.price)
    const basePrice = priceInBaseCents(price, descriptor.factorMicro)
    if (basePrice != null) bucket.priceCandidates.add(basePrice.toString())
  }
}

export function aggregateBillItems(items = []) {
  const products = new Map()
  for (const item of items) {
    if (!normalizeProductPart(item?.name)) continue
    const key = comparisonIdentity(item)
    if (!products.has(key)) products.set(key, { key, name: '', category: '', dimensions: new Map() })
    addItemToProduct(products.get(key), item)
  }
  return products
}

function productAmountCents(product) {
  if (!product) return null
  const dimensions = [...product.dimensions.values()]
  if (!dimensions.length || dimensions.some((bucket) => !bucket.amountAvailable)) return null
  return microCurrencyToCents(dimensions.reduce((sum, bucket) => sum + bucket.amountMicro, 0n))
}

function comparableDimension(previous, current) {
  if (!previous || !current) return null
  const previousDimensions = [...previous.dimensions.values()]
  const currentDimensions = [...current.dimensions.values()]
  if (previousDimensions.length !== 1 || currentDimensions.length !== 1) return null
  if (previousDimensions[0].dimension !== currentDimensions[0].dimension) return null
  return [previousDimensions[0], currentDimensions[0]]
}

function weightedPriceCents(bucket) {
  if (!bucket?.amountAvailable || !bucket?.quantityAvailable) return null
  if (bucket.quantityMicro !== 0n) return roundDivision(bucket.amountMicro * 100n, bucket.quantityMicro)
  const candidates = [...bucket.priceCandidates]
  return candidates.length === 1 ? BigInt(candidates[0]) : null
}

function classify(previous, current) {
  if (previous == null || current == null) return null
  if (current > previous) return 'increased'
  if (current < previous) return 'decreased'
  return 'unchanged'
}

export function buildProductComparisons(previousBill, currentBill) {
  const previous = aggregateBillItems(previousBill?.items)
  const current = aggregateBillItems(currentBill?.items)
  const keys = new Set([...previous.keys(), ...current.keys()])
  return [...keys].map((key) => {
    const previousProduct = previous.get(key) || null
    const currentProduct = current.get(key) || null
    const source = currentProduct || previousProduct
    const dimensions = comparableDimension(previousProduct, currentProduct)
    const previousQuantity = dimensions?.[0].quantityAvailable ? dimensions[0].quantityMicro : null
    const currentQuantity = dimensions?.[1].quantityAvailable ? dimensions[1].quantityMicro : null
    const previousPrice = weightedPriceCents(dimensions?.[0])
    const currentPrice = weightedPriceCents(dimensions?.[1])
    const previousAmount = productAmountCents(previousProduct)
    const currentAmount = productAmountCents(currentProduct)
    const isNew = !previousProduct
    const isRemoved = !currentProduct
    return {
      key: comparisonProductKey({ name: source.name, category: source.category }),
      identity: key,
      name: source.name,
      category: source.category,
      previous: previousProduct,
      current: currentProduct,
      previousAmount,
      currentAmount,
      amountDifference: previousAmount == null || currentAmount == null ? null : currentAmount - previousAmount,
      previousQuantity,
      currentQuantity,
      quantityDifference: previousQuantity == null || currentQuantity == null ? null : currentQuantity - previousQuantity,
      previousPrice,
      currentPrice,
      priceDifference: previousPrice == null || currentPrice == null ? null : currentPrice - previousPrice,
      unit: dimensions?.[0].unit || null,
      previousQuantityText: formatProductQuantity(previousProduct),
      currentQuantityText: formatProductQuantity(currentProduct),
      priceStatus: classify(previousPrice, currentPrice),
      quantityStatus: classify(previousQuantity, currentQuantity),
      isNew,
      isRemoved,
    }
  }).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))
}

export function formatProductQuantity(product) {
  if (!product) return null
  const dimensions = [...product.dimensions.values()]
  if (!dimensions.length) return null
  return dimensions.map((bucket) => bucket.quantityAvailable
    ? `${formatScaledQuantity(bucket.quantityMicro)} ${bucket.unit}`
    : `Unavailable (${bucket.unit})`).join(' · ')
}

export function billQuantitySummary(bill) {
  const grouped = new Map()
  for (const item of bill?.items || []) {
    const descriptor = unitDescriptor(item.unit)
    const quantity = scaledInteger(item.quantity)
    const previous = grouped.get(descriptor.dimension) || { unit: descriptor.baseUnit, quantityMicro: 0n, available: true }
    if (quantity == null) previous.available = false
    else previous.quantityMicro += roundDivision(quantity * descriptor.factorMicro, quantityScale)
    grouped.set(descriptor.dimension, previous)
  }
  return [...grouped.values()].map((bucket) => bucket.available
    ? `${formatScaledQuantity(bucket.quantityMicro)} ${bucket.unit}`
    : `Unavailable (${bucket.unit})`).join(' · ') || '—'
}

export function compareBillQuantities(previousBill, currentBill) {
  const totals = (bill) => {
    const grouped = new Map()
    for (const item of bill?.items || []) {
      const descriptor = unitDescriptor(item.unit)
      const quantity = scaledInteger(item.quantity)
      const previous = grouped.get(descriptor.dimension) || { unit: descriptor.baseUnit, quantityMicro: 0n, available: true }
      if (quantity == null) previous.available = false
      else previous.quantityMicro += roundDivision(quantity * descriptor.factorMicro, quantityScale)
      grouped.set(descriptor.dimension, previous)
    }
    return grouped
  }
  const previous = totals(previousBill)
  const current = totals(currentBill)
  if (!previous.size || previous.size !== current.size) return { available: false, text: 'Unavailable (units differ)' }
  const differences = []
  for (const [dimension, previousBucket] of previous) {
    const currentBucket = current.get(dimension)
    if (!currentBucket || !previousBucket.available || !currentBucket.available) return { available: false, text: 'Unavailable (units differ)' }
    const difference = currentBucket.quantityMicro - previousBucket.quantityMicro
    differences.push(`${difference > 0n ? '+' : ''}${formatScaledQuantity(difference)} ${previousBucket.unit}`)
  }
  return { available: true, text: differences.join(' · ') }
}

export function formatScaledQuantity(value) {
  const numeric = Number(value) / Number(quantityScale)
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(numeric)
}

export function formatMoney(cents, { signed = false } = {}) {
  if (cents == null) return '—'
  const value = Number(cents) / 100
  const formatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(value))
  if (!signed || cents === 0n) return cents < 0n ? `-${formatted}` : formatted
  return `${cents > 0n ? '+' : '-'}${formatted}`
}

export function formatQuantityDifference(value, unit) {
  if (value == null) return '—'
  const sign = value > 0n ? '+' : value < 0n ? '−' : ''
  return `${sign}${formatScaledQuantity(value)} ${unit || ''}`.trim()
}

export function totalQuantityMicro(product, unit) {
  if (!product) return null
  const dimensions = [...product.dimensions.values()]
  if (dimensions.length !== 1 || dimensions[0].unit !== unit || !dimensions[0].quantityAvailable) return null
  return dimensions[0].quantityMicro
}

export function billTotalCents(bill) {
  return decimalToCents(bill?.total)
}
