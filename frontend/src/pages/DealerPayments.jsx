import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { decimalToCents } from '../utils/billComparison.js'
import { localDateInputValue } from '../utils/format.js'
import Modal from '../components/Modal.jsx'
import BillShareModal from '../components/BillShareModal.jsx'

const methodLabels = { gpay: 'GPay', phonepe: 'PhonePe', paytm: 'Paytm', upi_other: 'UPI (Other)', net_banking: 'Net Banking', cheque: 'Cheque', bank_deposit: 'Bank Deposit', cash: 'Cash', other: 'Other', advance: 'From advance' }
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
  return message ? createPortal(<div className={`app-toast app-toast-${type}`} role="status" aria-live="polite"><i className={`bi ${type === 'danger' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} aria-hidden="true" />{message}</div>, document.body) : null
}

function SummaryCard({ icon, label, value, tone = '' }) {
  return <article className={`payment-summary-card ${tone}`}><span><i className={`bi ${icon}`} aria-hidden="true" /></span><div><small>{label}</small><strong>{value}</strong></div></article>
}

function PaymentProgress({ total, paid }) {
  const percent = total > 0 ? Math.min(100, paid / total * 100) : 0
  return <section className="payment-progress-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">PAYMENT OVERVIEW</span><h2>Received and pending</h2></div><span className="payment-percent">{percent.toFixed(1)}% received</span></div><div className="payment-progress-track" role="img" aria-label={`${percent.toFixed(1)} percent received`}><span style={{ width: `${percent}%` }} /></div><div className="payment-progress-legend"><span><i className="payment-dot received-dot" />Received <strong>{money(paid)}</strong></span><span><i className="payment-dot pending-dot" />Pending <strong>{money(Math.max(0, total - paid))}</strong></span></div></section>
}

function PaymentModal({ dealers, initialDealer, initialBill, onClose, onSaved, notify }) {
  const [dealerId, setDealerId] = useState(initialDealer || '')
  const [billId, setBillId] = useState(initialBill || '')
  const [billData, setBillData] = useState({ dealerId: '', bills: [] })
  const [method, setMethod] = useState('gpay')
  // No default: when a payment is more than the balance, the user must pick round-off or advance.
  const [extraHandling, setExtraHandling] = useState('')
  const [form, setForm] = useState(() => ({ amount: '', paymentDate: localDateInputValue(), reference: '', notes: '', bankName: '', chequeDate: '' }))
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
  const advancePaise = chosenDealer?.dealer.advancePaise || 0
  const fromAdvance = method === 'advance'
  const pendingPaise = bill ? state?.pendingPaise ?? Number(decimalToCents(bill.total) || 0n) : null
  const enteredPaise = /^\d+(\.\d{1,2})?$/.test(form.amount) ? Math.round(Number(form.amount) * 100) : 0
  // Paying more than the balance is allowed; the extra becomes the dealer's advance.
  const extraPaise = pendingPaise !== null && !fromAdvance ? Math.max(0, enteredPaise - pendingPaise) : 0
  const advanceLimitPaise = pendingPaise !== null ? Math.min(advancePaise, pendingPaise) : advancePaise

  function chooseMethod(next) {
    setMethod(next)
    if (next === 'advance' && advanceLimitPaise > 0) setForm((current) => ({ ...current, amount: (advanceLimitPaise / 100).toFixed(2) }))
  }

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    if (extraPaise > 0 && !extraHandling) { setError('Choose Round off or Make it advance for the extra amount.'); return }
    setBusy(true); setError('')
    try {
      const result = await apiRequest('/payments', { method: 'POST', body: JSON.stringify({ dealer: dealerId, bill: billId, amount: form.amount, paymentMethod: method, extraHandling, transactionReference: form.reference, paymentDate: form.paymentDate, notes: form.notes, methodDetails: { bankName: form.bankName, chequeDate: form.chequeDate } }) })
      notify(result.message || 'Payment recorded successfully.', 'success')
      await onSaved(); onClose()
    } catch (issue) { setError(issue.message) } finally { setBusy(false) }
  }
  const needsReference = ['gpay', 'phonepe', 'paytm', 'upi_other', 'net_banking', 'cheque', 'bank_deposit'].includes(method)
  const referenceLabel = method === 'cheque' ? 'Cheque number' : method === 'bank_deposit' ? 'Deposit reference number' : method === 'cash' ? 'Receipt number (optional)' : 'Transaction ID / UTR (optional)'
  return <Modal className="payment-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={onClose} labelledBy="payment-modal-title"><div className="payment-modal-heading"><div><span className="payment-eyebrow">NEW PAYMENT</span><h2 id="payment-modal-title">Record a payment</h2></div><button type="button" className="payment-close" aria-label="Close dialog" onClick={onClose}>×</button></div><form onSubmit={submit} className="payment-form">
    <label>Dealer<select required value={dealerId} onChange={(event) => { setDealerId(event.target.value); setBillId(''); setError('') }}><option value="">Choose a dealer</option>{dealers.map(({ dealer }) => <option key={dealer._id} value={dealer._id}>{dealer.name} · {dealer.phone}</option>)}</select></label>
    <label>Bill<select required disabled={!dealerId} value={billId} onChange={(event) => setBillId(event.target.value)}><option value="">Choose a bill</option>{bills.map((row) => { const summary = chosenDealer?.bills.find((entry) => entry._id === row._id); return <option key={row._id} value={row._id}>{billRef(row)} · Pending {money(summary?.pendingPaise ?? Math.round(row.total * 100))}</option> })}</select></label>
    {bill && <div className="payment-bill-preview"><span>Bill amount<strong>{money(Number(decimalToCents(bill.total) || 0n))}</strong></span><span>Already received<strong>{money(state?.receivedPaise || 0)}</strong></span><span>Remaining balance<strong>{money(pendingPaise)}</strong></span></div>}
    {advancePaise > 0 && <p className="payment-advance-note"><i className="bi bi-piggy-bank" aria-hidden="true" /> This dealer has <strong>{money(advancePaise)}</strong> advance (extra paid earlier). Choose <strong>From advance</strong> to use it on this bill.</p>}
    <div className="payment-form-grid"><label>Payment amount (₹)<input required type="number" min="0.01" step="0.01" max={fromAdvance ? (advanceLimitPaise / 100).toFixed(2) : undefined} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Payment date<input required type="date" value={form.paymentDate} onChange={(event) => setForm({ ...form, paymentDate: event.target.value })} /></label></div>
    {extraPaise > 0 && <fieldset className="payment-extra-choice">
      <legend><i className="bi bi-info-circle-fill" aria-hidden="true" /> This is <strong>{money(extraPaise)} more</strong> than the balance. The bill will be marked paid. What should happen to the extra {money(extraPaise)}?{method === 'cheque' ? ' (Applied when the cheque clears.)' : ''}</legend>
      <label className={`payment-extra-option${extraHandling === 'roundoff' ? ' is-selected' : ''}`}>
        <input type="radio" name="extraHandling" value="roundoff" checked={extraHandling === 'roundoff'} onChange={() => setExtraHandling('roundoff')} required />
        <i className="bi bi-scissors" aria-hidden="true" />
        <span><strong>Round off</strong><small>Ignore the extra. Nothing is carried forward.</small></span>
      </label>
      <label className={`payment-extra-option${extraHandling === 'advance' ? ' is-selected' : ''}`}>
        <input type="radio" name="extraHandling" value="advance" checked={extraHandling === 'advance'} onChange={() => setExtraHandling('advance')} />
        <i className="bi bi-piggy-bank" aria-hidden="true" />
        <span><strong>Make it advance</strong><small>Keep {money(extraPaise)} for {chosenDealer?.dealer.name || 'this dealer'} and use it on their next bill.</small></span>
      </label>
    </fieldset>}
    <label>Payment method<select required value={method} onChange={(event) => chooseMethod(event.target.value)}>{Object.entries(methodLabels).filter(([key]) => key !== 'advance' || advancePaise > 0).map(([key, label]) => <option value={key} key={key}>{key === 'advance' ? `${label} (${money(advancePaise)} available)` : label}</option>)}</select></label>
    {needsReference && <label>{referenceLabel}<input required={['cheque', 'bank_deposit'].includes(method)} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder={method === 'cheque' ? 'Cheque number' : 'Enter reference if available'} /></label>}
    {['cheque', 'bank_deposit'].includes(method) && <label>Bank name<input required value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} /></label>}
    {method === 'cheque' && <label>Cheque date<input required type="date" value={form.chequeDate} onChange={(event) => setForm({ ...form, chequeDate: event.target.value })} /></label>}
    <label>Notes (optional)<textarea rows="2" maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    {method === 'cheque' && <p className="payment-cheque-help"><i className="bi bi-info-circle" /> Unpaid cheques are recorded as pending and will not reduce the balance until cleared.</p>}
    {error && <p className="payment-form-error" role="alert">{error}</p>}<div className="payment-modal-actions"><button type="button" className="back-button" disabled={busy} onClick={onClose}>Cancel</button><button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button></div>
  </form></Modal>
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
  const [modal, setModal] = useState(false)
  const [reverseTarget, setReverseTarget] = useState(null)
  const [reverseReason, setReverseReason] = useState('')
  const [sharingBillId, setSharingBillId] = useState(null)
  const [toast, setToast] = useState({ message: '', type: 'success' })
  const [toastVisible, setToastVisible] = useState(false)
  const notify = useCallback((message, type = 'success') => { setToast({ message, type }); setToastVisible(true) }, [])
  // Stable callback: an inline arrow here restarted the toast's auto-hide timer on every re-render.
  const hideToast = useCallback(() => setToastVisible(false), [])
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
  // The list shows only who each dealer is; amounts and history open on the dealer's own page.
  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase()
    return dealerRows
      .filter((row) => !search || `${row.dealer.name} ${row.dealer.phone} ${row.dealer.location || ''}`.toLowerCase().includes(search))
      .filter((row) => statusFilter === 'all' || (statusFilter === 'pending' ? row.pendingPaise > 0 : row.pendingPaise === 0))
      .sort((a, b) => a.dealer.name.localeCompare(b.dealer.name))
  }, [dealerRows, query, statusFilter])
  const pendingCount = dealerRows.filter((row) => row.pendingPaise > 0).length

  async function changeCheque(payment, status) {
    try { const result = await apiRequest(`/payments/${payment._id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); notify(result.message || (status === 'cleared' ? 'Cheque cleared and added to received total.' : 'Cheque marked as bounced.'), status === 'cleared' ? 'success' : 'danger'); await refresh() }
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
  const isBillView = Boolean(dealerId && selectedBillId && detailBill)
  const totalPaise = details?.summary.totalPaise || 0
  const receivedPaise = details?.summary.receivedPaise || 0

  return <section className="boarder-box dealer-payment-page">
    {toastVisible && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    {error && <div className="payment-error" role="alert"><i className="bi bi-exclamation-circle" />{error}<button type="button" className="back-button" onClick={refresh}>Retry</button></div>}
    {!dealerId ? <>
      <header className="payment-page-heading"><div><span className="payment-eyebrow"><i className="bi bi-wallet2" /> KANI METALS · ACCOUNTS</span><h1>Dealer Payments</h1><p>Choose a dealer to see and record their payments.</p></div><button type="button" className="continue-btn" onClick={() => setModal(true)}><i className="bi bi-plus-lg" /> Record Payment</button></header>
      {!overview && !error ? <div className="dealer-pick-grid">{Array.from({ length: 6 }, (_, index) => <div className="payment-skeleton dealer-pick-skeleton" key={index} />)}</div> : overview && <section className="dealer-pick-panel">
        <div className="dealer-pick-toolbar">
          <label className="dealer-pick-search"><i className="bi bi-search" aria-hidden="true" /><span className="visually-hidden">Search dealer</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, phone or place" /></label>
          <div className="dealer-pick-chips" role="radiogroup" aria-label="Show dealers">
            {[['all', `All (${dealerRows.length})`], ['pending', `Balance due (${pendingCount})`], ['clear', `No balance (${dealerRows.length - pendingCount})`]].map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={statusFilter === id} className={`dealer-pick-chip${statusFilter === id ? ' is-active' : ''}`} onClick={() => setStatusFilter(id)}>{label}</button>)}
          </div>
        </div>
        <p className="dealer-pick-hint"><i className="bi bi-hand-index" aria-hidden="true" /> Tap a dealer to see their bills, payments and balance.</p>
        {filteredRows.length ? <ul className="dealer-pick-grid">{filteredRows.map(({ dealer, pendingPaise, billCount, advancePaise }) => <li key={dealer._id}>
          <Link className="dealer-pick-card" to={`/dealer-payments/${dealer._id}`}>
            <span className="payment-avatar dealer-pick-avatar">{dealer.profileImage ? <img src={dealer.profileImage} alt="" loading="lazy" /> : dealer.name.slice(0, 2).toUpperCase()}</span>
            <span className="dealer-pick-text">
              <strong>{dealer.name}</strong>
              <small><i className="bi bi-telephone" aria-hidden="true" /> {dealer.phone}{dealer.location ? <> · <i className="bi bi-geo-alt" aria-hidden="true" /> {dealer.location}</> : null}</small>
            </span>
            <span className={`dealer-pick-status${pendingPaise > 0 ? ' is-due' : billCount ? ' is-clear' : ''}`}>{pendingPaise > 0 ? 'Balance due' : billCount ? 'Settled' : 'No bills'}</span>
            {advancePaise > 0 && <span className="dealer-pick-status is-advance" title="Extra paid, used on the next bill">Advance</span>}
            <i className="bi bi-chevron-right dealer-pick-chevron" aria-hidden="true" />
          </Link>
        </li>)}</ul> : <div className="payment-empty-state"><i className="bi bi-person-lines-fill" /><strong>No dealers match</strong><span>Try another name or phone number.</span></div>}
      </section>}
    </> : <>
      {!details && !error ? <div className="payment-loading-grid"><div className="payment-skeleton" /><div className="payment-skeleton" /></div> : details && <>
        <nav className="payment-breadcrumbs"><Link to="/dashboard">Dashboard</Link><i className="bi bi-chevron-right" /><Link to="/dealer-payments">Dealer Payments</Link><i className="bi bi-chevron-right" /><span>{details.dealer.name}</span>{isBillView && <><i className="bi bi-chevron-right" /><strong>{billRef(detailBill.bill)}</strong></>}</nav>
        <header className="payment-page-heading"><div><span className="payment-eyebrow">DEALER PAYMENT ACCOUNT</span><h1>{isBillView ? `Bill ${billRef(detailBill.bill)}` : details.dealer.name}</h1><p>{details.dealer.phone}{details.dealer.location ? ` · ${details.dealer.location}` : ''}</p></div><button type="button" className="continue-btn" onClick={() => setModal(true)}><i className="bi bi-plus-lg" /> Record Payment</button></header>
        {details.summary.advancePaise > 0 && <p className="payment-advance-banner"><i className="bi bi-piggy-bank" aria-hidden="true" /> <span><strong>{money(details.summary.advancePaise)} advance</strong> — extra paid earlier. It will be used automatically on this dealer's next bill, or choose <strong>From advance</strong> when recording a payment.</span></p>}
        <div className="payment-summary-grid payment-detail-summary"><SummaryCard icon="bi-receipt" label={isBillView ? 'Bill amount' : 'Total bill amount'} value={money(isBillView ? detailBill.totalPaise : totalPaise)} /><SummaryCard icon="bi-cash-stack" label="Amount received" value={money(isBillView ? detailBill.receivedPaise : receivedPaise)} tone="received" /><SummaryCard icon="bi-hourglass-split" label="Balance pending" value={money(isBillView ? detailBill.pendingPaise : details.summary.pendingPaise)} tone="pending" /><SummaryCard icon="bi-calendar-check" label="Last payment" value={dateLabel(details.summary.lastPaymentDate)} /><SummaryCard icon="bi-receipt-cutoff" label="Pending bills" value={details.summary.pendingBills} tone="pending" /></div>
        {!isBillView && <PaymentProgress total={totalPaise} paid={receivedPaise} />}
        {isBillView ? <>
          <PaymentProgress total={detailBill.totalPaise} paid={detailBill.receivedPaise} />
          <section className="payment-table-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">BILL HISTORY</span><h2>Payments for this bill</h2></div><div className="payment-heading-actions"><button type="button" className="whatsapp-inline-btn" onClick={() => setSharingBillId(selectedBillId)}><i className="bi bi-whatsapp" aria-hidden="true" /> Send bill</button><button type="button" className="back-button" onClick={() => setSearchParams({})}><i className="bi bi-arrow-left" /> All bills</button></div></div><div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference / Notes</th><th>Status</th><th>Action</th></tr></thead><tbody>{billPayments.map((payment) => <PaymentHistoryRow key={payment._id} payment={payment} showBill={false} onCheque={changeCheque} onReverse={() => { setReverseTarget(payment); setReverseReason('') }} />)}{!billPayments.length && <tr><td colSpan="6"><div className="payment-empty-state">No payments have been recorded for this bill.</div></td></tr>}</tbody></table></div></section>
        </> : <>
          <section className="payment-followup-card"><div><span className="payment-eyebrow">FOLLOW UP</span><h2>{money(details.summary.pendingPaise)} outstanding</h2><p>{details.summary.pendingBills} pending bills{details.summary.oldestUnpaidBill ? ` · Oldest: ${billRef(details.summary.oldestUnpaidBill)} (${dateLabel(details.summary.oldestUnpaidBill.issuedDate)})` : ''}</p></div><button className="back-button" type="button" onClick={copyReminder}><i className="bi bi-whatsapp" /> Copy payment reminder</button></section>
          <section className="payment-table-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">BILL-WISE SUMMARY</span><h2>Dealer bills</h2></div></div><div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Bill number</th><th>Bill date</th><th>Bill amount</th><th>Received</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{details.bills.map((row) => <tr key={row.bill._id}><td><Link className="payment-bill-link" to={`/dealer-payments/${dealerId}?bill=${row.bill._id}`}>{billRef(row.bill)}</Link></td><td>{dateLabel(row.bill.issuedDate)}</td><td>{money(row.totalPaise)}</td><td className="payment-text-received">{money(row.receivedPaise)}</td><td className={row.pendingPaise ? 'payment-text-pending' : 'payment-text-received'}>{money(row.pendingPaise)}</td><td><PaymentStatusBadge status={row.status} /></td><td><div className="payment-bill-actions"><Link className="payment-view-action" to={`/dealer-payments/${dealerId}?bill=${row.bill._id}`}>Payment history <i className="bi bi-arrow-right" /></Link><button type="button" className="whatsapp-icon-btn" onClick={() => setSharingBillId(row.bill._id)} aria-label={`Send ${billRef(row.bill)} on WhatsApp`} title="Send on WhatsApp"><i className="bi bi-whatsapp" aria-hidden="true" /></button></div></td></tr>)}{!details.bills.length && <tr><td colSpan="7"><div className="payment-empty-state"><strong>No bills for this dealer yet</strong><span>Record a bill before payments can be tracked.</span></div></td></tr>}</tbody></table></div></section>
          <section className="payment-table-card"><div className="payment-section-heading"><div><span className="payment-eyebrow">ACCOUNT HISTORY</span><h2>Payment history</h2></div></div><div className="payment-table-wrap"><table className="payment-table"><thead><tr><th>Payment date</th><th>Bill</th><th>Amount</th><th>Method</th><th>Reference / Notes</th><th>Status</th><th>Action</th></tr></thead><tbody>{details.payments.map((payment) => <PaymentHistoryRow key={payment._id} payment={payment} onCheque={changeCheque} onReverse={() => { setReverseTarget(payment); setReverseReason('') }} />)}{!details.payments.length && <tr><td colSpan="7"><div className="payment-empty-state">No payments recorded yet.</div></td></tr>}</tbody></table></div></section>
        </>}
      </>}
    </>}
    {modal && <PaymentModal dealers={dealerRows.length ? dealerRows : details ? [{ dealer: details.dealer, bills: details.bills.map((row) => ({ ...row.bill, ...row })) }] : []} initialDealer={dealerId} initialBill={selectedBillId} onClose={() => setModal(false)} onSaved={refresh} notify={notify} />}
    {sharingBillId && dealerId && <BillShareModal dealerId={dealerId} billId={sharingBillId} onClose={() => setSharingBillId(null)} />}
    {reverseTarget && <Modal role="alertdialog" className="payment-modal payment-reverse-modal" backdropClassName="payment-modal-backdrop" busy={busy} onClose={() => setReverseTarget(null)} labelledBy="reverse-payment-title"><div className="payment-modal-heading"><div><span className="payment-eyebrow">CORRECTION</span><h2 id="reverse-payment-title">Reverse payment?</h2></div></div><p>Reversing keeps the original payment in the account history and adjusts the bill balance. This action cannot be undone.</p><label>Reason for correction<textarea rows="3" value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} minLength="5" maxLength="500" placeholder="For example: payment entered against the wrong bill" /></label><div className="payment-modal-actions"><button className="back-button" type="button" disabled={busy} onClick={() => setReverseTarget(null)}>Cancel</button><button className="confirm-delete-btn" type="button" disabled={busy || reverseReason.trim().length < 5} onClick={reversePayment}>{busy ? 'Reversing…' : 'Reverse payment'}</button></div></Modal>}
  </section>
}

function PaymentHistoryRow({ payment, onCheque, onReverse, showBill = true }) {
  const methodDetail = [payment.methodDetails?.bankName, payment.methodDetails?.chequeDate ? `Cheque date: ${dateLabel(payment.methodDetails.chequeDate)}` : ''].filter(Boolean).join(' · ')
  const billId = payment.bill?._id || payment.bill
  const dealerId = payment.dealer?._id || payment.dealer
  return <tr><td data-label="Date">{dateLabel(payment.paymentDate)}</td>{showBill && <td data-label="Bill">{billId ? <Link className="payment-bill-link" to={`/dealer-payments/${dealerId}?bill=${billId}`}>{payment.bill?.issuedDate ? billRef(payment.bill) : String(billId).slice(-6).toUpperCase()}</Link> : <span className="text-muted">Deleted bill</span>}</td>}<td data-label="Amount"><strong>{money(payment.amountPaise)}</strong>{payment.excessPaise > 0 && <small className="payment-excess-note">{money(payment.amountPaise - payment.excessPaise)} to bill · {money(payment.excessPaise)} {payment.excessType === 'roundoff' ? 'rounded off' : 'kept as advance'}</small>}</td><td data-label="Method">{methodLabels[payment.paymentMethod] || payment.paymentMethod}</td><td data-label="Reference"><span>{payment.transactionReference || '—'}</span>{payment.notes && <small>{payment.notes}</small>}{methodDetail && <small>{methodDetail}</small>}</td><td data-label="Status"><PaymentStatusBadge status={payment.paymentStatus} /></td><td className="payment-row-actions" data-label="Actions">{payment.paymentMethod === 'cheque' && payment.paymentStatus === 'pending' && <><button type="button" onClick={() => onCheque(payment, 'cleared')}>Clear</button><button type="button" className="payment-bounce-btn" onClick={() => onCheque(payment, 'bounced')}>Bounced</button></>}{payment.paymentStatus !== 'reversed' && <button type="button" className="payment-reverse-btn" onClick={onReverse}>Reverse</button>}</td></tr>
}
