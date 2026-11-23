import { daysWorked, formatPaise, monthLabel, payLabel, shortDate } from './staff.js'

/*
 * Employee report as a PNG (for WhatsApp): the chosen month's attendance and wages,
 * the total days worked since joining, and the balance still to pay.
 */

const WIDTH = 1080
const PAD = 56
const FONT = 'Inter, "Segoe UI", Roboto, Arial, sans-serif'
const TEXT = '#1f2937'
const MUTED = '#6b7280'
const SOFT = '#f3f4f6'
const TONES = { present: '#16a34a', halfDay: '#d97706', absent: '#dc2626', leave: '#2563eb', holiday: '#6b7280', unmarked: '#cbd5e1' }
const font = (weight, size) => `${weight} ${size}px ${FONT}`

function hexColor(value) {
  const text = String(value || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(text)) return text
  const short = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : '#B96C35'
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

function fitText(ctx, text, maxWidth) {
  let value = String(text || '')
  if (ctx.measureText(value).width <= maxWidth) return value
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1)
  return `${value}…`
}

/** The figures used by both the image and the text message. */
export function reportFigures(data) {
  const { employee, monthSummary: month, monthEntries, entryTotals, earnedTotalPaise, balanceDuePaise, totalSummary } = data
  const total = totalSummary || null
  const marked = total ? total.present + total.halfDay + total.absent : 0
  return {
    employee,
    month,
    monthEntries,
    entryTotals,
    total,
    monthName: monthLabel(data.month),
    monthWorked: daysWorked(month),
    monthEarned: month.earnedPaise + monthEntries.bonus - monthEntries.deduction,
    monthPaid: monthEntries.payment + monthEntries.advance,
    totalWorked: total ? daysWorked(total) : null,
    rate: total && marked ? Math.round((daysWorked(total) / marked) * 100) : null,
    earnedTotalPaise,
    balanceDuePaise,
  }
}

export async function renderStaffReport({ data, business = {}, accent: themeAccent }) {
  const accent = hexColor(themeAccent)
  const f = reportFigures(data)
  if (document.fonts?.load) await Promise.all([document.fonts.load(font(700, 40)), document.fonts.load(font(400, 24))]).catch(() => {})

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = 3000
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, WIDTH, canvas.height)
  ctx.textBaseline = 'alphabetic'
  const inner = WIDTH - PAD * 2

  // Header band
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, WIDTH, 170)
  ctx.fillStyle = '#ffffff'
  ctx.font = font(800, 42)
  ctx.fillText(fitText(ctx, business.name || 'Staff report', inner - 260), PAD, 78)
  ctx.font = font(500, 24)
  ctx.globalAlpha = 0.9
  ctx.fillText(fitText(ctx, [business.phone, business.address].filter(Boolean).join(' · ') || 'Staff & wages', inner - 260), PAD, 122)
  ctx.globalAlpha = 1
  ctx.textAlign = 'right'
  ctx.font = font(700, 22)
  ctx.fillText('STAFF REPORT', WIDTH - PAD, 72)
  ctx.font = font(800, 30)
  ctx.fillText(f.monthName, WIDTH - PAD, 116)
  ctx.textAlign = 'left'

  // Employee
  let y = 236
  ctx.fillStyle = TEXT
  ctx.font = font(800, 40)
  ctx.fillText(fitText(ctx, f.employee.name, inner), PAD, y)
  y += 40
  ctx.fillStyle = MUTED
  ctx.font = font(500, 24)
  const about = [f.employee.designation, payLabel(f.employee.currentPay), f.employee.joinDate && `Joined ${shortDate(f.employee.joinDate)}`, !f.employee.active && f.employee.leftDate && `Left ${shortDate(f.employee.leftDate)}`].filter(Boolean).join(' · ')
  ctx.fillText(fitText(ctx, about, inner), PAD, y)
  y += 40

  // Balance hero
  roundRect(ctx, PAD, y, inner, 150, 24)
  ctx.fillStyle = `${accent}14`
  ctx.fill()
  ctx.fillStyle = MUTED
  ctx.font = font(600, 24)
  ctx.fillText(f.balanceDuePaise < 0 ? 'Paid ahead' : 'Balance to pay', PAD + 32, y + 52)
  ctx.fillStyle = f.balanceDuePaise > 0 ? accent : '#16a34a'
  ctx.font = font(800, 56)
  ctx.fillText(formatPaise(Math.abs(f.balanceDuePaise)), PAD + 32, y + 118)
  ctx.textAlign = 'right'
  ctx.fillStyle = MUTED
  ctx.font = font(500, 22)
  ctx.fillText('All months, as of today', WIDTH - PAD - 32, y + 52)
  ctx.textAlign = 'left'
  y += 190

  const sectionTitle = (text) => {
    ctx.fillStyle = accent
    ctx.fillRect(PAD, y - 26, 6, 32)
    ctx.fillStyle = TEXT
    ctx.font = font(800, 30)
    ctx.fillText(text, PAD + 20, y)
    y += 30
  }

  const tiles = (items, columns) => {
    const gap = 14
    const w = (inner - gap * (columns - 1)) / columns
    const h = 104
    items.forEach((item, index) => {
      const x = PAD + (index % columns) * (w + gap)
      const top = y + Math.floor(index / columns) * (h + gap)
      roundRect(ctx, x, top, w, h, 16)
      ctx.fillStyle = SOFT
      ctx.fill()
      ctx.fillStyle = item.color || accent
      ctx.beginPath(); ctx.arc(x + 26, top + 36, 8, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = MUTED
      ctx.font = font(600, 21)
      ctx.fillText(fitText(ctx, item.label, w - 56), x + 44, top + 43)
      ctx.fillStyle = TEXT
      ctx.font = font(800, 34)
      ctx.fillText(fitText(ctx, String(item.value), w - 40), x + 22, top + 86)
    })
    y += Math.ceil(items.length / columns) * (h + gap) + 8
  }

  const counts = (summary) => [
    { label: 'Present', value: summary.present, color: TONES.present },
    { label: 'Half day', value: summary.halfDay, color: TONES.halfDay },
    { label: 'Absent', value: summary.absent, color: TONES.absent },
    { label: 'Leave', value: summary.leave, color: TONES.leave },
    { label: 'Holiday', value: summary.holiday, color: TONES.holiday },
    { label: 'Not marked', value: summary.unmarked, color: TONES.unmarked },
  ]

  const bar = (summary) => {
    const parts = ['present', 'halfDay', 'absent', 'leave', 'holiday', 'unmarked'].map((key) => [key, summary[key]]).filter(([, count]) => count > 0)
    const sum = parts.reduce((total, [, count]) => total + count, 0)
    if (!sum) return
    ctx.save()
    roundRect(ctx, PAD, y, inner, 18, 9)
    ctx.clip()
    let x = PAD
    for (const [key, count] of parts) {
      const w = (count / sum) * inner
      ctx.fillStyle = TONES[key]
      ctx.fillRect(x, y, w, 18)
      x += w
    }
    ctx.restore()
    y += 42
  }

  const ledger = (rows) => {
    for (const row of rows) {
      ctx.font = font(row.total ? 800 : 500, row.total ? 28 : 25)
      ctx.fillStyle = row.total ? TEXT : MUTED
      ctx.fillText(row.label, PAD, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = row.color || TEXT
      ctx.font = font(row.total ? 800 : 700, row.total ? 30 : 25)
      ctx.fillText(row.value, WIDTH - PAD, y)
      ctx.textAlign = 'left'
      y += 18
      if (!row.total) {
        ctx.strokeStyle = '#e5e7eb'
        ctx.setLineDash([6, 6])
        ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(WIDTH - PAD, y); ctx.stroke()
        ctx.setLineDash([])
      }
      y += 38
    }
  }

  // Total days working (since joining)
  if (f.total) {
    sectionTitle('Total days working')
    y += 26
    ctx.fillStyle = accent
    ctx.font = font(800, 72)
    const big = String(f.totalWorked)
    ctx.fillText(big, PAD, y + 56)
    const bigW = ctx.measureText(big).width
    ctx.fillStyle = TEXT
    ctx.font = font(700, 28)
    ctx.fillText('days worked', PAD + bigW + 18, y + 26)
    ctx.fillStyle = MUTED
    ctx.font = font(500, 22)
    ctx.fillText(`of ${f.total.calendarDays} days · ${f.total.months} ${f.total.months === 1 ? 'month' : 'months'}`, PAD + bigW + 18, y + 58)
    if (f.rate !== null) {
      ctx.textAlign = 'right'
      ctx.fillStyle = '#16a34a'
      ctx.font = font(800, 44)
      ctx.fillText(`${f.rate}%`, WIDTH - PAD, y + 36)
      ctx.fillStyle = MUTED
      ctx.font = font(600, 20)
      ctx.fillText('attendance', WIDTH - PAD, y + 64)
      ctx.textAlign = 'left'
    }
    y += 96
    bar(f.total)
    tiles([...counts(f.total), { label: 'Overtime', value: `${f.total.overtimeHours} h`, color: accent }, { label: 'Total earned', value: formatPaise(f.earnedTotalPaise), color: accent }], 4)
    y += 30
  }

  // This month
  sectionTitle(`Attendance · ${f.monthName}`)
  y += 22
  bar(f.month)
  tiles([...counts(f.month), { label: 'Days worked', value: f.monthWorked, color: accent }, { label: 'Overtime', value: `${f.month.overtimeHours} h`, color: accent }], 4)
  y += 30

  sectionTitle(`Wages · ${f.monthName}`)
  y += 44
  ledger([
    { label: f.employee.currentPay?.payType === 'monthly' ? 'Salary for days counted' : `Wages for ${f.monthWorked} days`, value: formatPaise(f.month.basePaise) },
    { label: `Overtime (${f.month.overtimeHours} h)`, value: formatPaise(f.month.overtimePaise) },
    ...(f.monthEntries.bonus ? [{ label: 'Bonus', value: `+ ${formatPaise(f.monthEntries.bonus)}` }] : []),
    ...(f.monthEntries.deduction ? [{ label: 'Deductions', value: `− ${formatPaise(f.monthEntries.deduction)}` }] : []),
    { label: 'Paid this month', value: formatPaise(f.monthPaid), color: '#16a34a' },
    { label: 'Earned this month', value: formatPaise(f.monthEarned), total: true },
  ])
  y += 10

  sectionTitle('Account since joining')
  y += 44
  ledger([
    { label: 'Total earned', value: formatPaise(f.earnedTotalPaise) },
    ...(f.entryTotals.bonus ? [{ label: 'Bonuses', value: `+ ${formatPaise(f.entryTotals.bonus)}` }] : []),
    ...(f.entryTotals.deduction ? [{ label: 'Deductions', value: `− ${formatPaise(f.entryTotals.deduction)}` }] : []),
    { label: 'Wages paid', value: `− ${formatPaise(f.entryTotals.payment)}` },
    ...(f.entryTotals.advance ? [{ label: 'Advances', value: `− ${formatPaise(f.entryTotals.advance)}` }] : []),
    { label: f.balanceDuePaise < 0 ? 'Paid ahead' : 'Balance to pay', value: formatPaise(Math.abs(f.balanceDuePaise)), total: true, color: f.balanceDuePaise > 0 ? accent : '#16a34a' },
  ])

  // Footer
  y += 10
  ctx.fillStyle = accent
  ctx.fillRect(0, y, WIDTH, 70)
  ctx.fillStyle = '#ffffff'
  ctx.font = font(500, 21)
  ctx.textAlign = 'center'
  ctx.fillText(`Report made on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, WIDTH / 2, y + 43)
  ctx.textAlign = 'left'
  y += 70

  // Crop to what was drawn.
  const out = document.createElement('canvas')
  out.width = WIDTH
  out.height = Math.ceil(y)
  out.getContext('2d').drawImage(canvas, 0, 0)
  return new Promise((resolve, reject) => out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the report image.'))), 'image/png'))
}

/** The same report as a WhatsApp text message. */
export function staffReportMessage({ data, business = {} }) {
  const f = reportFigures(data)
  const lines = [
    `*${business.name || 'Staff report'}*`,
    `Staff report · ${f.monthName}`,
    '',
    `*${f.employee.name}*${f.employee.designation ? ` (${f.employee.designation})` : ''}`,
    payLabel(f.employee.currentPay),
    '',
  ]
  if (f.total) {
    lines.push('*Total days working*', `${f.totalWorked} days worked of ${f.total.calendarDays} days since ${shortDate(f.employee.joinDate)}${f.rate !== null ? ` · ${f.rate}% attendance` : ''}`, `Present ${f.total.present} · Half day ${f.total.halfDay} · Absent ${f.total.absent} · Leave ${f.total.leave} · Holiday ${f.total.holiday}`, '')
  }
  lines.push(
    `*${f.monthName}*`,
    `Days worked: ${f.monthWorked} (P ${f.month.present} · ½ ${f.month.halfDay} · A ${f.month.absent})`,
    `Overtime: ${f.month.overtimeHours} h`,
    `Earned: ${formatPaise(f.monthEarned)}`,
    `Paid: ${formatPaise(f.monthPaid)}`,
    '',
    `*${f.balanceDuePaise < 0 ? 'Paid ahead' : 'Balance to pay'}: ${formatPaise(Math.abs(f.balanceDuePaise))}*`,
  )
  return lines.join('\n')
}
