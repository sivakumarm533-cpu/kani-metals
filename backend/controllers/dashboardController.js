import Bill from '../models/Bill.js'
import Dealer from '../models/Dealer.js'
import Payment from '../models/Payment.js'
import { appliedPaise, rupeesToPaise } from '../utils/money.js'
import { userFeatureCheck } from '../middleware/auth.js'

const toPaise = (rupees) => rupeesToPaise(String(rupees ?? 0)) ?? 0

/**
 * Dashboard data: dealers with outstanding balances and the latest purchase
 * rate changes, derived from saved bills and received/cleared payments.
 */
export async function getDashboardSummary(req, res, next) {
  try {
    const [bills, payments, rateGroups] = await Promise.all([
      Bill.find().select('dealer total issuedDate').lean(),
      Payment.find({ paymentStatus: { $in: ['received', 'cleared'] } }).select('bill amountPaise excessPaise paymentDate dealer').lean(),
      Bill.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.name': { $type: 'string', $ne: '' } } },
        {
          $group: {
            _id: { name: { $toLower: { $trim: { input: '$items.name' } } }, unit: { $toLower: { $trim: { input: '$items.unit' } } } },
            rates: {
              $topN: {
                n: 12,
                sortBy: { issuedDate: -1, createdAt: -1 },
                output: { name: '$items.name', category: '$items.category', unit: '$items.unit', price: '$items.price', issuedDate: '$issuedDate', bill: '$_id', dealer: '$dealer' },
              },
            },
          },
        },
      ]),
    ])

    // ---- Pending amounts per dealer ----
    const paidByBill = new Map()
    const lastPaymentByDealer = new Map()
    for (const payment of payments) {
      const billId = String(payment.bill)
      paidByBill.set(billId, (paidByBill.get(billId) || 0) + appliedPaise(payment))
      const dealerId = String(payment.dealer)
      if (!lastPaymentByDealer.has(dealerId) || payment.paymentDate > lastPaymentByDealer.get(dealerId)) lastPaymentByDealer.set(dealerId, payment.paymentDate)
    }
    const byDealer = new Map()
    for (const bill of bills) {
      const dealerId = String(bill.dealer)
      const totalPaise = toPaise(bill.total)
      const receivedPaise = Math.min(totalPaise, paidByBill.get(String(bill._id)) || 0)
      const pendingPaise = Math.max(0, totalPaise - receivedPaise)
      const row = byDealer.get(dealerId) || { totalPaise: 0, receivedPaise: 0, pendingPaise: 0, pendingBills: 0, billCount: 0, oldestPendingDate: null }
      row.totalPaise += totalPaise
      row.receivedPaise += receivedPaise
      row.pendingPaise += pendingPaise
      row.billCount += 1
      if (pendingPaise > 0) {
        row.pendingBills += 1
        if (!row.oldestPendingDate || bill.issuedDate < row.oldestPendingDate) row.oldestPendingDate = bill.issuedDate
      }
      byDealer.set(dealerId, row)
    }
    const pendingIds = [...byDealer].filter(([, row]) => row.pendingPaise > 0).map(([id]) => id)
    const rateDealerIds = rateGroups.flatMap((group) => group.rates.map((rate) => String(rate.dealer)))
    const dealers = await Dealer.find({ _id: { $in: [...new Set([...pendingIds, ...rateDealerIds])] } }).select('name phone location category profileImage').lean()
    const dealerById = new Map(dealers.map((dealer) => [String(dealer._id), dealer]))

    const pendingDealers = pendingIds
      .map((id) => ({ dealer: dealerById.get(id), ...byDealer.get(id), lastPaymentDate: lastPaymentByDealer.get(id) || null }))
      .filter((row) => row.dealer)
      .sort((a, b) => b.pendingPaise - a.pendingPaise)

    // ---- Purchase rate updates per product ----
    const rateUpdates = rateGroups.map((group) => {
      const [latest, ...older] = group.rates
      // Compare with the most recent rate from a different bill (several lines in one bill are not an update).
      const previous = older.find((rate) => String(rate.bill) !== String(latest.bill)) || null
      const latestPaise = toPaise(latest.price)
      const previousPaise = previous ? toPaise(previous.price) : null
      const changePaise = previousPaise === null ? null : latestPaise - previousPaise
      return {
        key: `${group._id.name}|${group._id.unit}`,
        name: latest.name.trim(),
        category: latest.category,
        unit: latest.unit,
        latestPaise,
        latestDate: latest.issuedDate,
        latestDealer: dealerById.get(String(latest.dealer))?.name || '',
        previousPaise,
        previousDate: previous?.issuedDate || null,
        changePaise,
        changePercent: previousPaise ? Math.round((changePaise / previousPaise) * 1000) / 10 : null,
        trend: changePaise === null ? 'new' : changePaise > 0 ? 'up' : changePaise < 0 ? 'down' : 'same',
      }
    }).sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate) || a.name.localeCompare(b.name))

    // Only send the parts this person can see in the app (team members may have screens switched off).
    const can = await userFeatureCheck(req.user)
    const seesPayments = can('dealerPayments')
    const seesBills = seesPayments || can('itemEntry')
    const seesRates = can('itemPrices') || can('billComparison')
    res.json({
      summary: {
        totalPendingPaise: seesPayments ? pendingDealers.reduce((sum, row) => sum + row.pendingPaise, 0) : null,
        totalBilledPaise: seesBills ? [...byDealer.values()].reduce((sum, row) => sum + row.totalPaise, 0) : null,
        totalReceivedPaise: seesPayments ? [...byDealer.values()].reduce((sum, row) => sum + row.receivedPaise, 0) : null,
        dealersWithPending: seesPayments ? pendingDealers.length : null,
        pendingBills: seesPayments ? pendingDealers.reduce((sum, row) => sum + row.pendingBills, 0) : null,
      },
      pendingDealers: seesPayments ? pendingDealers.slice(0, 8) : [],
      rateUpdates: seesRates ? rateUpdates.slice(0, 12) : [],
    })
  } catch (error) { next(error) }
}
