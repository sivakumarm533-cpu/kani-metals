import logoMark from '../assets/logos/kani-metal-mark.webp'

const WIDTH = 1240
const FONT = 'Inter, "Segoe UI", Roboto, Arial, sans-serif'
const LINE = '#6b7280'
const TEXT = '#1f2937'
const MUTED = '#6b7280'

const methodLabels = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', upi_other: 'UPI', net_banking: 'Net Banking', cheque: 'Cheque', bank_deposit: 'Bank Deposit', cash: 'Cash', other: 'Other' }
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatPaise = (paise) => rupees.format((Number(paise) || 0) / 100)
export const formatBillDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
export const billNumber = (bill) => `BILL-${new Date(bill.issuedDate).toISOString().slice(0, 10).replaceAll('-', '')}-${String(bill._id).slice(-6).toUpperCase()}`
export const statusText = (state) => (state.pendingPaise === 0 ? 'PAID' : state.receivedPaise > 0 ? 'PARTIALLY PAID' : 'UNPAID')
const quantityText = (item) => `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(item.quantity) || 0)} ${item.unit || ''}`.trim()
const lineAmountPaise = (item) => Math.round((Number(item.quantity) || 0) * (Number(item.price) || 0) * 100)

/** Payments that count towards the bill, oldest first, labelled as advance when made before the bill date. */
export function billPayments(bill, payments = []) {
  return payments
    .filter((payment) => String(payment.bill?._id || payment.bill) === String(bill._id) && ['received', 'cleared'].includes(payment.paymentStatus))
    .sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate))
    .map((payment) => ({
      date: payment.paymentDate,
      amountPaise: payment.amountPaise,
      method: methodLabels[payment.paymentMethod] || payment.paymentMethod,
      kind: new Date(payment.paymentDate) < new Date(bill.issuedDate) ? 'Advance' : 'Payment',
    }))
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrap(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth || !line) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  // Hard-break single words that are still too wide.
  return lines.flatMap((entry) => {
    if (ctx.measureText(entry).width <= maxWidth) return [entry]
    const parts = []
    let part = ''
    for (const char of entry) {
      if (ctx.measureText(part + char).width > maxWidth && part) { parts.push(part); part = char } else part += char
    }
    return part ? [...parts, part] : parts
  })
}

const font = (weight, size) => `${weight} ${size}px ${FONT}`

/**
 * Draws the dealer bill in the Kani Metals template and returns a PNG Blob.
 * @param {{ business, dealer, bill, state: {totalPaise, receivedPaise, pendingPaise}, payments, accent }} data
 */
export async function renderBillImage({ business, dealer, bill, state, payments, accent = '#F36F12' }) {
  if (document.fonts?.load) await Promise.all([document.fonts.load(font(700, 40)), document.fonts.load(font(400, 24))]).catch(() => {})
  const logo = await loadImage(logoMark)
  const measure = document.createElement('canvas').getContext('2d')

  // ---- Layout measurement ----
  const columns = [
    { key: 'sno', label: 'S.NO', width: 100, align: 'center' },
    { key: 'item', label: 'Items', width: 0, align: 'left' },
    { key: 'qty', label: 'Quantity', width: 200, align: 'center' },
    { key: 'rate', label: 'Rate', width: 200, align: 'right' },
    { key: 'amount', label: 'Amount', width: 230, align: 'right' },
  ]
  columns[1].width = WIDTH - columns.reduce((sum, column) => sum + column.width, 0)
  measure.font = font(400, 26)
  const rows = bill.items.map((item, index) => {
    const lines = wrap(measure, item.name, columns[1].width - 36)
    const sub = item.category ? [item.category] : []
    return { item, index, lines, sub, height: Math.max(66, 24 + lines.length * 34 + sub.length * 28) }
  })
  const bodyHeight = Math.max(560, rows.reduce((sum, row) => sum + row.height, 0) + 20)
  const received = billPayments(bill, payments)
  measure.font = font(400, 24)
  const termsLines = wrap(measure, business.terms || '', WIDTH - 80).slice(0, 6)

  const headerH = 250
  const titleH = 80
  const infoH = 170
  const tableHeadH = 62
  const summaryRowH = 58
  const summaryH = summaryRowH * 3
  const paymentsH = received.length ? 70 + Math.min(received.length, 6) * 40 : 0
  const termsH = 70 + termsLines.length * 34 + 70
  const footerH = 60
  const height = headerH + titleH + infoH + tableHeadH + bodyHeight + summaryH + paymentsH + termsH + footerH

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.textBaseline = 'middle'

  // ---- Header ----
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, WIDTH, headerH)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 6
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 46, 45, 170, 160, 34)
  ctx.fill()
  ctx.restore()
  if (logo) ctx.drawImage(logo, 66, 60, 130, 130)
  else { ctx.fillStyle = accent; ctx.font = font(700, 40); ctx.textAlign = 'center'; ctx.fillText('LOGO', 131, 125) }

  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = font(700, 58)
  ctx.fillText(business.name || 'Kani Metals', 260, 88, WIDTH - 300)
  ctx.font = font(500, 26)
  const subtitle = [business.tagline, business.address].filter(Boolean).join(' · ')
  if (subtitle) ctx.fillText(subtitle, 262, 140, WIDTH - 300)
  const contact = [business.email, business.gstin ? `GSTIN: ${business.gstin}` : ''].filter(Boolean).join('   ')
  if (contact) { ctx.font = font(400, 22); ctx.fillText(contact, 262, 178, WIDTH - 600) }
  if (business.phone) {
    ctx.font = font(700, 30)
    const phoneWidth = ctx.measureText(business.phone).width
    const px = WIDTH - 50 - phoneWidth
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    roundRect(ctx, px - 60, 191, 42, 42, 10)
    ctx.fill()
    ctx.fillStyle = accent
    ctx.font = font(700, 26)
    ctx.textAlign = 'center'
    ctx.fillText('☎', px - 39, 213)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#ffffff'
    ctx.font = font(700, 30)
    ctx.fillText(business.phone, px, 213)
  }

  // ---- Title ----
  let y = headerH
  ctx.textAlign = 'center'
  ctx.fillStyle = accent
  ctx.font = font(700, 38)
  ctx.fillText('Bill Details', WIDTH / 2, y + 44)
  y += titleH

  // ---- Bill to / bill info ----
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke()
  ctx.textAlign = 'left'
  ctx.fillStyle = MUTED; ctx.font = font(600, 22); ctx.fillText('BILL TO', 40, y + 34)
  ctx.fillStyle = TEXT; ctx.font = font(700, 32); ctx.fillText(dealer.name, 40, y + 74, 640)
  ctx.fillStyle = MUTED; ctx.font = font(400, 24)
  ctx.fillText([dealer.phone, dealer.location].filter(Boolean).join(' · '), 40, y + 114, 640)
  if (dealer.category) ctx.fillText(dealer.category, 40, y + 146, 640)

  const infoX = 760
  const info = [['Bill No', billNumber(bill)], ['Bill Date', formatBillDate(bill.issuedDate)]]
  info.forEach(([label, value], index) => {
    ctx.fillStyle = MUTED; ctx.font = font(500, 22); ctx.textAlign = 'left'; ctx.fillText(label, infoX, y + 34 + index * 40)
    ctx.fillStyle = TEXT; ctx.font = font(700, 24); ctx.textAlign = 'right'; ctx.fillText(value, WIDTH - 40, y + 34 + index * 40)
  })
  const status = statusText(state)
  const statusColor = status === 'PAID' ? '#15803d' : status === 'UNPAID' ? '#b91c1c' : '#b45309'
  ctx.font = font(700, 22)
  const badgeW = ctx.measureText(status).width + 36
  ctx.fillStyle = `${statusColor}1a`
  roundRect(ctx, WIDTH - 40 - badgeW, y + 104, badgeW, 42, 21); ctx.fill()
  ctx.fillStyle = statusColor; ctx.textAlign = 'center'; ctx.fillText(status, WIDTH - 40 - badgeW / 2, y + 126)
  y += infoH

  // ---- Items table ----
  const tableTop = y
  const xs = []
  columns.reduce((x, column) => { xs.push(x); return x + column.width }, 0)
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2.5
  ctx.strokeRect(1, tableTop, WIDTH - 2, tableHeadH)
  ctx.fillStyle = TEXT
  ctx.font = font(500, 26)
  columns.forEach((column, index) => {
    ctx.textAlign = 'center'
    ctx.fillText(column.label, xs[index] + column.width / 2, tableTop + tableHeadH / 2)
  })
  y = tableTop + tableHeadH
  const bodyTop = y
  for (const row of rows) {
    const cy = y + 22
    const { item } = row
    const cell = (index, text, weight = 400) => {
      const column = columns[index]
      ctx.font = font(weight, 26)
      ctx.textAlign = column.align
      const x = column.align === 'left' ? xs[index] + 18 : column.align === 'right' ? xs[index] + column.width - 18 : xs[index] + column.width / 2
      ctx.fillText(text, x, cy + 12, column.width - 30)
    }
    ctx.fillStyle = TEXT
    cell(0, String(row.index + 1))
    ctx.font = font(500, 26); ctx.textAlign = 'left'
    row.lines.forEach((line, lineIndex) => ctx.fillText(line, xs[1] + 18, cy + 12 + lineIndex * 34))
    if (row.sub.length) { ctx.fillStyle = MUTED; ctx.font = font(400, 21); ctx.fillText(row.sub[0], xs[1] + 18, cy + 12 + row.lines.length * 34 + 2); ctx.fillStyle = TEXT }
    cell(2, quantityText(item))
    cell(3, formatPaise(Math.round((Number(item.price) || 0) * 100)))
    cell(4, formatPaise(lineAmountPaise(item)), 600)
    y += row.height
  }
  const bodyBottom = bodyTop + bodyHeight
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(1, bodyTop); ctx.lineTo(1, bodyBottom)
  ctx.moveTo(WIDTH - 1, bodyTop); ctx.lineTo(WIDTH - 1, bodyBottom)
  for (let index = 1; index < columns.length; index += 1) { ctx.moveTo(xs[index], tableTop); ctx.lineTo(xs[index], bodyBottom) }
  ctx.moveTo(0, bodyBottom); ctx.lineTo(WIDTH, bodyBottom)
  ctx.stroke()

  // ---- Totals ----
  y = bodyBottom
  const labelRight = xs[4] - 24
  const summary = [
    ['Total :', formatPaise(state.totalPaise), TEXT, 700],
    ['Paid (Advance / Partial) :', formatPaise(state.receivedPaise), '#15803d', 600],
    ['Balance Due :', formatPaise(state.pendingPaise), state.pendingPaise ? accent : '#15803d', 800],
  ]
  summary.forEach(([label, value, color, weight], index) => {
    const rowTop = y + index * summaryRowH
    if (index === 2) { ctx.fillStyle = `${accent}14`; ctx.fillRect(xs[4], rowTop, columns[4].width, summaryRowH) }
    ctx.fillStyle = TEXT; ctx.font = font(index === 2 ? 700 : 500, 26); ctx.textAlign = 'right'
    ctx.fillText(label, labelRight, rowTop + summaryRowH / 2)
    ctx.fillStyle = color; ctx.font = font(weight, 27)
    ctx.fillText(value, WIDTH - 18, rowTop + summaryRowH / 2, columns[4].width - 24)
    ctx.strokeStyle = LINE; ctx.lineWidth = 2.5
    ctx.beginPath(); ctx.moveTo(0, rowTop + summaryRowH); ctx.lineTo(WIDTH, rowTop + summaryRowH)
    ctx.moveTo(xs[4], rowTop); ctx.lineTo(xs[4], rowTop + summaryRowH); ctx.stroke()
  })
  y += summaryH

  // ---- Payments received ----
  if (received.length) {
    ctx.textAlign = 'left'; ctx.fillStyle = TEXT; ctx.font = font(700, 24)
    ctx.fillText('Payments received', 40, y + 40)
    received.slice(0, 6).forEach((payment, index) => {
      const rowY = y + 82 + index * 40
      ctx.fillStyle = MUTED; ctx.font = font(400, 23); ctx.textAlign = 'left'
      ctx.fillText(`${formatBillDate(payment.date)}  ·  ${payment.kind}  ·  ${payment.method}`, 40, rowY)
      ctx.fillStyle = '#15803d'; ctx.font = font(600, 23); ctx.textAlign = 'right'
      ctx.fillText(formatPaise(payment.amountPaise), WIDTH - 40, rowY)
    })
    y += paymentsH
  }

  // ---- Terms & conditions ----
  ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke()
  ctx.textAlign = 'left'; ctx.fillStyle = TEXT; ctx.font = font(700, 24)
  ctx.fillText('Terms & Conditions :', 40, y + 40)
  ctx.fillStyle = MUTED; ctx.font = font(400, 24)
  termsLines.forEach((line, index) => ctx.fillText(line, 40, y + 80 + index * 34))
  ctx.textAlign = 'center'; ctx.fillStyle = MUTED; ctx.font = font(500, 21)
  ctx.fillText(`Thank you for your business · ${business.name || 'Kani Metals'}`, WIDTH / 2, height - footerH - 30)

  // ---- Footer bar with centre notch ----
  ctx.fillStyle = accent
  ctx.fillRect(0, height - 24, WIDTH, 24)
  ctx.beginPath()
  ctx.moveTo(WIDTH / 2 - 52, height - 24)
  ctx.lineTo(WIDTH / 2, height - 60)
  ctx.lineTo(WIDTH / 2 + 52, height - 24)
  ctx.closePath()
  ctx.fill()

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the bill image.'))), 'image/png'))
}

/** Plain-text bill for WhatsApp messages (WhatsApp renders *bold*). */
export function billMessage({ business, dealer, bill, state, payments }) {
  const lines = [
    `*${business.name || 'Kani Metals'}*`,
    business.phone ? `Phone: ${business.phone}` : null,
    '',
    `*Bill Details*`,
    `Bill No: ${billNumber(bill)}`,
    `Date: ${formatBillDate(bill.issuedDate)}`,
    `Dealer: ${dealer.name}`,
    '',
    ...bill.items.map((item, index) => `${index + 1}. ${item.name} — ${quantityText(item)} × ${formatPaise(Math.round((Number(item.price) || 0) * 100))} = ${formatPaise(lineAmountPaise(item))}`),
    '',
    `*Total:* ${formatPaise(state.totalPaise)}`,
    `*Paid (Advance / Partial):* ${formatPaise(state.receivedPaise)}`,
    `*Balance Due:* ${formatPaise(state.pendingPaise)}`,
    `Status: ${statusText(state)}`,
  ]
  const received = billPayments(bill, payments)
  if (received.length) {
    lines.push('', '*Payments received*')
    received.forEach((payment) => lines.push(`• ${formatBillDate(payment.date)} — ${payment.kind} (${payment.method}): ${formatPaise(payment.amountPaise)}`))
  }
  if (business.terms) lines.push('', `_${business.terms}_`)
  lines.push('', 'Thank you.')
  return lines.filter((line) => line !== null).join('\n')
}

/** Converts a dealer phone number to WhatsApp's international format (defaults to India, +91). */
export function whatsappNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  return digits.length >= 11 && digits.length <= 15 ? digits : ''
}
