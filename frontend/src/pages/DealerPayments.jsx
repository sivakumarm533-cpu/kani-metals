import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { decimalToCents } from '../utils/billComparison.js'
import './pages.css'

const methodLabels = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', upi_other: 'UPI (Other)', net_banking: 'Net Banking', cheque: 'Cheque', bank_deposit: 'Bank Deposit', cash: 'Cash', other: 'Other' }
const received = (payment) => ['received', 'cleared'].includes(payment.paymentStatus)
const money = (paise = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(paise) / 100)
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const billRef = (bill) => `BILL-${new Date(bill.issuedDate).toISOString().slice(0, 10).replaceAll('-', '')}-${String(bill._id).slice(-6).toUpperCase()}`
const statusLabel = (status) => ({ 'no-bills': 'NO BILLS', paid: 'PAID', partial: 'PARTIAL', unpaid: 'UNPAID', pending: 'CHEQUE PENDING', cleared: 'CLEARED', bounced: 'BOUNCED', reversed: 'REVERSED', received: 'RECEIVED' }[status] || status?.toUpperCase() || '—')

function Toast({ message, type, onClose }) {
  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(onClose, 3400)
    return () => window.clearTimeout(timeout)
  }, [message, onClose])
  return message ? <div className={`app-toast app-toast-${type}`} role="status"><i className={`bi ${type === 'danger' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} aria-hidden="true" />{message}</div> : null
}

function SummaryCard({ icon, label, value, tone = '' }) {
  return <article className={`payment-summary-card ${tone}`}><span><i className={`bi ${icon}`} aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function PaymentProgress({ total, paid }) {
  const percent = total > 0 ? Math.min(100, paid / total * 100) : 0
  return <section className="payment-progress-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">PAYMENT OVERVIEW</span><h2>Received and pending</h2></div><span className="payment-percent">{percent.toFixed(1)}% received</span></div><div className="payment-progress-track" role="img" aria-label={`${percent.toFixed(1)} percent received`}><span style={{ width: `${percent}%` }} /></div><div className="payment-progress-legend"><span><i className="payment-dot received-dot" />Received <strong>{money(paid)}</strong></span><span><i className="payment-dot pending-dot" />Pending <strong>{money(Math.max(0, total - paid))}</strong></span></div></section>
}

function MonthlyChart({ months }) {
  const max = Math.max(1, ...months.flatMap((month) => [month.billedPaise, month.receivedPaise, month.pendingPaise]))
  return <section className="payment-chart-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">MONTHLY</span><h2>Bills and payments</h2></div></div><div className="payment-chart-legend"><span><i className="billed-dot" />Billed</span><span><i className="received-dot" />Received</span><span><i className="pending-dot" />Pending</span></div><div className="payment-month-chart">{months.map((month) => <div className="payment-month-column" key={month.month} title={`${month.label}: billed ${money(month.billedPaise)}, received ${money(month.receivedPaise)}, pending ${money(month.pendingPaise)}`}><div className="payment-month-bars"><span className="billed-bar" style={{ height: `${Math.max(month.billedPaise ? 3 : 0, month.billedPaise / max * 140)}px` }} /><span className="received-bar" style={{ height: `${Math.max(month.receivedPaise ? 3 : 0, month.receivedPaise / max * 140)}px` }} /><span className="pending-bar" style={{ height: `${Math.max(month.pendingPaise ? 3 : 0, month.pendingPaise / max * 140)}px` }} /></div><small>{month.label}</small></div>)}</div></section>
}

function MethodChart({ methods, total }) {
  const rows = [...methods].sort((a, b) => b.amountPaise - a.amountPaise)
  return <section className="payment-chart-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">RECEIVED BY METHOD</span><h2>Payment methods</h2></div></div>{rows.length ? <div className="payment-method-list">{rows.map((row) => <div className="payment-method-row" key={row.method}><div><strong>{methodLabels[row.method] || row.method}</strong><span>{total ? `${(row.amountPaise / total * 100).toFixed(1)}%` : '0%'}</span></div><div className="payment-method-track"><span style={{ width: `${total ? row.amountPaise / total * 100 : 0}%` }} /></div><b>{money(row.amountPaise)}</b></div>)}</div> : <p className="payment-empty-note">Cleared and received payments will appear here.</p>}</section>
}

function PaymentModal({ dealers, initialDealer, initialBill, onClose, onSaved, notify }) {
  const [dealerId, setDealerId] = useState(initialDealer || '')
  const [billId, setBillId] = useState(initialBill || '')
  const [billData, setBillData] = useState({ dealerId: '', bills: [] })
  const [method, setMethod] = useState('gpay')
  const [form, setForm] = useState({ amount: '', paymentDate: new Date().toISOString().slice(0, 10), reference: '', notes: '', bankName: '', chequeDate: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!dealerId) return undefined
    let active = true
    apiRequest(`/bills?dealer=${encodeURIComponent(dealerId)}`).then((rows) => { if (active) setBillData({ dealerId, bills: rows || [] }) }).catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false }
  }, [dealerId])
  const bills = billData.dealerId === dealerId ? billData.bills : []
  const bill = bills.find((row) => row._id === billId)
  const chosenDealer = dealers.find((row) => row.dealer._id === dealerId)
  const state = chosenDealer?.bills.find((row) => row._id === billId)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await apiRequest('/payments', { method: 'POST', body: JSON.stringify({ dealer: dealerId, bill: billId, amount: form.amount, paymentMethod: method, transactionReference: form.reference, paymentDate: form.paymentDate, notes: form.notes, methodDetails: { bankName: form.bankName, chequeDate: form.chequeDate } }) })
      notify(method === 'cheque' ? 'Cheque recorded. It will count after clearing.' : 'Payment recorded successfully.', 'success')
      await onSaved(); onClose()
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }
  const needsReference = ['gpay', 'phonepe', 'paytm', 'upi_other', 'net_banking', 'cheque', 'bank_deposit'].includes(method)
  const referenceLabel = method === 'cheque' ? 'Cheque number' : method === 'bank_deposit' ? 'Deposit reference number' : method === 'cash' ? 'Receipt number (optional)' : 'Transaction ID / UTR (optional)'
  return <div className="dealer-delete-backdrop payment-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}><section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"><div className="payment-modal-heading"><div><span className="payment-eyebrow">NEW PAYMENT</span><h2 id="payment-modal-title">Record a payment</h2></div><button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button></div><form onSubmit={submit} className="payment-form">
    <label>Dealer<select required value={dealerId} onChange={(event) => { setDealerId(event.target.value); setBillId(''); setError('') }}><option value="">Choose a dealer</option>{dealers.map(({ dealer }) => <option key={dealer._id} value={dealer._id}>{dealer.name} · {dealer.phone}</option>)}</select></label>
    <label>Bill<select required disabled={!dealerId} value={billId} onChange={(event) => setBillId(event.target.value)}><option value="">Choose a bill</option>{bills.map((row) => { const summary = chosenDealer?.bills.find((entry) => entry._id === row._id); return <option key={row._id} value={row._id}>{billRef(row)} · Pending {money(summary?.pendingPaise ?? Math.round(row.total * 100))}</option> })}</select></label>
    {bill && <div className="payment-bill-preview"><span>Bill amount<strong>{money(Number(decimalToCents(bill.total) || 0n))}</strong></span><span>Already received<strong>{money(state?.receivedPaise || 0)}</strong></span><span>Remaining balance<strong>{money(state?.pendingPaise ?? Number(decimalToCents(bill.total) || 0n))}</strong></span></div>}
    <div className="payment-form-grid"><label>Payment amount (₹)<input required type="number" min="0.01" step="0.01" max={state ? (state.pendingPaise / 100).toFixed(2) : undefined} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Payment date<input required type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></label></div>
    <label>Payment method<select required value={method} onChange={(event) => setMethod(event.target.value)}>{Object.entries(methodLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
    {needsReference && <label>{referenceLabel}<input required={['cheque', 'bank_deposit'].includes(method)} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder={method === 'cheque' ? 'Cheque number' : 'Enter reference if available'} /></label>}
    {['cheque', 'bank_deposit'].includes(method) && <label>Bank name<input required value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label>}
    {method === 'cheque' && <label>Cheque date<input required type="date" value={form.chequeDate} onChange={(event) => setForm({ ...form, chequeDate: event.target.value })} /></label>}
    <label>Notes (optional)<textarea rows="2" maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    {method === 'cheque' && <p className="payment-cheque-help"><i className="bi bi-info-circle" /> Unpaid cheques are recorded as pending and will not reduce the balance until cleared.</p>}
    {error && <p className="payment-form-error" role="alert">{error}</p>}<div className="payment-modal-actions"><button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button><button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button></div>
  </form></section></div>
}

function PaymentStatusBadge({ status }) { return <span className={`payment-status-badge status-${status}`}>{statusLabel(status)}</span> }

export default function DealerPayments() {
  const { dealerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [overview, setOverview] = useState(null)
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('pending')
  const [modal, setModal] = useState(false)
  const [reverseTarget, setReverseTarget] = useState(null)
  const [reverseReason, setReverseReason] = useState('')
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [toastVisible, setToastVisible] = useState(false)
  const notify = useCallback((message, type = 'success') => { setToast({ message, type }); setToastVisible(true) }, [])
  const selectedBillId = searchParams.get('bill') || ''
  const refresh = useCallback(async () => {
    try {
      if (dealerId) {
        const result = await apiRequest(`/payments/dealers/${encodeURIComponent(dealerId)}`)
        setDetails(result)
        setError('')
      } else {
        const result = await apiRequest('/payments/overview')
        setOverview(result)
        setError('')
      }
    } catch (issue) { setError(issue.message) }
  }, [dealerId])
  useEffect(() => {
    let active = true
    const endpoint = dealerId ? `/payments/dealers/${encodeURIComponent(dealerId)}` : '/payments/overview'
    apiRequest(endpoint).then((result) => {
      if (!active) return
      if (dealerId) setDetails(result)
      else setOverview(result)
      setError('')
    }).catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false }
  }, [dealerId])
  const dealerRows = useMemo(() => overview?.dealers || [], [overview])
  const detailBill = details?.bills.find((row) => String(row.bill._id) === selectedBillId) || null
  const billPayments = details?.payments.filter((payment) => !selectedBillId || String(payment.bill?._id || payment.bill) === selectedBillId) || []
  const filteredRows = useMemo(() => {
    const filteredPaymentRows = (overview?.payments || []).filter((payment) => {
      const date = new Date(payment.paymentDate)
      return (!from || date >= new Date(`${from}T00:00:00`)) && (!to || date <= new Date(`${to}T23:59:59.999`)) && (!methodFilter || payment.paymentMethod === methodFilter)
    })
    const activityByDealer = new Map()
    for (const payment of filteredPaymentRows) {
      const id = String(payment.dealer)
      activityByDealer.set(id, (activityByDealer.get(id) || 0) + 1)
    }
    const search = query.trim().toLowerCase()
    let rows = dealerRows.filter((row) => {
      if (search && !`${row.dealer.name} ${row.dealer.phone} ${row.dealer.location}`.toLowerCase().includes(search)) return false
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if ((from || to || methodFilter) && !activityByDealer.has(String(row.dealer._id))) return row.billCount === 0 && statusFilter === 'unpaid'
      return true
    }).map((row) => ({ ...row, filteredReceivedPaise: filteredPaymentRows.filter((payment) => String(payment.dealer) === String(row.dealer._id) && received(payment)).reduce((sum, payment) => sum + payment.amountPaise, 0) }))
    rows = [...rows]
    rows.sort((a, b) => sort === 'received' ? b.receivedPaise - a.receivedPaise : sort === 'name' ? a.dealer.name.localeCompare(b.dealer.name) : b.pendingPaise - a.pendingPaise)
    return rows
  }, [overview, dealerRows, from, to, methodFilter, query, statusFilter, sort])

  async function changeCheque(payment, status) {
    try { await apiRequest(`/payments/${payment._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); notify(status === 'cleared' ? 'Cheque cleared and added to received total.' : 'Cheque marked as bounced.', status === 'cleared' ? 'success' : 'danger'); await refresh() }
    catch (issue) { notify(issue.message, 'danger') }
  }
  async function reversePayment() {
    if (!reverseTarget) return
    setBusy(true)
    try { await apiRequest(`/payments/${reverseTarget._id}/reverse`, { method: 'POST', body: JSON.stringify({ reason: reverseReason }) }); notify('Payment reversed and retained in the history.', 'success'); setReverseTarget(null); setReverseReason(''); await refresh() }
    catch (issue) { notify(issue.message, 'danger') } finally { setBusy(false) }
  }
  async function copyReminder() {
    const pending = (details?.bills || []).filter((row) => row.pendingPaise > 0)
    const text = `Hello ${details?.dealer.name || 'Dealer'}, this is a payment reminder from Kani Metals. Your outstanding balance is ${money(details?.summary.pendingPaise)} across ${pending.map((row) => billRef(row.bill)).join(', ') || 'your pending bills'}. Please let us know when payment can be arranged. Thank you.`
    try { await navigator.clipboard.writeText(text); notify('Payment reminder copied. You can paste it into WhatsApp.', 'success') } catch { notify('Could not copy the reminder. Please check browser clipboard permission.', 'danger') }
  }
  function resetFilters() { setQuery(''); setStatusFilter('all'); setMethodFilter(''); setFrom(''); setTo(''); setSort('pending') }
  const isBillView = Boolean(dealerId && selectedBillId && detailBill)
  const totalPaise = details?.summary.totalPaise || 0
  const receivedPaise = details?.summary.receivedPaise || 0
  const summary = overview?.summary

  return <section className="boarder-box dealer-payment-page">
    {toastVisible && <Toast message={toast.message} type={toast.type} onClose={() => setToastVisible(false)} />}
    {error && <div className="payment-error" role="alert"><i className="bi bi-exclamation-circle" />{error}<button type="button" className="back-button" onClick={refresh}>Retry</button></div>}
    {!dealerId ? <>
      <header className="payment-page-heading"><div><span className="payment-eyebrow"><i className="bi bi-wallet2" /> KANI METALS · ACCOUNTS</span><h1>Dealer Payment Tracking</h1><p>Track dealer bills, payments received and outstanding balances.</p></div><button type="button" className="continue-btn" onClick={() => setModal(true)}><i className="bi bi-plus-lg" /> Record Payment</button></header>
      {!overview && !error ? <div className="payment-loading-grid">{Array.from({ length: 5 }, (_, index) => <div className="payment-skeleton" key={index} />)}</div> : overview && <>
        <div className="payment-summary-grid"><SummaryCard icon="bi-receipt" label="Total bill amount" value={money(summary.totalBillPaise)} /><SummaryCard icon="bi-cash-stack" label="Amount received" value={money(summary.totalReceivedPaise)} tone="received" /><SummaryCard icon="bi-hourglass-split" label="Balance pending" value={money(summary.pendingPaise)} tone="pending" /><SummaryCard icon="bi-calendar-check" label="Received today" value={money(summary.todayReceivedPaise)} tone="received" /><SummaryCard icon="bi-people" label="Dealers with pending bills" value={summary.pendingDealerCount} tone="pending" /></div>
        <PaymentProgress total={summary.totalBillPaise} paid={summary.totalReceivedPaise} />
        <div className="payment-charts-grid"><MonthlyChart months={overview.months} /><MethodChart methods={overview.methods} total={summary.totalReceivedPaise} /></div>
        <section className="payment-table-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">DEALER ACCOUNTS</span><h2>Payment overview</h2></div><span className="payment-result-count">{filteredRows.length} dealers</span></div>
          <div className="payment-filters"><label><span>Search dealer</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or phone number" /></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option><option value="no-bills">No bills</option></select></label><label><span>Payment method</span><select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)}><option value="">All methods</option>{Object.entries(methodLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span>Payment from</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><span>Payment to</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label><span>Sort by</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="pending">Highest pending</option><option value="received">Highest received</option><option value="name">Dealer name</option></select></label><button type="button" className="back-button" onClick={resetFilters}>Reset</button></div>
          <div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Dealer</th><th>Total bills</th><th>Total amount</th><th>Received</th><th>Pending</th><th>Status</th><th>Action</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.dealer._id}><td><Link to={`/dealer-payments/${row.dealer._id}`} className="payment-dealer-link"><span className="payment-avatar">{row.dealer.profileImage ? <img src={row.dealer.profileImage} alt="" /> : row.dealer.name.slice(0, 2).toUpperCase()}</span><span><strong>{row.dealer.name}</strong><small>{row.dealer.phone}</small></span></Link></td><td>{row.billCount}</td><td>{money(row.totalPaise)}</td><td><strong className="payment-text-received">{money(row.receivedPaise)}</strong>{(from || to || methodFilter) && <small className="payment-filtered-value">Filtered: {money(row.filteredReceivedPaise)}</small>}</td><td><strong className={row.pendingPaise ? 'payment-text-pending' : 'payment-text-received'}>{money(row.pendingPaise)}</strong></td><td><PaymentStatusBadge status={row.status} /></td><td><Link className="payment-view-action" to={`/dealer-payments/${row.dealer._id}`}>View details <i className="bi bi-arrow-right" /></Link></td></tr>)}{!filteredRows.length && <tr><td colSpan="7"><div className="payment-empty-state"><i className="bi bi-person-lines-fill" /><strong>No dealer payment records match</strong><span>Change the filters or add a dealer bill.</span></div></td></tr>}</tbody></table></div>
        </section>
      </>}
    </> : <>
      {!details && !error ? <div className="payment-loading-grid"><div className="payment-skeleton" /><div className="payment-skeleton" /></div> : details && <>
        <nav className="payment-breadcrumbs"><Link to="/dashboard">Dashboard</Link><i className="bi bi-chevron-right" /><Link to="/dealer-payments">Dealer Payments</Link><i className="bi bi-chevron-right" /><span>{details.dealer.name}</span>{isBillView && <><i className="bi bi-chevron-right" /><strong>{billRef(detailBill.bill)}</strong></>}</nav>
        <header className="payment-page-heading"><div><span className="payment-eyebrow">DEALER PAYMENT ACCOUNT</span><h1>{isBillView ? `Bill ${billRef(detailBill.bill)}` : details.dealer.name}</h1><p>{details.dealer.phone}{details.dealer.location ? ` · ${details.dealer.location}` : ''}</p></div><button type="button" className="continue-btn" onClick={() => setModal(true)}><i className="bi bi-plus-lg" /> Record Payment</button></header>
        <div className="payment-summary-grid payment-detail-summary"><SummaryCard icon="bi-receipt" label={isBillView ? 'Bill amount' : 'Total bill amount'} value={money(isBillView ? detailBill.totalPaise : totalPaise)} /><SummaryCard icon="bi-cash-stack" label="Amount received" value={money(isBillView ? detailBill.receivedPaise : receivedPaise)} tone="received" /><SummaryCard icon="bi-hourglass-split" label="Balance pending" value={money(isBillView ? detailBill.pendingPaise : details.summary.pendingPaise)} tone="pending" /><SummaryCard icon="bi-calendar-check" label="Last payment" value={dateLabel(details.summary.lastPaymentDate)} /><SummaryCard icon="bi-receipt-cutoff" label="Pending bills" value={details.summary.pendingBills} tone="pending" /></div>
        {!isBillView && <PaymentProgress total={totalPaise} paid={receivedPaise} />}
        {isBillView ? <>
          <PaymentProgress total={detailBill.totalPaise} paid={detailBill.receivedPaise} />
          <section className="payment-table-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">BILL HISTORY</span><h2>Payments for this bill</h2></div><button type="button" className="back-button" onClick={() => setSearchParams({})}><i className="bi bi-arrow-left" /> All bills</button></div><div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference / Notes</th><th>Status</th><th>Action</th></tr></thead><tbody>{billPayments.map((payment) => <PaymentHistoryRow key={payment._id} payment={payment} onCheque={changeCheque} onReverse={() => { setReverseTarget(payment); setReverseReason('') }} />)}{!billPayments.length && <tr><td colSpan="6"><div className="payment-empty-state">No payments have been recorded for this bill.</div></td></tr>}</tbody></table></div></section>
        </> : <>
          <section className="payment-followup-card"><div><span className="payment-eyebrow">FOLLOW UP</span><h2>{money(details.summary.pendingPaise)} outstanding</h2><p>{details.summary.pendingBills} pending bills{details.summary.oldestUnpaidBill ? ` · Oldest: ${billRef(details.summary.oldestUnpaidBill)} (${dateLabel(details.summary.oldestUnpaidBill.issuedDate)})` : ''}</p></div><button className="back-button" type="button" onClick={copyReminder}><i className="bi bi-whatsapp" /> Copy payment reminder</button></section>
          <section className="payment-table-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">BILL-WISE SUMMARY</span><h2>Dealer bills</h2></div></div><div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Bill number</th><th>Bill date</th><th>Bill amount</th><th>Received</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{details.bills.map((row) => <tr key={row.bill._id}><td><Link className="payment-bill-link" to={`/dealer-payments/${dealerId}?bill=${row.bill._id}`}>{billRef(row.bill)}</Link></td><td>{dateLabel(row.bill.issuedDate)}</td><td>{money(row.totalPaise)}</td><td className="payment-text-received">{money(row.receivedPaise)}</td><td className={row.pendingPaise ? 'payment-text-pending' : 'payment-text-received'}>{money(row.pendingPaise)}</td><td><PaymentStatusBadge status={row.status} /></td><td><Link className="payment-view-action" to={`/dealer-payments/${dealerId}?bill=${row.bill._id}`}>Payment history <i className="bi bi-arrow-right" /></Link></td></tr>)}{!details.bills.length && <tr><td colSpan="7"><div className="payment-empty-state"><strong>No bills for this dealer yet</strong><span>Record a bill before payments can be tracked.</span></div></td></tr>}</tbody></table></div></section>
          <section className="payment-table-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">ACCOUNT HISTORY</span><h2>Payment history</h2></div></div><div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Payment date</th><th>Bill</th><th>Amount</th><th>Method</th><th>Reference / Notes</th><th>Status</th><th>Action</th></tr></thead><tbody>{details.payments.map((payment) => <PaymentHistoryRow key={payment._id} payment={payment} onCheque={changeCheque} onReverse={() => { setReverseTarget(payment); setReverseReason('') }} />)}{!details.payments.length && <tr><td colSpan="7"><div className="payment-empty-state">No payments recorded yet.</div></td></tr>}</tbody></table></div></section>
        </>}
      </>}
    </>}
    {modal && <PaymentModal dealers={dealerRows.length ? dealerRows : details ? [{ dealer: details.dealer, bills: details.bills.map((row) => ({ ...row.bill, ...row })) }] : []} initialDealer={dealerId} initialBill={selectedBillId} onClose={() => setModal(false)} onSaved={refresh} notify={notify} />}
    {reverseTarget && <div className="dealer-delete-backdrop payment-modal-backdrop" role="presentation"><section className="payment-modal payment-reverse-modal" role="alertdialog" aria-modal="true" aria-labelledby="reverse-payment-title"><div className="payment-modal-heading"><div><span className="payment-eyebrow">CORRECTION</span><h2 id="reverse-payment-title">Reverse payment?</h2></div></div><p>Reversing keeps the original payment in the account history and adjusts the bill balance. This action cannot be undone.</p><label>Reason for correction<textarea rows="3" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} minLength="5" maxLength="500" placeholder="For example: payment entered against the wrong bill" /></label><div className="payment-modal-actions"><button className="back-button" type="button" disabled={busy} onClick={() => setReverseTarget(null)}>Cancel</button><button className="confirm-delete-btn" type="button" disabled={busy || reverseReason.trim().length < 5} onClick={reversePayment}>{busy ? 'Reversing…' : 'Reverse payment'}</button></div></section></div>}
  </section>
}

function PaymentHistoryRow({ payment, onCheque, onReverse }) {
  const methodDetail = [payment.methodDetails?.bankName, payment.methodDetails?.chequeDate ? `Cheque date: ${dateLabel(payment.methodDetails.chequeDate)}` : ''].filter(Boolean).join(' · ')
  const billId = payment.bill?._id || payment.bill
  const dealerId = payment.dealer?._id || payment.dealer
  return <tr><td>{dateLabel(payment.paymentDate)}</td><td><Link className="payment-bill-link" to={`/dealer-payments/${dealerId}?bill=${billId}`}>{payment.bill?.issuedDate ? billRef(payment.bill) : String(billId).slice(-6).toUpperCase()}</Link></td><td><strong>{money(payment.amountPaise)}</strong></td><td>{methodLabels[payment.paymentMethod] || payment.paymentMethod}</td><td><span>{payment.transactionReference || '—'}</span>{payment.notes && <small>{payment.notes}</small>}{methodDetail && <small>{methodDetail}</small>}</td><td><PaymentStatusBadge status={payment.paymentStatus} /></td><td className="payment-row-actions">{payment.paymentMethod === 'cheque' && payment.paymentStatus === 'pending' && <><button type="button" onClick={() => onCheque(payment, 'cleared')}>Clear</button><button type="button" className="payment-bounce-btn" onClick={() => onCheque(payment, 'bounced')}>Bounced</button></>}{payment.paymentStatus !== 'reversed' && <button type="button" className="payment-reverse-btn" onClick={onReverse}>Reverse</button>}</td></tr>
}
