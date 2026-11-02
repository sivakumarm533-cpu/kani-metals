export function rupeesToPaise(value) {
  if (value === null || value === undefined || value === '') return null
  const text = String(value).trim()
  const match = text.match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  if (!match) return null
  const fraction = match[2] || ''
  let scale = fraction.length - Number(match[3] || 0)
  let amount = BigInt(`${match[1]}${fraction}`)
  if (scale <= 2) amount *= 10n ** BigInt(2 - scale)
  else {
    const divisor = 10n ** BigInt(scale - 2)
    amount = (amount + divisor / 2n) / divisor
  }
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(amount)
}

export function formatPaise(paise) {
  const value = Number(paise || 0) / 100
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export function paymentCountsAsReceived(payment) {
  return payment.paymentStatus === 'received' || payment.paymentStatus === 'cleared'
}
