import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import {
  billQuantitySummary,
  billTotalCents,
  buildProductComparisons,
  compareBillQuantities,
  formatMoney,
  formatQuantityDifference,
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

function billDateRelation(previousBill, currentBill) {
  if (!previousBill || !currentBill) return null
  const previousDate = new Date(previousBill.issuedDate).getTime()
  const currentDate = new Date(currentBill.issuedDate).getTime()
  if (!Number.isFinite(previousDate) || !Number.isFinite(currentDate)) return null
  if (previousDate === currentDate) return 'Both bills have the same date'
  return previousDate < currentDate ? 'Previous bill is older' : 'Current bill is older'
}

function statusLabels(row) {
  if (row.isNew) return ['New item']
  if (row.isRemoved) return ['Removed item']
  const result = []
  if (row.priceStatus) result.push(`Price ${row.priceStatus}`)
  if (row.quantityStatus) result.push(`Quantity ${row.quantityStatus}`)
  return result.length ? result : ['Comparison unavailable']
}

function safeCsvCell(value) {
  let text = String(value ?? '')
  if (/^[=+@\t\r]/.test(text) || /^-\D/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function downloadComparisonCsv({ rows, dealer, previousBill, currentBill }) {
  const headers = [
    'Dealer', 'Previous Bill Reference', 'Previous Bill Date', 'Current Bill Reference', 'Current Bill Date',
    'Product', 'Category', 'Previous Price', 'Current Price', 'Price Difference',
    'Previous Quantity', 'Current Quantity', 'Quantity Difference',
    'Previous Amount', 'Current Amount', 'Amount Difference', 'Status',
  ]
  const body = rows.map((row) => [
    dealer.name, billReference(previousBill), formatDate(previousBill.issuedDate), billReference(currentBill), formatDate(currentBill.issuedDate),
    row.name, row.category,
    row.previousPrice == null ? '' : formatMoney(row.previousPrice), row.currentPrice == null ? '' : formatMoney(row.currentPrice), row.priceDifference == null ? '' : formatMoney(row.priceDifference, { signed: true }),
    row.previousQuantityText || '', row.currentQuantityText || '', row.quantityDifference == null ? '' : formatQuantityDifference(row.quantityDifference, row.unit),
    row.previousAmount == null ? '' : formatMoney(row.previousAmount), row.currentAmount == null ? '' : formatMoney(row.currentAmount), row.amountDifference == null ? '' : formatMoney(row.amountDifference, { signed: true }), statusLabels(row).join('; '),
  ])
  const csv = [headers, ...body].map((record) => record.map(safeCsvCell).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `bill-comparison-${billReference(previousBill)}-${billReference(currentBill)}.csv`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function billTotals(bill) {
  if (!bill) return null
  const cents = billTotalCents(bill)
  let itemCount = 0
  for (const item of bill.items || []) if (item) itemCount += 1
  return { totalCents: cents, quantity: billQuantitySummary(bill), itemCount }
}

function MetricCard({ icon, label, value, note, tone = 'neutral' }) {
  return <article className={`bill-compare-metric bill-compare-metric-${tone}`}>
    <span className="bill-compare-metric-icon"><i className={`bi ${icon}`} aria-hidden="true" /></span>
    <div><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>
  </article>
}

function BillSelectCard({ label, bill, bills, value, onChange, disabledBillId, search, onSearch, side, loading }) {
  const filteredBills = bills.filter((entry) => {
    const query = search.trim().toLowerCase()
    return !query || `${billReference(entry)} ${formatDate(entry.issuedDate)} ${entry.total}`.toLowerCase().includes(query)
  })
  const totals = billTotals(bill)
  return <section className={`bill-pick-card bill-pick-card-${side}`}>
    <div className="bill-pick-card-heading"><span className="bill-pick-step">{side === 'previous' ? '01' : '02'}</span><div><span>{side === 'previous' ? 'BASELINE' : 'COMPARISON'}</span><h2>{label}</h2></div></div>
    <label className="bill-pick-search"><span>Find a bill</span><span className="bill-compare-searchbox"><i className="bi bi-search" aria-hidden="true" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search by reference or date" /></span></label>
    <label className="bill-pick-select"><span>Select bill</span><select value={value} disabled={loading || !bills.length} onChange={(event) => onChange(event.target.value)}><option value="">{loading ? 'Loading dealer bills…' : 'Choose a bill'}</option>{filteredBills.map((entry) => <option key={entry._id} value={entry._id} disabled={entry._id === disabledBillId}>{billReference(entry)} · {formatDate(entry.issuedDate)}</option>)}</select></label>
    {bill ? <div className="bill-pick-details">
      <div><span>Bill reference</span><strong>{billReference(bill)}</strong></div>
      <div><span>Bill date</span><strong>{formatDate(bill.issuedDate)}</strong></div>
      <div><span>Dealer</span><strong>{bill.dealer?.name || bill.dealerName || 'Selected dealer'}</strong></div>
      <div><span>Total</span><strong>{totals.totalCents == null ? 'Unavailable' : formatMoney(totals.totalCents)}</strong></div>
      <div><span>Total quantity</span><strong>{totals.quantity}</strong></div>
      <div><span>Items</span><strong>{totals.itemCount}</strong></div>
    </div> : <div className="bill-pick-placeholder"><i className="bi bi-receipt" aria-hidden="true" /><span>Select a bill to see its details.</span></div>}
  </section>
}

function getChangeTone(value) {
  if (value == null || value === 0n) return 'neutral'
  return value > 0n ? 'positive' : 'negative'
}

export default function BillComparison() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [dealerData, setDealerData] = useState(null)
  const [dealerError, setDealerError] = useState('')
  const [dealerRetry, setDealerRetry] = useState(0)
  const [dealerSearch, setDealerSearch] = useState('')
  const [dealerId, setDealerId] = useState(() => searchParams.get('dealer') || '')
  const [billState, setBillState] = useState({ dealerId: '', bills: [], error: '' })
  const [previousBillId, setPreviousBillId] = useState(() => searchParams.get('previousBill') || '')
  const [currentBillId, setCurrentBillId] = useState(() => searchParams.get('currentBill') || '')
  const [billRetry, setBillRetry] = useState(0)
  const [previousSearch, setPreviousSearch] = useState('')
  const [currentSearch, setCurrentSearch] = useState('')
  const [selectionError, setSelectionError] = useState('')
  const [compared, setCompared] = useState(() => Boolean(searchParams.get('dealer') && searchParams.get('previousBill') && searchParams.get('currentBill')))
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  useEffect(() => {
    let cancelled = false
    apiRequest('/dealers').then((result) => {
      if (cancelled) return
      setDealerData(result)
      setDealerError('')
    }).catch((error) => { if (!cancelled) setDealerError(error.message) })
    return () => { cancelled = true }
  }, [dealerRetry])

  useEffect(() => {
    if (!dealerId) return undefined
    let cancelled = false
    apiRequest(`/bills?dealer=${encodeURIComponent(dealerId)}`).then((result) => {
      if (!cancelled) setBillState({ dealerId, bills: result, error: '' })
    }).catch((error) => { if (!cancelled) setBillState({ dealerId, bills: [], error: error.message }) })
    return () => { cancelled = true }
  }, [dealerId, billRetry])

  const dealerLoading = dealerData === null && !dealerError
  const dealers = dealerData || []
  const visibleDealers = dealers.filter((dealer) => `${dealer.name} ${dealer.phone} ${dealer.location}`.toLowerCase().includes(dealerSearch.trim().toLowerCase()))
  const selectedDealer = dealers.find((dealer) => dealer._id === dealerId) || null
  const billsLoading = Boolean(dealerId) && billState.dealerId !== dealerId
  const dealerBills = billState.dealerId === dealerId ? billState.bills : []
  const billError = billState.dealerId === dealerId ? billState.error : ''
  const previousBill = dealerBills.find((bill) => bill._id === previousBillId) || null
  const currentBill = dealerBills.find((bill) => bill._id === currentBillId) || null
  const rows = useMemo(() => previousBill && currentBill ? buildProductComparisons(previousBill, currentBill) : [], [previousBill, currentBill])
  const previousTotal = billTotalCents(previousBill)
  const currentTotal = billTotalCents(currentBill)
  const totalDifference = previousTotal == null || currentTotal == null ? null : currentTotal - previousTotal
  const billQuantityDifference = compareBillQuantities(previousBill, currentBill)
  const previousQuantityValue = billTotals(previousBill)?.quantity || '—'
  const currentQuantityValue = billTotals(currentBill)?.quantity || '—'

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en')
    let result = rows.filter((row) => {
      const matchesSearch = !normalizedQuery || `${row.name} ${row.category}`.toLocaleLowerCase('en').includes(normalizedQuery)
      if (!matchesSearch) return false
      if (statusFilter === 'new') return row.isNew
      if (statusFilter === 'removed') return row.isRemoved
      if (statusFilter === 'price-increased') return row.priceStatus === 'increased'
      if (statusFilter === 'price-decreased') return row.priceStatus === 'decreased'
      if (statusFilter === 'price-unchanged') return row.priceStatus === 'unchanged'
      if (statusFilter === 'quantity-increased') return row.quantityStatus === 'increased'
      if (statusFilter === 'quantity-decreased') return row.quantityStatus === 'decreased'
      return true
    })
    result = [...result]
    if (sortBy === 'price-increase') result.sort((a, b) => (b.priceDifference ?? -1n) > (a.priceDifference ?? -1n) ? 1 : (b.priceDifference ?? -1n) < (a.priceDifference ?? -1n) ? -1 : a.name.localeCompare(b.name))
    else if (sortBy === 'price-decrease') result.sort((a, b) => (a.priceDifference ?? 1n) < (b.priceDifference ?? 1n) ? -1 : (a.priceDifference ?? 1n) > (b.priceDifference ?? 1n) ? 1 : a.name.localeCompare(b.name))
    else if (sortBy === 'quantity') result.sort((a, b) => {
      const left = a.quantityDifference == null ? -1n : (a.quantityDifference < 0n ? -a.quantityDifference : a.quantityDifference)
      const right = b.quantityDifference == null ? -1n : (b.quantityDifference < 0n ? -b.quantityDifference : b.quantityDifference)
      return right > left ? 1 : right < left ? -1 : a.name.localeCompare(b.name)
    })
    else if (sortBy === 'amount') result.sort((a, b) => {
      const left = a.amountDifference == null ? -1n : (a.amountDifference < 0n ? -a.amountDifference : a.amountDifference)
      const right = b.amountDifference == null ? -1n : (b.amountDifference < 0n ? -b.amountDifference : b.amountDifference)
      return right > left ? 1 : right < left ? -1 : a.name.localeCompare(b.name)
    })
    else result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    return result
  }, [rows, query, statusFilter, sortBy])

  const matchingRows = rows.filter((row) => row.previous && row.current)
  const newRows = rows.filter((row) => row.isNew)
  const removedRows = rows.filter((row) => row.isRemoved)
  const priceIncreases = rows.filter((row) => row.priceStatus === 'increased')
  const priceDecreases = rows.filter((row) => row.priceStatus === 'decreased')
  const priceUnchanged = rows.filter((row) => row.priceStatus === 'unchanged')
  const biggestPriceIncrease = [...priceIncreases].sort((a, b) => b.priceDifference > a.priceDifference ? 1 : b.priceDifference < a.priceDifference ? -1 : 0)[0]
  const biggestPriceDecrease = [...priceDecreases].sort((a, b) => a.priceDifference < b.priceDifference ? -1 : a.priceDifference > b.priceDifference ? 1 : 0)[0]
  const quantityChanges = rows.filter((row) => row.quantityDifference != null)
  const biggestQuantityChange = [...quantityChanges].sort((a, b) => {
    const left = a.quantityDifference < 0n ? -a.quantityDifference : a.quantityDifference
    const right = b.quantityDifference < 0n ? -b.quantityDifference : b.quantityDifference
    return right > left ? 1 : right < left ? -1 : 0
  })[0]
  const amountChanges = rows.filter((row) => row.amountDifference != null)
  const biggestAmountChange = [...amountChanges].sort((a, b) => {
    const left = a.amountDifference < 0n ? -a.amountDifference : a.amountDifference
    const right = b.amountDifference < 0n ? -b.amountDifference : b.amountDifference
    return right > left ? 1 : right < left ? -1 : 0
  })[0]
  const relation = billDateRelation(previousBill, currentBill)

  function selectDealer(nextDealerId) {
    if (nextDealerId === dealerId) return
    setDealerId(nextDealerId)
    setPreviousBillId('')
    setCurrentBillId('')
    setPreviousSearch('')
    setCurrentSearch('')
    setCompared(false)
    setSelectionError('')
  }

  function choosePrevious(nextId) {
    if (nextId && nextId === currentBillId) {
      setSelectionError('Choose two different bills. Your current selection was kept.')
      return
    }
    setPreviousBillId(nextId)
    setCompared(false)
    setSelectionError('')
  }

  function chooseCurrent(nextId) {
    if (nextId && nextId === previousBillId) {
      setSelectionError('Choose two different bills. Your previous selection was kept.')
      return
    }
    setCurrentBillId(nextId)
    setCompared(false)
    setSelectionError('')
  }

  function swapBills() {
    if (!previousBillId || !currentBillId) return
    setPreviousBillId(currentBillId)
    setCurrentBillId(previousBillId)
    setCompared(false)
    setSelectionError('')
  }

  function compareBills() {
    if (!dealerId) return setSelectionError('Select a dealer first.')
    if (!previousBillId || !currentBillId) return setSelectionError('Select both a previous bill and a current bill.')
    if (previousBillId === currentBillId) return setSelectionError('Choose two different bills to compare.')
    setSelectionError('')
    setSearchParams({ dealer: dealerId, previousBill: previousBillId, currentBill: currentBillId }, { replace: true })
    setCompared(true)
  }

  return <section className="boarder-box bill-comparison-page">
    <header className="bill-compare-page-header"><span className="bill-compare-eyebrow"><i className="bi bi-arrow-left-right" aria-hidden="true" /> PURCHASE ANALYSIS</span><h1 className="page-title">Bill Comparison</h1><p>Compare dealer bills to track changes in product prices, quantities and purchase values.</p></header>

    <section className="bill-compare-panel bill-dealer-selector">
      <div className="bill-compare-section-title"><span className="bill-compare-step-number">1</span><div><h2>Select a dealer</h2><p>Choose a dealer to load only their bills.</p></div></div>
      {dealerError ? <div className="bill-compare-error" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" />{dealerError}<button type="button" className="back-button" onClick={() => { setDealerError(''); setDealerData(null); setDealerRetry((count) => count + 1) }}>Retry</button></div> : <div className="bill-dealer-fields">
        <label><span>Search dealers</span><span className="bill-compare-searchbox"><i className="bi bi-search" aria-hidden="true" /><input value={dealerSearch} onChange={(event) => setDealerSearch(event.target.value)} placeholder="Type dealer name, phone or location" /></span></label>
        <label><span>Dealer</span><select value={dealerId} disabled={dealerLoading} onChange={(event) => selectDealer(event.target.value)}><option value="">{dealerLoading ? 'Loading dealers…' : 'Select a dealer'}</option>{visibleDealers.map((dealer) => <option key={dealer._id} value={dealer._id}>{dealer.name} · {dealer.phone}</option>)}</select></label>
      </div>}
      {selectedDealer && <div className="bill-dealer-selected"><span className="bill-dealer-avatar">{selectedDealer.profileImage ? <img src={selectedDealer.profileImage} alt="" /> : selectedDealer.name.slice(0, 2).toUpperCase()}</span><span><strong>{selectedDealer.name}</strong><small>{selectedDealer.category || 'Dealer'}{selectedDealer.location ? ` · ${selectedDealer.location}` : ''}</small></span><span className="bill-dealer-bill-count">{billsLoading ? 'Loading bills…' : `${dealerBills.length} ${dealerBills.length === 1 ? 'bill' : 'bills'}`}</span></div>}
      {billError && <div className="bill-compare-error" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" />{billError}<button type="button" className="back-button" onClick={() => setBillRetry((count) => count + 1)}>Retry</button></div>}
      {selectedDealer && !billsLoading && !billError && dealerBills.length === 0 && <div className="bill-compare-empty-inline"><i className="bi bi-receipt" aria-hidden="true" /><span><strong>No bills for this dealer</strong><small>Save a bill for this dealer before comparing.</small></span></div>}
      {selectedDealer && !billsLoading && dealerBills.length === 1 && <p className="bill-compare-info"><i className="bi bi-info-circle" aria-hidden="true" />This dealer has one bill. Select a second bill after one is added.</p>}
    </section>

    {selectedDealer && dealerBills.length > 0 && <>
      <div className="bill-compare-section-title bill-select-heading"><span className="bill-compare-step-number">2</span><div><h2>Choose two bills</h2><p>Set the baseline and comparison bills. The date labels help you see their order.</p></div></div>
      <div className="bill-pick-grid">
        <BillSelectCard label="Previous Bill" side="previous" bills={dealerBills} bill={previousBill} value={previousBillId} onChange={choosePrevious} disabledBillId={currentBillId} search={previousSearch} onSearch={setPreviousSearch} loading={billsLoading} />
        <BillSelectCard label="Current Bill" side="current" bills={dealerBills} bill={currentBill} value={currentBillId} onChange={chooseCurrent} disabledBillId={previousBillId} search={currentSearch} onSearch={setCurrentSearch} loading={billsLoading} />
      </div>
      {relation && <p className="bill-compare-date-relation"><i className="bi bi-calendar3" aria-hidden="true" />{relation}</p>}
      {selectionError && <p className="bill-compare-validation" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" />{selectionError}</p>}
      <div className="bill-compare-actions"><button type="button" className="back-button" onClick={swapBills} disabled={!previousBill || !currentBill}><i className="bi bi-arrow-down-up" aria-hidden="true" /> Swap bills</button><button type="button" className="continue-btn" onClick={compareBills} disabled={billsLoading || dealerBills.length < 2}><i className="bi bi-columns-gap" aria-hidden="true" /> Compare bills</button></div>
    </>}

    {compared && previousBill && currentBill && <>
      <section className="bill-comparison-results" aria-live="polite">
        <div className="bill-comparison-result-heading"><div><span className="bill-compare-eyebrow">COMPARISON RESULTS</span><h2>{selectedDealer?.name}: {billReference(previousBill)} vs {billReference(currentBill)}</h2><p>{formatDate(previousBill.issuedDate)} compared with {formatDate(currentBill.issuedDate)}{relation ? ` · ${relation.toLowerCase()}` : ''}</p></div><div className="bill-compare-export-actions"><button type="button" className="back-button" onClick={() => downloadComparisonCsv({ rows, dealer: selectedDealer, previousBill, currentBill })}><i className="bi bi-filetype-csv" aria-hidden="true" /> Export CSV</button><button type="button" className="continue-btn" onClick={() => window.print()}><i className="bi bi-printer" aria-hidden="true" /> Print report</button></div></div>
        <div className="bill-compare-metrics-grid">
          <MetricCard icon="bi-receipt" label="Previous Bill Total" value={formatMoney(previousTotal)} note={billReference(previousBill)} />
          <MetricCard icon="bi-receipt-cutoff" label="Current Bill Total" value={formatMoney(currentTotal)} note={billReference(currentBill)} />
          <MetricCard icon="bi-currency-rupee" label="Amount Difference" value={formatMoney(totalDifference, { signed: true })} note={`${formatPercent(percentChange(previousTotal, currentTotal))} change`} tone={getChangeTone(totalDifference)} />
          <MetricCard icon="bi-box-seam" label="Previous Total Quantity" value={previousQuantityValue} />
          <MetricCard icon="bi-boxes" label="Current Total Quantity" value={currentQuantityValue} />
          <MetricCard icon="bi-arrow-left-right" label="Quantity Difference" value={billQuantityDifference.text} note={billQuantityDifference.available ? 'Converted to compatible units' : 'Units must match to compare'} tone={billQuantityDifference.available ? 'neutral' : 'warning'} />
          <MetricCard icon="bi-graph-up-arrow" label="Price Increased" value={priceIncreases.length} tone="positive" />
          <MetricCard icon="bi-graph-down-arrow" label="Price Decreased" value={priceDecreases.length} tone="negative" />
          <MetricCard icon="bi-dash-circle" label="Price Unchanged" value={priceUnchanged.length} />
        </div>

        <section className="bill-compare-insights-panel"><div className="bill-compare-subheading"><div><h3>Comparison insights</h3><p>Largest changes across the selected bills.</p></div></div><div className="bill-compare-insights-grid">
          <InsightCard icon="bi-graph-up-arrow" label="Biggest price increase" row={biggestPriceIncrease} value={biggestPriceIncrease ? formatMoney(biggestPriceIncrease.priceDifference, { signed: true }) : 'No increase'} />
          <InsightCard icon="bi-graph-down-arrow" label="Biggest price decrease" row={biggestPriceDecrease} value={biggestPriceDecrease ? formatMoney(biggestPriceDecrease.priceDifference, { signed: true }) : 'No decrease'} />
          <InsightCard icon="bi-boxes" label="Biggest quantity change" row={biggestQuantityChange} value={biggestQuantityChange ? formatQuantityDifference(biggestQuantityChange.quantityDifference, biggestQuantityChange.unit) : 'Unavailable'} />
          <InsightCard icon="bi-cash-stack" label="Highest amount change" row={biggestAmountChange} value={biggestAmountChange ? formatMoney(biggestAmountChange.amountDifference, { signed: true }) : 'Unavailable'} />
          <InsightCard icon="bi-link-45deg" label="Matched products" value={matchingRows.length} />
          <InsightCard icon="bi-stars" label="New / removed products" value={`${newRows.length} new · ${removedRows.length} removed`} />
        </div></section>

        <section className="bill-compare-table-panel"><div className="bill-compare-subheading"><div><h3>Product comparison</h3><p>Changes in unit prices, quantities and line amounts.</p></div><span className="bill-compare-row-count">{filteredRows.length} of {rows.length} products</span></div>
          <div className="bill-compare-toolbar"><label className="bill-compare-product-search"><span>Search product</span><span className="bill-compare-searchbox"><i className="bi bi-search" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Product name or category" /></span></label><label><span>Filter</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All items</option><option value="price-increased">Price increased</option><option value="price-decreased">Price decreased</option><option value="price-unchanged">Price unchanged</option><option value="quantity-increased">Quantity increased</option><option value="quantity-decreased">Quantity decreased</option><option value="new">New items</option><option value="removed">Removed items</option></select></label><label><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="name">Product name A–Z</option><option value="price-increase">Highest price increase</option><option value="price-decrease">Highest price decrease</option><option value="quantity">Highest quantity difference</option><option value="amount">Highest amount difference</option></select></label><button type="button" className="bill-compare-clear" onClick={() => { setQuery(''); setStatusFilter('all'); setSortBy('name') }} disabled={!query && statusFilter === 'all' && sortBy === 'name'}>Reset</button></div>
          <div className="bill-compare-table-scroll"><table className="bill-compare-table responsive-card-table"><thead><tr><th>Product</th><th>Previous Price</th><th>Current Price</th><th>Price Difference</th><th>Previous Qty</th><th>Current Qty</th><th>Qty Difference</th><th>Previous Amount</th><th>Current Amount</th><th>Status</th></tr></thead><tbody>
            {filteredRows.map((row) => {
              const productParams = new URLSearchParams({ dealer: dealerId, previousBill: previousBillId, currentBill: currentBillId })
              return <tr key={row.identity}>
                <td data-label="Product"><Link className="bill-compare-product-link" to={`/bill-comparison/product/${row.key}?${productParams.toString()}`}><strong>{row.name}</strong><small>{row.category || 'Uncategorized'}</small></Link></td>
                <td data-label="Previous price">{row.isNew ? '—' : row.previousPrice == null ? <span className="bill-compare-unavailable" title="Price units are incompatible or the bill has incomplete values">N/A</span> : formatMoney(row.previousPrice)}{row.previousPrice != null && row.unit && <small className="bill-compare-unit">/ {row.unit}</small>}</td>
                <td data-label="Current price">{row.isRemoved ? '—' : row.currentPrice == null ? <span className="bill-compare-unavailable" title="Price units are incompatible or the bill has incomplete values">N/A</span> : formatMoney(row.currentPrice)}{row.currentPrice != null && row.unit && <small className="bill-compare-unit">/ {row.unit}</small>}</td>
                <td data-label="Price change" className={row.priceDifference == null ? '' : row.priceDifference > 0n ? 'bill-compare-value-positive' : row.priceDifference < 0n ? 'bill-compare-value-negative' : ''}>{row.priceDifference == null ? row.isNew || row.isRemoved ? '—' : 'N/A' : <>{formatMoney(row.priceDifference, { signed: true })}<small className="bill-compare-unit">{formatPercent(percentChange(row.previousPrice, row.currentPrice))}</small></>}</td>
                <td data-label="Previous qty">{row.isNew ? '—' : row.previousQuantityText || <span className="bill-compare-unavailable">N/A</span>}</td>
                <td data-label="Current qty">{row.isRemoved ? '—' : row.currentQuantityText || <span className="bill-compare-unavailable">N/A</span>}</td>
                <td data-label="Qty change" className={row.quantityDifference == null ? '' : row.quantityDifference > 0n ? 'bill-compare-value-positive' : row.quantityDifference < 0n ? 'bill-compare-value-negative' : ''}>{row.quantityDifference == null ? row.isNew || row.isRemoved ? '—' : <span className="bill-compare-unavailable" title="Only compatible units can be compared">N/A</span> : formatQuantityDifference(row.quantityDifference, row.unit)}</td>
                <td data-label="Previous amount">{row.isNew ? '—' : formatMoney(row.previousAmount)}</td><td data-label="Current amount">{row.isRemoved ? '—' : formatMoney(row.currentAmount)}</td>
                <td data-label="Status"><div className="bill-compare-statuses">{statusLabels(row).map((status) => <span className={`bill-compare-status bill-compare-status-${status.toLowerCase().replaceAll(' ', '-')}`} key={status}>{status}</span>)}</div></td>
              </tr>
            })}
            {!filteredRows.length && <tr><td colSpan="10"><div className="bill-compare-empty-table"><i className="bi bi-search" aria-hidden="true" /><strong>No products match these filters</strong><span>Try another search or reset the filters.</span></div></td></tr>}
          </tbody></table></div>
        </section>
      </section>

      <div className="bill-compare-print-report">
        <h1>Kani Metals</h1><h2>Bill Comparison Report</h2><p>Generated {new Date().toLocaleString('en-IN')}</p>
        <p><strong>Dealer:</strong> {selectedDealer?.name} · {selectedDealer?.phone}</p>
        <p><strong>Previous:</strong> {billReference(previousBill)} · {formatDate(previousBill.issuedDate)} · {formatMoney(previousTotal)}</p>
        <p><strong>Current:</strong> {billReference(currentBill)} · {formatDate(currentBill.issuedDate)} · {formatMoney(currentTotal)}</p>
        <p><strong>Summary:</strong> Amount difference {formatMoney(totalDifference, { signed: true })}; quantity difference {billQuantityDifference.text}; {priceIncreases.length} price increases, {priceDecreases.length} decreases, {priceUnchanged.length} unchanged.</p>
        <table><thead><tr><th>Product</th><th>Previous price</th><th>Current price</th><th>Price diff</th><th>Previous qty</th><th>Current qty</th><th>Qty diff</th><th>Previous amount</th><th>Current amount</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.identity}><td>{row.name} ({row.category})</td><td>{row.isNew ? '—' : formatMoney(row.previousPrice)}</td><td>{row.isRemoved ? '—' : formatMoney(row.currentPrice)}</td><td>{row.priceDifference == null ? 'N/A' : formatMoney(row.priceDifference, { signed: true })}</td><td>{row.isNew ? '—' : row.previousQuantityText || 'N/A'}</td><td>{row.isRemoved ? '—' : row.currentQuantityText || 'N/A'}</td><td>{row.quantityDifference == null ? 'N/A' : formatQuantityDifference(row.quantityDifference, row.unit)}</td><td>{row.isNew ? '—' : formatMoney(row.previousAmount)}</td><td>{row.isRemoved ? '—' : formatMoney(row.currentAmount)}</td><td>{statusLabels(row).join(', ')}</td></tr>)}</tbody></table>
      </div>
    </>}
  </section>
}

function InsightCard({ icon, label, row, value }) {
  return <article className="bill-compare-insight-card"><span><i className={`bi ${icon}`} aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong>{row && <em>{row.name}</em>}</div></article>
}
