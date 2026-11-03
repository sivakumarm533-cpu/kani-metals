import mongoose from 'mongoose'
import Bill from '../models/Bill.js'
import Dealer from '../models/Dealer.js'
import Payment from '../models/Payment.js'
import { paymentCountsAsReceived, rupeesToPaise } from '../utils/money.js'
import { recordActivity } from '../utils/activity.js'

const methods = new Set(['gpay', 'phonepe', 'paytm', 'upi_other', 'net_banking', 'cheque', 'bank_deposit', 'cash', 'other'])
// The business operates in India; "today" and month buckets must not depend on the server's timezone.
const indiaDateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
function indiaDay(value) {
  if (Number.isNaN(new Date(value).getTime())) return { year: 0, month: 0, day: 0, key: 'invalid', monthKey: 'invalid' }
  const parts =Object.fromEntries(indiaDateParts.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]))
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), key: `${parts.year}-${parts.month}-${parts.day}`, monthKey: `${parts.year}-${parts.month}` }
}
const asDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function billPaymentState(bill, payments) {
  const totalPaise = rupeesToPaise(bill.total) ?? 0
  const receivedPaise = payments.filter(paymentCountsAsReceived).reduce((sum, payment) => sum + payment.amountPaise, 0)
  const pendingPaise = Math.max(0, totalPaise - receivedPaise)
  return { totalPaise, receivedPaise, pendingPaise, status: pendingPaise === 0 ? 'paid' : receivedPaise > 0 ? 'partial' : 'unpaid' }
}

async function reserveBillAmount(bill, amountPaise, session) {
  const maxPrior = (rupeesToPaise(bill.total) ?? 0) - amountPaise
  if (maxPrior < 0) return null
  return Bill.findOneAndUpdate({
    _id: bill._id,
    total: bill.total,
    $or: [{ receivedPaise: { $lte: maxPrior } }, { receivedPaise: { $exists: false } }],
  }, { $inc: { receivedPaise: amountPaise } }, { returnDocument: 'after', session })
}

async function safePaymentActivity(req, action, payment, before = null, after = null) {
  try {
    await recordActivity(req, { action, entity: 'payment', entityId: payment._id, entityLabel: `${action === 'create' ? 'Payment' : 'Payment'} ${payment._id}`, before, after })
  } catch (error) {
    console.error('Payment activity log failed:', error.message)
  }
}

export async function getPaymentOverview(req, res, next) {
  try {
    const [dealers, bills, payments] = await Promise.all([
      Dealer.find().select('name phone location category profileImage').lean(),
      Bill.find().sort({ issuedDate: -1 }).lean(),
      Payment.find().sort({ paymentDate: -1 }).lean(),
    ])
    const receivedPayments = payments.filter(paymentCountsAsReceived)
    const paidByBill = new Map()
    for (const payment of receivedPayments) paidByBill.set(String(payment.bill), (paidByBill.get(String(payment.bill)) || 0) + payment.amountPaise)
    const billStates = bills.map((bill) => {
      const totalPaise = rupeesToPaise(bill.total) ?? 0
      const receivedPaise = paidByBill.get(String(bill._id)) || 0
      return { bill, totalPaise, receivedPaise, pendingPaise: Math.max(0, totalPaise - receivedPaise), status: receivedPaise >= totalPaise ? 'paid' : receivedPaise > 0 ? 'partial' : 'unpaid' }
    })
    const totalBillPaise = billStates.reduce((sum, row) => sum + row.totalPaise, 0)
    const totalReceivedPaise = receivedPayments.reduce((sum, payment) => sum + payment.amountPaise, 0)
    const pendingDealerIds = new Set(billStates.filter((row) => row.pendingPaise > 0).map((row) => String(row.bill.dealer)))
    const todayKey = indiaDay(new Date()).key
    const todayReceivedPaise = receivedPayments.filter((payment) => indiaDay(payment.paymentDate).key === todayKey).reduce((sum, payment) => sum + payment.amountPaise, 0)
    const dealerRows = dealers.map((dealer) => {
      const rows = billStates.filter((row) => String(row.bill.dealer) === String(dealer._id))
      const totalPaise = rows.reduce((sum, row) => sum + row.totalPaise, 0)
      const receivedPaise = rows.reduce((sum, row) => sum + row.receivedPaise, 0)
      const pendingPaise = Math.max(0, totalPaise - receivedPaise)
      const dealerPayments = payments.filter((payment) => String(payment.dealer) === String(dealer._id))
      const latestPayment = dealerPayments.filter(paymentCountsAsReceived).sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0]
      const pendingCount = rows.filter((row) => row.pendingPaise > 0).length
      return { dealer, billCount: rows.length, totalPaise, receivedPaise, pendingPaise, pendingCount, status: !rows.length ? 'no-bills' : pendingPaise === 0 ? 'paid' : receivedPaise > 0 ? 'partial' : 'unpaid', latestPaymentDate: latestPayment?.paymentDate || null, bills: rows.map(({ bill, ...state }) => ({ _id: bill._id, issuedDate: bill.issuedDate, total: bill.total, ...state })) }
    })
    const methodsSummary = new Map()
    for (const payment of receivedPayments) methodsSummary.set(payment.paymentMethod, (methodsSummary.get(payment.paymentMethod) || 0) + payment.amountPaise)
    const monthMap = new Map()
    const currentMonth = indiaDay(new Date())
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(currentMonth.year, currentMonth.month - 1 - offset, 1))
      const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
      monthMap.set(key, { month: key, label: date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }), billedPaise: 0, receivedPaise: 0, pendingPaise: 0 })
    }
    for (const { bill, totalPaise, receivedPaise, pendingPaise } of billStates) {
      const key = indiaDay(bill.issuedDate).monthKey
      if (monthMap.has(key)) {
        monthMap.get(key).billedPaise += totalPaise
        monthMap.get(key).receivedPaise += receivedPaise
        monthMap.get(key).pendingPaise += pendingPaise
      }
    }
    res.json({
      summary: { totalBillPaise, totalReceivedPaise, pendingPaise: Math.max(0, totalBillPaise - totalReceivedPaise), todayReceivedPaise, pendingDealerCount: pendingDealerIds.size },
      dealers: dealerRows,
      payments: payments.map((payment) => ({ ...payment, dealer: String(payment.dealer), bill: String(payment.bill) })),
      methods: [...methodsSummary].map(([method, amountPaise]) => ({ method, amountPaise })),
      months: [...monthMap.values()],
    })
  } catch (error) { next(error) }
}

export async function getDealerPaymentDetails(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.dealerId)) return res.status(400).json({ message: 'Dealer ID is invalid.' })
    const dealer = await Dealer.findById(req.params.dealerId).lean()
    if (!dealer) return res.status(404).json({ message: 'Dealer not found.' })
    const [bills, payments] = await Promise.all([
      Bill.find({ dealer: dealer._id }).sort({ issuedDate: -1 }).lean(),
      Payment.find({ dealer: dealer._id }).sort({ paymentDate: -1 }).populate('createdBy', 'name').populate('bill', 'issuedDate').lean(),
    ])
    const billRows = bills.map((bill) => ({ bill, ...billPaymentState(bill, payments.filter((payment) => String(payment.bill?._id || payment.bill) === String(bill._id))) }))
    const totalPaise = billRows.reduce((sum, row) => sum + row.totalPaise, 0)
    const receivedPaise = billRows.reduce((sum, row) => sum + row.receivedPaise, 0)
    const lastPayment = payments.find(paymentCountsAsReceived)
    const pendingRows = billRows.filter((row) => row.pendingPaise > 0)
    res.json({ dealer, summary: { totalPaise, receivedPaise, pendingPaise: Math.max(0, totalPaise - receivedPaise), pendingBills: pendingRows.length, oldestUnpaidBill: pendingRows.sort((a, b) => new Date(a.bill.issuedDate) - new Date(b.bill.issuedDate))[0]?.bill || null, lastPaymentDate: lastPayment?.paymentDate || null }, bills: billRows, payments })
  } catch (error) { next(error) }
}

export async function createPayment(req, res, next) {
  const session = await mongoose.startSession()
  let createdPayment
  try {
    const { dealer: dealerId, bill: billId, amount, paymentMethod, transactionReference = '', paymentDate, notes = '', methodDetails = {} } = req.body
    if (!mongoose.isValidObjectId(dealerId) || !mongoose.isValidObjectId(billId)) return res.status(400).json({ message: 'Select a valid dealer and bill.' })
    if (!/^\d+(?:\.\d{1,2})?$/.test(String(amount ?? '').trim())) return res.status(400).json({ message: 'Enter a payment amount with up to two decimal places.' })
    const amountPaise = rupeesToPaise(amount)
    if (!amountPaise || amountPaise < 1) return res.status(400).json({ message: 'Enter a payment amount greater than zero with up to two decimal places.' })
    if (!methods.has(paymentMethod)) return res.status(400).json({ message: 'Select a valid payment method.' })
    const date = asDate(paymentDate)
    if (!date) return res.status(400).json({ message: 'A valid payment date is required.' })
    const dealer = await Dealer.findById(dealerId).lean()
    const bill = await Bill.findOne({ _id: billId, dealer: dealerId }).lean()
    if (!dealer || !bill) return res.status(404).json({ message: 'The selected bill does not belong to this dealer.' })
    const reference = String(transactionReference).trim().slice(0, 160)
    const referenceKey = reference ? reference.normalize('NFKC').toLocaleUpperCase('en') : undefined
    const status = paymentMethod === 'cheque' ? 'pending' : 'received'
    if (['cheque', 'bank_deposit'].includes(paymentMethod) && !String(methodDetails.bankName || '').trim()) return res.status(400).json({ message: 'Enter the bank name for this payment.' })
    if (['cheque', 'bank_deposit'].includes(paymentMethod) && !reference) return res.status(400).json({ message: paymentMethod === 'cheque' ? 'Enter the cheque number.' : 'Enter the bank deposit reference number.' })
    if (paymentMethod === 'cheque' && !asDate(methodDetails.chequeDate)) return res.status(400).json({ message: 'Enter a valid cheque date.' })
    await session.withTransaction(async () => {
      if (referenceKey && await Payment.exists({ referenceKey }).session(session)) {
        const duplicate = new Error('A payment with this transaction reference already exists.'); duplicate.statusCode = 409; throw duplicate
      }
      if (status === 'received') {
        const reserved = await reserveBillAmount(bill, amountPaise, session)
        if (!reserved) { const over = new Error('Payment amount cannot exceed this bill’s remaining balance.'); over.statusCode = 400; throw over }
      }
      const created = await Payment.create([{
        dealer: dealer._id, bill: bill._id, amountPaise, paymentMethod, transactionReference: reference, referenceKey,
        paymentDate: date, notes: String(notes).trim().slice(0, 1000),
        methodDetails: { bankName: String(methodDetails.bankName || '').trim().slice(0, 120), chequeDate: paymentMethod === 'cheque' && methodDetails.chequeDate ? asDate(methodDetails.chequeDate) : null },
        paymentStatus: status, statusHistory: [{ status, changedBy: req.user._id }], createdBy: req.user._id,
      }], { session })
      createdPayment = created[0]
    })
    await safePaymentActivity(req, 'create', createdPayment, null, createdPayment)
    res.status(201).json({ message: status === 'pending' ? 'Cheque recorded as pending. It will count as received after clearing.' : 'Payment recorded successfully.', payment: createdPayment })
  } catch (error) {
    if (error.code === 11000) error.statusCode = 409
    next(error)
  } finally { await session.endSession() }
}

export async function updateChequeStatus(req, res, next) {
  const session = await mongoose.startSession()
  let updated
  try {
    const { status } = req.body
    if (!['cleared', 'bounced'].includes(status)) return res.status(400).json({ message: 'Choose cleared or bounced.' })
    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session)
      if (!payment || payment.paymentMethod !== 'cheque' || payment.paymentStatus !== 'pending') { const error = new Error('Only a pending cheque can be cleared or marked bounced.'); error.statusCode = 409; throw error }
      if (status === 'cleared') {
        const bill = await Bill.findById(payment.bill).session(session)
        const reserved = bill && await reserveBillAmount(bill, payment.amountPaise, session)
        if (!reserved) { const error = new Error('This bill no longer has enough balance to clear the cheque.'); error.statusCode = 400; throw error }
      }
      payment.paymentStatus = status
      payment.statusHistory.push({ status, changedBy: req.user._id })
      updated = await payment.save({ session })
    })
    await safePaymentActivity(req, 'update', updated, null, updated)
    res.json({ message: status === 'cleared' ? 'Cheque marked as cleared.' : 'Cheque marked as bounced.', payment: updated })
  } catch (error) { next(error) }
  finally { await session.endSession() }
}

export async function reversePayment(req, res, next) {
  const session = await mongoose.startSession()
  let updated
  try {
    const reason = String(req.body.reason || '').trim()
    if (reason.length < 5 || reason.length > 500) return res.status(400).json({ message: 'Enter a correction reason between 5 and 500 characters.' })
    await session.withTransaction(async () => {
      const payment = await Payment.findById(req.params.id).session(session)
      if (!payment || payment.paymentStatus === 'reversed') { const error = new Error('Payment not found or already reversed.'); error.statusCode = 409; throw error }
      const before = payment.toObject()
      if (paymentCountsAsReceived(payment)) {
        const bill = await Bill.findOneAndUpdate({ _id: payment.bill, receivedPaise: { $gte: payment.amountPaise } }, { $inc: { receivedPaise: -payment.amountPaise } }, { returnDocument: 'after', session })
        if (!bill) { const error = new Error('Bill payment balance needs reconciliation; payment was not reversed.'); error.statusCode = 409; throw error }
      }
      payment.paymentStatus = 'reversed'
      payment.referenceKey = undefined
      payment.statusHistory.push({ status: 'reversed', changedBy: req.user._id, reason })
      updated = await payment.save({ session })
      updated._previousPayment = before
    })
    await safePaymentActivity(req, 'update', updated, updated._previousPayment, updated)
    res.json({ message: 'Payment reversed and retained in the payment history.', payment: updated })
  } catch (error) { next(error) }
  finally { await session.endSession() }
}
