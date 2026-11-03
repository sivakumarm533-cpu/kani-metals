import test from 'node:test'
import assert from 'node:assert/strict'
import {
  billTotalCents,
  buildProductComparisons,
  comparisonIdentity,
  decimalToCents,
  formatQuantityDifference,
  percentChange,
  productAmountMicro,
} from '../src/utils/billComparison.js'

test('matches by normalized name and category and safely aggregates duplicate lines', () => {
  const rows = buildProductComparisons(
    { items: [
      { name: ' Copper Rod ', category: 'Metal', quantity: 2, unit: 'kg', price: 450 },
      { name: 'copper-rod', category: 'metal', quantity: 3, unit: 'KGS', price: 460 },
      { name: 'Old part', category: 'Metal', quantity: 1, unit: 'pcs', price: 5 },
    ] },
    { items: [
      { name: 'COPPER ROD', category: 'METAL', quantity: 5.5, unit: 'kg', price: 480 },
      { name: 'New part', category: 'Metal', quantity: 4, unit: 'pcs', price: 8 },
    ] },
  )
  const copper = rows.find((row) => row.name.toLowerCase().includes('copper'))
  assert.equal(rows.length, 3)
  assert.equal(copper.previousQuantity, 5_000_000n)
  assert.equal(copper.currentQuantity, 5_500_000n)
  assert.equal(copper.previousPrice, 45_600n)
  assert.equal(copper.currentPrice, 48_000n)
  assert.equal(copper.previousAmount, 228_000n)
  assert.equal(copper.currentAmount, 264_000n)
  assert.equal(copper.priceStatus, 'increased')
  assert.equal(copper.quantityStatus, 'increased')
  assert.ok(rows.find((row) => row.name === 'New part').isNew)
  assert.ok(rows.find((row) => row.name === 'Old part').isRemoved)
})

test('converts compatible mass units before comparing price and quantity', () => {
  const [row] = buildProductComparisons(
    { items: [{ name: 'Zinc', category: 'Metal', quantity: 1000, unit: 'g', price: 2 }] },
    { items: [{ name: 'Zinc', category: 'Metal', quantity: 1, unit: 'kg', price: 2000 }] },
  )
  assert.equal(row.previousQuantity, 1_000_000n)
  assert.equal(row.currentQuantity, 1_000_000n)
  assert.equal(row.previousPrice, 200_000n)
  assert.equal(row.currentPrice, 200_000n)
  assert.equal(row.previousAmount, 200_000n)
  assert.equal(row.currentAmount, 200_000n)
  assert.equal(row.priceStatus, 'unchanged')
  assert.equal(row.quantityStatus, 'unchanged')
})

test('does not compare incompatible units and preserves actual item amounts', () => {
  const [row] = buildProductComparisons(
    { items: [{ name: 'Fastener', category: 'Hardware', quantity: 2, unit: 'kg', price: 500 }] },
    { items: [{ name: 'Fastener', category: 'Hardware', quantity: 3, unit: 'pcs', price: 500 }] },
  )
  assert.equal(row.previousQuantity, null)
  assert.equal(row.currentQuantity, null)
  assert.equal(row.quantityDifference, null)
  assert.equal(row.priceDifference, null)
  assert.equal(row.previousAmount, 100_000n)
  assert.equal(row.currentAmount, 150_000n)
})

test('does not invent zero values for missing bill fields or absent products', () => {
  const rows = buildProductComparisons(
    { items: [{ name: 'Missing price', category: 'Misc', quantity: null, unit: 'pcs', price: 2 }] },
    { items: [{ name: 'Missing price', category: 'Misc', quantity: 2, unit: 'pcs', price: null }] },
  )
  assert.equal(rows[0].previousQuantity, null)
  assert.equal(rows[0].currentQuantity, 2_000_000n)
  assert.equal(rows[0].quantityDifference, null)
  assert.equal(rows[0].previousAmount, null)
  assert.equal(rows[0].currentAmount, null)
  assert.equal(rows[0].priceDifference, null)
})

test('matches category as part of identity and rounds financial values in integer cents', () => {
  assert.notEqual(comparisonIdentity({ name: 'Metal Rod', category: 'Copper' }), comparisonIdentity({ name: 'Metal Rod', category: 'Steel' }))
  assert.equal(productAmountMicro('0.1', '0.2'), 20_000n)
  assert.equal(decimalToCents('5356.01'), 535_601n)
  assert.equal(billTotalCents({ total: 5356.01 }), 535_601n)
  assert.equal(percentChange(0n, 1000n), null)
  assert.equal(percentChange(10_000n, 12_000n), 20)
})

test('formats quantity differences with a single sign', () => {
  assert.equal(formatQuantityDifference(-2_500_000n, 'kg'), '−2.5 kg')
  assert.equal(formatQuantityDifference(2_500_000n, 'kg'), '+2.5 kg')
  assert.equal(formatQuantityDifference(0n, 'kg'), '0 kg')
  assert.equal(formatQuantityDifference(null, 'kg'), '—')
})
