import test from 'node:test'
import assert from 'node:assert/strict'
import { balanceDue, daysInMonth, isDateKey, ledgerTotals, monthEarnings, monthsWorked, rateOn, totalEarnings, todayKey } from '../utils/wages.js'

const daily = (ratePaise, extra = {}) => ({ joinDate: '2026-11-01', leftDate: '', payHistory: [{ from: '2026-11-01', payType: 'daily', ratePaise, overtimeRatePaise: 10000 }], ...extra })
const monthly = (ratePaise, extra = {}) => ({ joinDate: '2026-11-01', leftDate: '', payHistory: [{ from: '2026-11-01', payType: 'monthly', ratePaise, overtimeRatePaise: 0 }], ...extra })
const rec = (date, status, overtimeHours = 0) => ({ date, status, overtimeHours })

test('date helpers', () => {
  assert.equal(daysInMonth('2026-02'), 28)
  assert.equal(daysInMonth('2028-02'), 29)
  assert.equal(isDateKey('2026-02-30'), false)
  assert.equal(isDateKey('2026-11-22'), true)
  assert.equal(todayKey(new Date('2026-11-21T20:00:00Z'), 'Asia/Kolkata'), '2026-11-22')
})

test('daily worker is paid for present and half days plus overtime', () => {
  const records = [rec('2026-11-02', 'present', 2), rec('2026-11-03', 'half_day'), rec('2026-11-04', 'absent'), rec('2026-11-05', 'holiday')]
  const result = monthEarnings(daily(60000), records, '2026-11', '2026-11-10')
  assert.equal(result.present, 1)
  assert.equal(result.halfDay, 1)
  assert.equal(result.basePaise, 90000)
  assert.equal(result.overtimePaise, 20000)
  assert.equal(result.earnedPaise, 110000)
  assert.equal(result.unmarked, 6)
})

test('monthly staff lose pay only for absent and half days', () => {
  // 30-day month, ₹30,000 = ₹1,000/day; full month counted.
  const records = [rec('2026-11-02', 'absent'), rec('2026-11-03', 'half_day'), rec('2026-11-04', 'leave')]
  const result = monthEarnings(monthly(3000000), records, '2026-11', '2026-12-05')
  assert.equal(result.earnedPaise, 3000000 - 100000 - 50000)
})

test('only days from joining up to today count', () => {
  const employee = monthly(3000000, { joinDate: '2026-11-11' })
  assert.equal(monthEarnings(employee, [], '2026-11', '2026-11-20').earnedPaise, 1000000)
  assert.equal(monthEarnings(employee, [], '2026-10', '2026-11-20').earnedPaise, 0)
  assert.equal(monthEarnings({ ...employee, leftDate: '2026-11-15' }, [], '2026-11', '2026-11-30').earnedPaise, 500000)
})

test('a pay rise applies only from its start date', () => {
  const employee = daily(50000, { payHistory: [{ from: '2026-11-01', payType: 'daily', ratePaise: 50000 }, { from: '2026-11-10', payType: 'daily', ratePaise: 70000 }] })
  assert.equal(rateOn(employee.payHistory, '2026-11-09').ratePaise, 50000)
  const records = [rec('2026-11-09', 'present'), rec('2026-11-10', 'present')]
  assert.equal(monthEarnings(employee, records, '2026-11', '2026-11-30').earnedPaise, 120000)
})

test('total earnings span months and balance uses the wage account', () => {
  const employee = daily(50000, { joinDate: '2026-10-30', payHistory: [{ from: '2026-10-30', payType: 'daily', ratePaise: 50000 }] })
  assert.deepEqual(monthsWorked(employee, '2026-11-02'), ['2026-10', '2026-11'])
  const records = [rec('2026-10-30', 'present'), rec('2026-11-01', 'present')]
  const earned = totalEarnings(employee, records, '2026-11-02')
  assert.equal(earned, 100000)
  const totals = ledgerTotals([{ type: 'payment', amountPaise: 50000 }, { type: 'advance', amountPaise: 20000 }, { type: 'bonus', amountPaise: 10000 }, { type: 'deduction', amountPaise: 5000 }])
  assert.equal(balanceDue(earned, totals), 35000)
})
