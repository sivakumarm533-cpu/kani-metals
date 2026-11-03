import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import {
  buildProductComparisons,
  formatMoney,
  formatQuantityDifference,
  formatScaledQuantity,
  percentChange,
} from '../utils/billComparison.js'

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function billReference(bill) {
  const date = new Date(bill.issuedDate)
  const dateCode = Number.isNaN(date.getTime()) ? 'UNDATED' : date.toISOString().slice(0, 10).replaceAll('-', '')
  return `BILL-${dateCode}-${String(bill._id).slice(-6).toUpperCase()}`
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(value)) return 'N/A'
  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}%`
}

function ComparisonBarChart({ title, previousLabel, currentLabel, previousValue, currentValue, differenceText, currency = false, unit = '' }) {
  const values = [previousValue, currentValue].filter((value) => value != null).map((value) => Number(value < 0n ? -value : value))
  const max = Math.max(1, ...values)
  const baseY = 190
  const maxHeight = 122
  const bars = [
    { x: 115, color: '#b8c1cc', label: previousLabel, value: previousValue },
    { x: 285, color: '#f36f12', label: currentLabel, value: currentValue },
  ]
  return <section className="bill-product-chart-card">
    <div className="bill-product-chart-heading"><div><h3>{title}</h3><p>{differenceText}</p></div><span className="bill-product-chart-legend"><i />Previous <i className="current" />Current</span></div>
    {previousValue == null && currentValue == null ? <div className="bill-product-chart-unavailable"><i className="bi bi-bar-chart" aria-hidden="true" /><span>Comparison chart unavailable for these bill values.</span></div> : <svg className="bill-product-chart" viewBox="0 0 500 245" role="img" aria-label={title}>
      <line x1="55" y1={baseY} x2="445" y2={baseY} className="bill-product-chart-axis" />
      {bars.map((bar) => {
        const height = bar.value == null ? 0 : Math.max(3, Number(bar.value < 0n ? -bar.value : bar.value) / max * maxHeight)
        const y = baseY - height
        return <g key={bar.label}>
          {bar.value == null ? <line x1={bar.x} y1={baseY - 2} x2={bar.x + 80} y2={baseY - 2} className="bill-product-chart-missing" /> : <rect x={bar.x} y={y} width="80" height={height} rx="7" fill={bar.color}><title>{`${bar.label}: ${currency ? formatMoney(bar.value) : `${formatScaledQuantity(bar.value)} ${unit}`}`}</title></rect>}
          <text x={bar.x + 40} y={Math.max(22, y - 10)} textAnchor="middle" className="bill-product-chart-value"><title>{bar.value == null ? 'Value unavailable' : currency ? formatMoney(bar.value) : `${formatScaledQuantity(bar.value)} ${unit}`}</title>{bar.value == null ? 'N/A' : currency ? formatMoney(bar.value) : `${formatScaledQuantity(bar.value)} ${unit}`}</text>
          <text x={bar.x + 40} y="218" textAnchor="middle" className="bill-product-chart-label">{bar.label}</text>
        </g>
      })}
    </svg>}
  </section>
}

function SummaryMetric({ icon, label, value, note, tone = 'neutral' }) {
  return <article className={`bill-compare-metric bill-compare-metric-${tone}`}><span className="bill-compare-metric-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span><div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></article>
}

function DetailNotice({ title, message, onRetry }) {
  return <div className="bill-product-load-state" role="alert"><span><i className="bi bi-exclamation-circle" aria-hidden="true" /></span><h2>{title}</h2><p>{message}</p>{onRetry && <button type="button" className="back-button" onClick={onRetry}>Retry</button>}<Link className="continue-btn" to="/bill-comparison">Back to Bill Comparison</Link></div>
}

export default function BillComparisonProduct() {
  const { productKey } = useParams()
  const [searchParams] = useSearchParams()
  const dealerId = searchParams.get('dealer') || ''
  const previousBillId = searchParams.get('previousBill') || ''
  const currentBillId = searchParams.get('currentBill') || ''
  const hasContext = Boolean(dealerId && previousBillId && currentBillId && productKey)
  const [retryCount, setRetryCount] = useState(0)
  const [loaded, setLoaded] = useState({ key: '', data: null, error: '' })
  const contextKey = `${dealerId}|${previousBillId}|${currentBillId}|${productKey}|${retryCount}`
  const loading = hasContext && loaded.key !== contextKey

  useEffect(() => {
    if (!hasContext) return undefined
    let cancelled = false
    const params = new URLSearchParams({ dealer: dealerId, previousBill: previousBillId, currentBill: currentBillId })
    apiRequest(`/bills/compare?${params.toString()}`).then((data) => {
      if (!cancelled) setLoaded({ key: contextKey, data, error: '' })
    }).catch((error) => {
      if (!cancelled) setLoaded({ key: contextKey, data: null, error: error.message })
    })
    return () => { cancelled = true }
  }, [hasContext, dealerId, previousBillId, currentBillId, contextKey])

  const data = loaded.key === contextKey ? loaded.data : null
  const error = !hasContext ? 'The dealer and bill selection is missing from this product link.' : loading ? '' : loaded.error
  const rows = useMemo(() => data ? buildProductComparisons(data.previousBill, data.currentBill) : [], [data])
  const product = rows.find((row) => row.key === productKey) || null
  const previousBill = data?.previousBill
  const currentBill = data?.currentBill
  const hasBothSides = Boolean(product?.previous && product?.current)
  const pricePercent = percentChange(product?.previousPrice, product?.currentPrice)
  const quantityPercent = percentChange(product?.previousQuantity, product?.currentQuantity)
  const amountPercent = percentChange(product?.previousAmount, product?.currentAmount)
  const quantityUnit = product?.unit || ''
  const billDays = previousBill && currentBill ? Math.abs(new Date(currentBill.issuedDate).setHours(0, 0, 0, 0) - new Date(previousBill.issuedDate).setHours(0, 0, 0, 0)) / 86400000 : null
  const comparisonUrl = `/bill-comparison?dealer=${encodeURIComponent(dealerId)}&previousBill=${encodeURIComponent(previousBillId)}&currentBill=${encodeURIComponent(currentBillId)}`

  if (loading) return <section className="boarder-box bill-product-page"><div className="bill-product-skeleton" /><div className="bill-product-skeleton" /><div className="bill-product-skeleton" /></section>
  if (error) return <section className="boarder-box bill-product-page"><DetailNotice title="Could not load product comparison" message={error} onRetry={hasContext ? () => setRetryCount((count) => count + 1) : null} /></section>
  if (!product) return <section className="boarder-box bill-product-page"><DetailNotice title="Product not found in these bills" message="This product key does not match an item in the selected bills. Return to the comparison and open a product from the results." /></section>

  const priceUnavailable = hasBothSides && product.priceDifference == null
  const quantityUnavailable = hasBothSides && product.quantityDifference == null
  const priceTone = product.priceDifference == null ? 'neutral' : product.priceDifference > 0n ? 'negative' : product.priceDifference < 0n ? 'positive' : 'neutral'
  const quantityTone = product.quantityDifference == null ? 'neutral' : product.quantityDifference > 0n ? 'positive' : product.quantityDifference < 0n ? 'negative' : 'neutral'
  const amountTone = product.amountDifference == null ? 'neutral' : product.amountDifference > 0n ? 'positive' : product.amountDifference < 0n ? 'negative' : 'neutral'

  return <section className="boarder-box bill-product-page">
    <nav className="bill-product-breadcrumbs" aria-label="Breadcrumb"><Link to="/dashboard">Dashboard</Link><i className="bi bi-chevron-right" aria-hidden="true" /><Link to={comparisonUrl}>Bill Comparison</Link><i className="bi bi-chevron-right" aria-hidden="true" /><span>{data.dealer.name}</span><i className="bi bi-chevron-right" aria-hidden="true" /><strong>{product.name}</strong></nav>
    <div className="bill-product-toolbar"><Link className="back-button" to={comparisonUrl}><i className="bi bi-arrow-left" aria-hidden="true" /> Back to Comparison</Link><button type="button" className="back-button" onClick={() => window.print()}><i className="bi bi-printer" aria-hidden="true" /> Print product report</button></div>
    <header className="bill-product-hero"><span className="bill-product-hero-icon"><i className="bi bi-box-seam" aria-hidden="true" /></span><div><span className="bill-compare-eyebrow">PRODUCT COMPARISON</span><h1>{product.name}</h1><p>{product.category || 'Uncategorized'} <span>·</span> Unit: {quantityUnit || 'Multiple / unavailable'} <span>·</span> Product ID: Not stored in bill lines</p></div><div className="bill-product-hero-badges">{product.isNew && <span className="bill-compare-status bill-compare-status-new-item">New item</span>}{product.isRemoved && <span className="bill-compare-status bill-compare-status-removed-item">Removed item</span>}{product.priceStatus && <span className={`bill-compare-status bill-compare-status-${product.priceStatus}`}>Price {product.priceStatus}</span>}{product.quantityStatus && <span className={`bill-compare-status bill-compare-status-${product.quantityStatus}`}>Quantity {product.quantityStatus}</span>}</div></header>
    <section className="bill-product-context-grid"><article><span>Dealer</span><strong>{data.dealer.name}</strong><small>{data.dealer.phone}</small></article><article><span>Previous bill</span><strong>{billReference(previousBill)}</strong><small>{formatDate(previousBill.issuedDate)}</small></article><article><span>Current bill</span><strong>{billReference(currentBill)}</strong><small>{formatDate(currentBill.issuedDate)}</small></article><article><span>Time between bills</span><strong>{Number.isFinite(billDays) ? `${billDays} ${billDays === 1 ? 'day' : 'days'}` : 'Unavailable'}</strong><small>By bill issue dates</small></article></section>

    <div className="bill-product-section-heading"><div><h2>Price comparison</h2><p>Prices are normalized to the shared measurement unit when units are compatible.</p></div></div>
    <section className="bill-compare-metrics-grid bill-product-metrics-grid">
      <SummaryMetric icon="bi-tag" label="Previous Price" value={product.isNew ? '—' : product.previousPrice == null ? 'N/A' : formatMoney(product.previousPrice)} note={product.previous && quantityUnit ? `per ${quantityUnit}` : null} />
      <SummaryMetric icon="bi-tag-fill" label="Current Price" value={product.isRemoved ? '—' : product.currentPrice == null ? 'N/A' : formatMoney(product.currentPrice)} note={product.current && quantityUnit ? `per ${quantityUnit}` : null} />
      <SummaryMetric icon="bi-arrow-left-right" label="Price Difference" value={product.priceDifference == null ? product.isNew || product.isRemoved ? '—' : 'N/A' : formatMoney(product.priceDifference, { signed: true })} note={priceUnavailable ? 'Unit mismatch or missing values' : formatPercent(pricePercent)} tone={priceTone} />
      <SummaryMetric icon="bi-percent" label="Price Change" value={product.priceDifference == null ? 'N/A' : formatPercent(pricePercent)} />
    </section>

    <div className="bill-product-section-heading"><div><h2>Quantity comparison</h2><p>Mass units (g, kg and ton) are converted to kilograms; other dimensions are compared only with the same unit type.</p></div></div>
    <section className="bill-compare-metrics-grid bill-product-metrics-grid">
      <SummaryMetric icon="bi-box" label="Previous Quantity" value={product.isNew ? '—' : product.previousQuantity == null ? product.previousQuantityText || 'N/A' : `${formatScaledQuantity(product.previousQuantity)} ${quantityUnit}`} />
      <SummaryMetric icon="bi-boxes" label="Current Quantity" value={product.isRemoved ? '—' : product.currentQuantity == null ? product.currentQuantityText || 'N/A' : `${formatScaledQuantity(product.currentQuantity)} ${quantityUnit}`} />
      <SummaryMetric icon="bi-arrow-left-right" label="Quantity Difference" value={product.quantityDifference == null ? product.isNew || product.isRemoved ? '—' : 'N/A' : formatQuantityDifference(product.quantityDifference, quantityUnit)} note={quantityUnavailable ? 'Units differ or values are incomplete' : formatPercent(quantityPercent)} tone={quantityTone} />
      <SummaryMetric icon="bi-percent" label="Quantity Change" value={product.quantityDifference == null ? 'N/A' : formatPercent(quantityPercent)} />
    </section>

    <div className="bill-product-section-heading"><div><h2>Amount comparison</h2><p>Item amount is quantity × price. No tax, discount or additional charge is stored in this bill.</p></div></div>
    <section className="bill-compare-metrics-grid bill-product-metrics-grid">
      <SummaryMetric icon="bi-cash" label="Previous Item Amount" value={product.isNew ? '—' : formatMoney(product.previousAmount)} />
      <SummaryMetric icon="bi-cash-stack" label="Current Item Amount" value={product.isRemoved ? '—' : formatMoney(product.currentAmount)} />
      <SummaryMetric icon="bi-arrow-left-right" label="Amount Difference" value={product.amountDifference == null ? 'N/A' : formatMoney(product.amountDifference, { signed: true })} note={formatPercent(amountPercent)} tone={amountTone} />
      <SummaryMetric icon="bi-percent" label="Amount Change" value={product.amountDifference == null ? 'N/A' : formatPercent(amountPercent)} />
    </section>

    <section className="bill-product-charts-grid" aria-label="Product comparison charts">
      <ComparisonBarChart title="Price Comparison" previousLabel={billReference(previousBill)} currentLabel={billReference(currentBill)} previousValue={priceUnavailable ? null : product.previousPrice} currentValue={priceUnavailable ? null : product.currentPrice} differenceText={priceUnavailable ? 'Price comparison unavailable for these units or values.' : product.priceDifference == null ? 'Missing side is shown as unavailable, not zero.' : `Difference: ${formatMoney(product.priceDifference, { signed: true })} · ${formatPercent(pricePercent)}`} currency />
      <ComparisonBarChart title="Quantity Comparison" previousLabel={billReference(previousBill)} currentLabel={billReference(currentBill)} previousValue={quantityUnavailable ? null : product.previousQuantity} currentValue={quantityUnavailable ? null : product.currentQuantity} differenceText={quantityUnavailable ? 'Quantity comparison unavailable because units differ or values are missing.' : product.quantityDifference == null ? 'Missing side is shown as unavailable, not zero.' : `Difference: ${formatQuantityDifference(product.quantityDifference, quantityUnit)} · ${formatPercent(quantityPercent)}`} unit={quantityUnit} />
      <ComparisonBarChart title="Item Amount Comparison" previousLabel={billReference(previousBill)} currentLabel={billReference(currentBill)} previousValue={product.previousAmount} currentValue={product.currentAmount} differenceText={product.amountDifference == null ? 'Amount unavailable because item data is incomplete.' : `Difference: ${formatMoney(product.amountDifference, { signed: true })} · ${formatPercent(amountPercent)}`} currency />
    </section>

    <section className="bill-product-insights"><div className="bill-product-section-heading"><div><h2>Product Insights</h2><p>All values below come from the two selected bills.</p></div></div><div className="bill-product-insight-list">
      <p><i className="bi bi-tag" aria-hidden="true" /><strong>Price:</strong> {product.isNew ? 'New item; no previous price was recorded.' : product.isRemoved ? 'Removed item; no current price was recorded.' : priceUnavailable ? 'Not comparable because the bill units are incompatible or a value is missing.' : `Price ${product.priceStatus} by ${formatMoney(product.priceDifference, { signed: true })} (${formatPercent(pricePercent)}).`}</p>
      <p><i className="bi bi-box" aria-hidden="true" /><strong>Quantity:</strong> {product.isNew ? 'New item; no previous quantity was recorded.' : product.isRemoved ? 'Removed item; no current quantity was recorded.' : quantityUnavailable ? 'Not comparable because the units differ or a value is missing.' : `Quantity ${product.quantityStatus} by ${formatQuantityDifference(product.quantityDifference, quantityUnit)} (${formatPercent(quantityPercent)}).`}</p>
      <p><i className="bi bi-cash-stack" aria-hidden="true" /><strong>Item values:</strong> Previous {formatMoney(product.previousAmount)} · Current {formatMoney(product.currentAmount)} · Difference {formatMoney(product.amountDifference, { signed: true })} ({formatPercent(amountPercent)}).</p>
      <p><i className="bi bi-calendar3" aria-hidden="true" /><strong>Bill dates:</strong> {formatDate(previousBill.issuedDate)} → {formatDate(currentBill.issuedDate)} · {Number.isFinite(billDays) ? `${billDays} days apart` : 'Date difference unavailable'}.</p>
      {product.isNew && <p className="bill-product-new-note"><i className="bi bi-stars" aria-hidden="true" /><strong>NEW:</strong> The product appears only in the current bill. Previous values are unavailable, not zero.</p>}
      {product.isRemoved && <p className="bill-product-removed-note"><i className="bi bi-box-arrow-right" aria-hidden="true" /><strong>REMOVED:</strong> The product appears only in the previous bill. Current values are unavailable, not zero.</p>}
    </div></section>
  </section>
}
