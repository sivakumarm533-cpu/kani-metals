import test from 'node:test'
import assert from 'node:assert/strict'
import { paymentCountsAsReceived, rupeesToPaise } from '../utils/money.js'

test('converts rupees to integer paise without floating point accumulation', () => {
  assert.equal(rupeesToPaise('1234.56'), 123456)
  assert.equal(rupeesToPaise(0.30000000000000004), 30)
  assert.equal(rupeesToPaise('1e3'), 100000)
  assert.equal(rupeesToPaise('-1'), null)
  assert.equal(rupeesToPaise('not money'), null)
})

test('only received or cleared payments count toward the bill balance', () => {
  assert.equal(paymentCountsAsReceived({ paymentStatus: 'received' }), true)
  assert.equal(paymentCountsAsReceived({ paymentStatus: 'cleared' }), true)
  for (const paymentStatus of ['pending', 'bounced', 'reversed']) {
    assert.equal(paymentCountsAsReceived({ paymentStatus }), false)
  }
})
