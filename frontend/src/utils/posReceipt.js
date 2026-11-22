import logoMark from '../assets/logos/kani-metal-mark.webp'
import { apiRequest } from '../services/api.js'
import { POS_DEFAULTS } from '../settings/appSettingsContext.js'
import { billNumber, formatPaise, oldestFirst, statusText } from './billImage.js'

/*
 * POS (thermal receipt) printing. The receipt is a small HTML page sized for 58 mm or
 * 80 mm roll paper and printed through the browser print dialog, so it works with any
 * thermal printer installed on the computer or phone (USB, Bluetooth or network).
 * Settings: Settings → Bill details → POS printing. Everything prints in pure black
 * (thermal printers cannot print colour or grey well).
 */

/** Receipt designs. Keep the ids in sync with POS_TEMPLATES in backend/models/AppSetting.js. */
export const POS_TEMPLATES = [
  { id: 'classic', name: 'Classic', description: 'Centred header, item with quantity × rate below.' },
  { id: 'compact', name: 'Compact table', description: 'One row per item: Item · Qty · Rate · Amount. Uses the least paper.' },
  { id: 'bold', name: 'Bold', description: 'Black header band and a big inverted total.' },
  { id: 'mono', name: 'Dot-matrix', description: 'Fixed-width text on a 32/48 character grid, like classic POS printers.' },
  { id: 'invoice', name: 'Cash bill', description: 'Formal bill: ruled table, amount in words and signature lines.' },
]

// Printable width inside the paper (printers leave a few mm on each side).
const PRINT_WIDTH = { 58: 48, 80: 72 }
const FONT_PX = { small: 11, normal: 12.5, large: 14.5 }
// Characters per line for the dot-matrix template (standard 58 mm = 32, 80 mm = 48).
const MONO_COLUMNS = { 58: { small: 32, normal: 32, large: 28 }, 80: { small: 48, normal: 48, large: 42 } }

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
const quantity = (item) => `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(Number(item.quantity) || 0)} ${item.unit || ''}`.trim()
const ratePaise = (item) => Math.round((Number(item.price) || 0) * 100)
const lineAmountPaise = (item) => Math.round((Number(item.quantity) || 0) * (Number(item.price) || 0) * 100)
const receiptDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
const printedAt = () => new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
// Plain number with Indian grouping and no ₹ sign, for narrow columns.
const plainMoney = (paise) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((Number(paise) || 0) / 100)

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function belowHundred(n) { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}` }
function belowThousand(n) { return `${n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${n % 100 ? belowHundred(n % 100) : ''}` }

/** Indian-system words for a rupee amount, e.g. 125050 paise → "Rupees One Thousand Two Hundred Fifty and Fifty Paise Only". */
export function amountInWords(paise) {
  const total = Math.max(0, Math.round(Number(paise) || 0))
  let rupees = Math.floor(total / 100)
  const coins = total % 100
  const parts = []
  for (const [size, label] of [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']]) {
    if (rupees >= size) {
      const count = Math.floor(rupees / size)
      parts.push(`${size === 10000000 && count >= 100 ? amountInWords(count * 100).replace(/^Rupees | Only$/g, '') : belowThousand(count)} ${label}`)
      rupees %= size
    }
  }
  if (rupees) parts.push(belowThousand(rupees))
  if (!parts.length && coins) return `${belowHundred(coins)} Paise Only`
  const words = parts.join(' ') || 'Zero'
  return `Rupees ${words}${coins ? ` and ${belowHundred(coins)} Paise` : ''} Only`
}

/**
 * The figures a receipt needs for one bill, from GET /payments/dealers/:id.
 * `previousPaise`: unpaid amount of this dealer's older bills.
 */
export function receiptData(details, billId) {
  const row = details?.bills?.find((entry) => String(entry.bill._id) === String(billId))
  if (!row) return null
  const older = details.bills.filter((entry) => String(entry.bill._id) !== String(billId) && entry.pendingPaise > 0 && oldestFirst('issuedDate')(entry.bill, row.bill) < 0)
  return {
    dealer: details.dealer,
    bill: row.bill,
    state: { totalPaise: row.totalPaise, receivedPaise: row.receivedPaise, pendingPaise: row.pendingPaise },
    previousPaise: older.reduce((sum, entry) => sum + entry.pendingPaise, 0),
    previousCount: older.length,
  }
}

/* ---------- Shared pieces (HTML templates) ---------- */

const row = (label, value, className = '') => `<div class="row${className ? ` ${className}` : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`

function headerLines(business, pos) {
  return [
    business.tagline,
    pos.showAddress && business.address,
    pos.showPhone && business.phone && `Ph: ${business.phone}`,
    pos.showGstin && business.gstin && `GSTIN: ${business.gstin}`,
  ].filter(Boolean)
}

const logoTag = (pos) => (pos.showLogo ? `<img class="logo" src="${escapeHtml(new URL(logoMark, window.location.href).href)}" alt="">` : '')
const dealerLine = (dealer) => [dealer.phone, dealer.location].filter(Boolean).join(' · ')

function header(business, pos, copyLabel) {
  return `${logoTag(pos)}<div class="name">${escapeHtml(business.name || 'Bill')}</div>`
    + headerLines(business, pos).map((text) => `<div class="center small">${escapeHtml(text)}</div>`).join('')
    + (copyLabel ? `<div class="center small copy">${escapeHtml(copyLabel)}</div>` : '')
}

function meta({ bill, dealer }, pos) {
  return row('Bill No', billNumber(bill)) + row('Date', receiptDate(bill.issuedDate))
    + (pos.showDealer && dealer?.name ? `<div class="to"><span class="small">To:</span> <b>${escapeHtml(dealer.name)}</b>${dealerLine(dealer) ? `<div class="small">${escapeHtml(dealerLine(dealer))}</div>` : ''}</div>` : '')
}

function totals({ state, previousPaise, previousCount, bill }, pos, { totalClass = 'total' } = {}) {
  const parts = [row(`Items: ${bill.items.length}`, ''), row('TOTAL', formatPaise(state.totalPaise), totalClass)]
  if (pos.showPayments) {
    if (state.receivedPaise > 0) parts.push(row('Paid', formatPaise(state.receivedPaise)))
    if (state.receivedPaise > 0 || state.pendingPaise > 0) parts.push(row('Balance', formatPaise(state.pendingPaise), 'strong'))
  }
  if (pos.showPreviousBalance && previousPaise > 0) {
    parts.push('<hr class="thin">', row(`Previous balance (${previousCount} ${previousCount === 1 ? 'bill' : 'bills'})`, formatPaise(previousPaise)), row('TOTAL DUE', formatPaise(previousPaise + state.pendingPaise), 'total'))
  }
  return parts.join('')
}

function footer(business, pos) {
  const parts = []
  if (pos.showTerms && business.terms) parts.push(`<div class="small terms">${escapeHtml(business.terms)}</div>`)
  if (pos.showGreeting && business.greeting) parts.push(`<div class="center greeting">${escapeHtml(business.greeting)}</div>`)
  if (pos.footerNote) parts.push(`<div class="center small">${escapeHtml(pos.footerNote)}</div>`)
  return (parts.length ? `<hr>${parts.join('')}` : '') + `<div class="center tiny">Printed ${escapeHtml(printedAt())}</div>`
}

// PAID / UNPAID / PARTIALLY PAID: off unless "Payment status" is switched on in POS settings.
const statusLine = (state, pos) => (pos.showStatus ? `<div class="center status">${escapeHtml(statusText(state))}</div>` : '')
const itemNote = (item, pos) => (pos.showItemNotes && item.note ? `<div class="small note">${escapeHtml(item.note)}</div>` : '')

/* ---------- Templates ---------- */

const TEMPLATES = {
  classic(data, pos, copyLabel) {
    const { business = {}, bill } = data
    const items = bill.items.map((item, index) => `<div class="item"><div class="item-name">${index + 1}. ${escapeHtml(item.name)}</div>`
      + `${row(`${quantity(item)} × ${formatPaise(ratePaise(item))}`, formatPaise(lineAmountPaise(item)), 'small-left')}${itemNote(item, pos)}</div>`).join('')
    return `${header(business, pos, copyLabel)}<hr>${meta(data, pos)}<hr>${row('Item', 'Amount', 'head')}${items}<hr>${totals(data, pos)}${statusLine(data.state, pos)}${footer(business, pos)}`
  },

  compact(data, pos, copyLabel) {
    const { business = {}, bill } = data
    const rows = bill.items.map((item) => `<tr><td class="c-name">${escapeHtml(item.name)}${itemNote(item, pos)}</td><td class="num">${escapeHtml(quantity(item))}</td><td class="num">${plainMoney(ratePaise(item))}</td><td class="num">${plainMoney(lineAmountPaise(item))}</td></tr>`).join('')
    return `${header(business, pos, copyLabel)}<hr>${meta(data, pos)}<hr>`
      + `<table class="grid"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amt</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<hr>${totals(data, pos)}${statusLine(data.state, pos)}${footer(business, pos)}`
  },

  bold(data, pos, copyLabel) {
    const { business = {}, bill, state } = data
    const items = bill.items.map((item, index) => `<div class="item"><div class="row"><b>${index + 1}. ${escapeHtml(item.name)}</b><b>${escapeHtml(formatPaise(lineAmountPaise(item)))}</b></div>`
      + `<div class="small">${escapeHtml(quantity(item))} @ ${escapeHtml(formatPaise(ratePaise(item)))}</div>${itemNote(item, pos)}</div>`).join('<hr class="thin">')
    const due = pos.showPreviousBalance && data.previousPaise > 0
    return `<div class="band">${logoTag(pos)}<div class="name">${escapeHtml(business.name || 'Bill')}</div>${headerLines(business, pos).map((text) => `<div class="small">${escapeHtml(text)}</div>`).join('')}</div>`
      + (copyLabel ? `<div class="center small copy">${escapeHtml(copyLabel)}</div>` : '')
      + `<div class="bold-meta">${meta(data, pos)}</div><hr class="heavy">${items}<hr class="heavy">`
      + `<div class="inverse">${row('TOTAL', formatPaise(state.totalPaise))}</div>`
      + (pos.showPayments && state.receivedPaise > 0 ? row('Paid', formatPaise(state.receivedPaise)) : '')
      + (pos.showPayments && (state.receivedPaise > 0 || state.pendingPaise > 0) ? row('Balance', formatPaise(state.pendingPaise), 'strong') : '')
      + (due ? `<hr class="thin">${row(`Previous balance (${data.previousCount})`, formatPaise(data.previousPaise))}${row('TOTAL DUE', formatPaise(data.previousPaise + state.pendingPaise), 'total')}` : '')
      + (pos.showStatus ? `<div class="center"><span class="stamp">${escapeHtml(statusText(state))}</span></div>` : '')
      + footer(business, pos)
  },

  invoice(data, pos, copyLabel) {
    const { business = {}, bill, dealer, state } = data
    const rows = bill.items.map((item, index) => `<tr><td class="num">${index + 1}</td><td>${escapeHtml(item.name)}${itemNote(item, pos)}<div class="small">${escapeHtml(quantity(item))} × ${plainMoney(ratePaise(item))}</div></td><td class="num">${plainMoney(lineAmountPaise(item))}</td></tr>`).join('')
    const due = pos.showPreviousBalance && data.previousPaise > 0 ? data.previousPaise + state.pendingPaise : null
    return `${header(business, pos, copyLabel)}<div class="title-box">CASH BILL</div>`
      + `<div class="two-col"><div><span class="small">Bill No</span><b>${escapeHtml(billNumber(bill))}</b></div><div class="right"><span class="small">Date</span><b>${escapeHtml(receiptDate(bill.issuedDate))}</b></div></div>`
      + (pos.showDealer && dealer?.name ? `<div class="party"><span class="small">Billed to</span><b>${escapeHtml(dealer.name)}</b>${dealerLine(dealer) ? `<div class="small">${escapeHtml(dealerLine(dealer))}</div>` : ''}</div>` : '')
      + `<table class="ruled"><thead><tr><th class="num">#</th><th>Particulars</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody>`
      + `<tfoot><tr><td></td><td>Total (${bill.items.length} items)</td><td class="num">${plainMoney(state.totalPaise)}</td></tr></tfoot></table>`
      + (pos.showPayments && state.receivedPaise > 0 ? row('Paid', formatPaise(state.receivedPaise)) : '')
      + (pos.showPayments && (state.receivedPaise > 0 || state.pendingPaise > 0) ? row('Balance', formatPaise(state.pendingPaise), 'strong') : '')
      + (due !== null ? row(`Previous balance (${data.previousCount})`, formatPaise(data.previousPaise)) + row('TOTAL DUE', formatPaise(due), 'total') : '')
      + `<div class="words"><span class="small">Amount in words</span>${escapeHtml(amountInWords(due ?? state.totalPaise))}</div>`
      + statusLine(state, pos)
      + `<div class="signs"><div>Receiver's sign</div><div>For ${escapeHtml(business.name || '')}</div></div>`
      + footer(business, pos)
  },
}

/* ---------- Dot-matrix (plain text on a character grid) ---------- */

function monoReceipt(data, pos, copyLabel, columns) {
  const { business = {}, bill, dealer, state } = data
  const lines = []
  const rule = (char) => lines.push(char.repeat(columns))
  // Wrapped to the grid, each line centred with spaces.
  const center = (text) => wrapText(text, columns).forEach((part) => lines.push(' '.repeat(Math.floor((columns - part.length) / 2)) + part))
  function wrapText(text, width) {
    const out = []
    let current = ''
    for (const word of String(text).split(/\s+/)) {
      if (!word) continue
      if ((current ? `${current} ${word}` : word).length <= width) current = current ? `${current} ${word}` : word
      else { if (current) out.push(current); current = word.length > width ? word.slice(0, width) : word }
    }
    if (current) out.push(current)
    return out.length ? out : ['']
  }
  const pair = (left, right) => {
    const space = columns - String(right).length - 1
    // Keep a leading indent (item detail lines sit under the item name).
    const indent = String(left).match(/^ */)[0]
    const parts = wrapText(left, Math.max(8, space - indent.length)).map((part) => indent + part)
    parts.forEach((part, index) => lines.push(index === parts.length - 1 ? `${part.padEnd(columns - String(right).length)}${right}` : part))
  }

  center(String(business.name || 'BILL').toUpperCase())
  headerLines(business, pos).forEach(center)
  if (copyLabel) center(`** ${copyLabel.toUpperCase()} **`)
  rule('=')
  pair('Bill No:', billNumber(bill))
  pair('Date:', receiptDate(bill.issuedDate))
  if (pos.showDealer && dealer?.name) {
    wrapText(`To: ${dealer.name}`, columns).forEach((line) => lines.push(line))
    if (dealerLine(dealer)) wrapText(dealerLine(dealer), columns).forEach((line) => lines.push(line))
  }
  rule('-')
  pair('ITEM', 'AMOUNT')
  rule('-')
  bill.items.forEach((item, index) => {
    wrapText(`${index + 1}. ${item.name}`, columns).forEach((line) => lines.push(line))
    pair(`   ${quantity(item)} x ${plainMoney(ratePaise(item))}`, plainMoney(lineAmountPaise(item)))
    if (pos.showItemNotes && item.note) wrapText(`   (${item.note})`, columns).forEach((line) => lines.push(line))
  })
  rule('-')
  pair(`Items: ${bill.items.length}`, '')
  pair('TOTAL Rs.', plainMoney(state.totalPaise))
  if (pos.showPayments) {
    if (state.receivedPaise > 0) pair('Paid', plainMoney(state.receivedPaise))
    if (state.receivedPaise > 0 || state.pendingPaise > 0) pair('Balance Rs.', plainMoney(state.pendingPaise))
  }
  if (pos.showStatus) center(`*** ${statusText(state)} ***`)
  if (pos.showPreviousBalance && data.previousPaise > 0) {
    rule('-')
    pair(`Previous bal (${data.previousCount})`, plainMoney(data.previousPaise))
    pair('TOTAL DUE Rs.', plainMoney(data.previousPaise + state.pendingPaise))
  }
  rule('=')
  if (pos.showTerms && business.terms) wrapText(business.terms, columns).forEach((line) => lines.push(line))
  if (pos.showGreeting && business.greeting) center(business.greeting)
  if (pos.footerNote) center(pos.footerNote)
  center(`Printed ${printedAt()}`)
  return `${pos.showLogo ? logoTag(pos) : ''}<pre class="mono">${escapeHtml(lines.join('\n'))}</pre>`
}

/* ---------- Page ---------- */

const TEMPLATE_CSS = {
  classic: '',
  compact: `
.grid { width: 100%; border-collapse: collapse; table-layout: fixed; }
.grid th { padding: .4mm 0; border-bottom: 1px solid #000; font-size: .82em; text-align: left; text-transform: uppercase; }
.grid td { padding: .7mm 0; vertical-align: top; font-size: .92em; }
.grid th:nth-child(2), .grid td:nth-child(2) { width: 22%; }
.grid th:nth-child(3), .grid td:nth-child(3) { width: 20%; }
.grid th:nth-child(4), .grid td:nth-child(4) { width: 25%; }
.grid .num { padding-left: 1mm; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.c-name { overflow-wrap: anywhere; }`,
  bold: `
.band { margin: 0 0 1.5mm; padding: 2mm 1.5mm; color: #fff; background: #000; text-align: center; }
.band .logo { filter: grayscale(1) invert(1) contrast(1.6); }
.band .name { color: #fff; }
.bold-meta { margin-top: 1mm; }
hr.heavy { border-top: 2px solid #000; }
.inverse { margin: 1mm 0; padding: 1.2mm 1.5mm; color: #fff; background: #000; font-size: 1.25em; font-weight: 800; }
`,
  mono: `
.mono { margin: 0; font-family: "Courier New", Consolas, "Lucida Console", monospace; white-space: pre; line-height: 1.25; }`,
  invoice: `
.title-box { margin: 1.5mm 0; padding: .8mm 0; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; font-weight: 800; letter-spacing: .25em; text-align: center; }
.two-col { display: flex; justify-content: space-between; gap: 2mm; }
.two-col > div, .party { display: grid; }
.two-col .right { text-align: right; }
.party { margin: 1mm 0 1.5mm; padding-top: 1mm; border-top: 1px dotted #000; }
.ruled { width: 100%; margin: 1mm 0; border-collapse: collapse; }
.ruled th, .ruled td { padding: .6mm .8mm; border: 1px solid #000; vertical-align: top; text-align: left; }
.ruled th { font-size: .82em; text-transform: uppercase; }
.ruled .num { text-align: right; white-space: nowrap; }
.ruled th:first-child, .ruled td:first-child { width: 6mm; }
.ruled tfoot td { font-weight: 800; }
.words { display: grid; margin: 1.5mm 0; padding: 1mm; border: 1px dashed #000; font-size: .9em; font-weight: 600; }
.signs { display: flex; justify-content: space-between; gap: 3mm; margin-top: 9mm; font-size: .82em; }
.signs > div { flex: 1; padding-top: .8mm; border-top: 1px solid #000; text-align: center; }`,
}

/** A complete HTML page with every copy of the receipt, ready to print. */
export function receiptHtml(data, posSettings) {
  const pos = { ...POS_DEFAULTS, ...posSettings }
  const template = POS_TEMPLATES.some((entry) => entry.id === pos.template) ? pos.template : 'classic'
  const paper = pos.paperWidth === '58' ? 58 : 80
  const width = PRINT_WIDTH[paper]
  const size = (FONT_PX[pos.fontSize] || FONT_PX.normal) - (paper === 58 ? 1.5 : 0)
  const columns = MONO_COLUMNS[paper][pos.fontSize] || MONO_COLUMNS[paper].normal
  // Monospace characters are ~0.6em wide: size the font so `columns` characters fill the width.
  const monoSize = ((width / 25.4) * 96) / columns / 0.6
  const copies = Math.min(3, Math.max(1, Number(pos.copies) || 1))
  const labels = copies === 1 ? [''] : ['Customer copy', 'Office copy', 'Extra copy'].slice(0, copies)
  const body = (label) => (template === 'mono' ? monoReceipt(data, pos, label, columns) : TEMPLATES[template](data, pos, label))
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(billNumber(data.bill))}</title><style>
@page { size: ${paper}mm 297mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { font: ${template === 'mono' ? `${monoSize.toFixed(2)}px/1.25 "Courier New", monospace` : `${size}px/1.35 "Segoe UI", Roboto, Arial, sans-serif`}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.receipt { width: ${width}mm; margin: 0 auto; padding: 2mm 0; }
.receipt + .receipt { break-before: page; page-break-before: always; }
.logo { display: block; width: ${paper === 58 ? 12 : 15}mm; height: auto; margin: 0 auto 1mm; filter: grayscale(1) contrast(1.4); }
.name { font-size: 1.35em; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: .02em; }
.center { text-align: center; }
.small { font-size: .88em; }
.tiny { margin-top: 1.5mm; font-size: .78em; }
.copy { margin-top: 1mm; font-weight: 700; text-transform: uppercase; }
hr { margin: 1.6mm 0; border: 0; border-top: 1px dashed #000; }
hr.thin { border-top-style: dotted; }
.row { display: flex; justify-content: space-between; gap: 2mm; }
.row > span:last-child { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.row.small-left > span:first-child { font-size: .88em; }
.row.head { font-weight: 700; text-transform: uppercase; font-size: .85em; }
.row.strong { font-weight: 700; }
.row.total { margin-top: .8mm; font-size: 1.2em; font-weight: 800; }
.to { margin-top: .8mm; }
.item { padding: .6mm 0; }
.item-name { font-weight: 600; overflow-wrap: anywhere; }
.note { font-style: italic; }
.terms { white-space: pre-line; }
.status { margin-top: 1mm; font-weight: 800; letter-spacing: .06em; }
.stamp { display: inline-block; margin-top: 1.5mm; padding: .6mm 3mm; border: 2px solid #000; font-weight: 800; letter-spacing: .1em; }
.greeting { margin-top: 1mm; font-weight: 700; }
.feed { height: ${Number(pos.feedLines) || 0}em; }
${TEMPLATE_CSS[template]}
@media screen { body { padding: 4mm 0; } .receipt + .receipt { margin-top: 4mm; border-top: 1px dashed #999; } }
</style></head><body data-paper="${paper}">${labels.map((label) => `<section class="receipt">${body(label)}<div class="feed"></div></section>`).join('')}</body></html>`
}

/**
 * Sets the print page to the paper width and the height of the longest receipt, so roll
 * printers do not feed a full A4/Letter length of blank paper. (CSS has no "auto" page height.)
 */
export function fitPageToReceipt(doc) {
  const paper = Number(doc.body.dataset.paper) || 80
  const pxToMm = 25.4 / 96
  const tallest = Math.max(...[...doc.querySelectorAll('.receipt')].map((section) => section.getBoundingClientRect().height), 50)
  const style = doc.createElement('style')
  style.textContent = `@page { size: ${paper}mm ${Math.ceil(tallest * pxToMm) + 2}mm; margin: 0; } @media print { .receipt + .receipt { margin-top: 0; border-top: 0; } }`
  doc.head.append(style)
}

/** Prints the receipt through a hidden frame, so the page itself is not printed. */
export function printReceiptHtml(html) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    let done = false
    const cleanup = () => { if (done) return; done = true; window.setTimeout(() => frame.remove(), 1000); resolve() }
    frame.onload = async () => {
      try {
        const doc = frame.contentDocument
        // Wait for the logo so it is not missing on the first print.
        await Promise.all([...doc.images].map((img) => (img.complete ? null : new Promise((ok) => { img.onload = ok; img.onerror = ok }))))
        fitPageToReceipt(doc)
        frame.contentWindow.addEventListener('afterprint', cleanup)
        frame.contentWindow.focus()
        frame.contentWindow.print()
        // Some browsers never fire afterprint; remove the frame later anyway.
        window.setTimeout(cleanup, 60000)
      } catch (error) { frame.remove(); reject(new Error('Printing is not available in this browser.', { cause: error })) }
    }
    frame.srcdoc = html
    document.body.append(frame)
  })
}

export function printReceipt(data, pos) {
  return printReceiptHtml(receiptHtml(data, pos))
}

/** Loads the dealer's bills and prints one bill on the POS printer. */
export async function printBillReceipt({ dealerId, billId, business, pos }) {
  const details = await apiRequest(`/payments/dealers/${encodeURIComponent(dealerId)}`)
  const data = receiptData(details, billId)
  if (!data) throw new Error('This bill could not be found.')
  await printReceipt({ ...data, business }, pos)
}
