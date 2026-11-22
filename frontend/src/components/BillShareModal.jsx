import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { billMessage, billNumber, oldestFirst, formatPaise, renderBillImage, statusText, whatsappNumber } from '../utils/billImage.js'
import { printReceipt, receiptData } from '../utils/posReceipt.js'

const shortDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Preview and send a dealer bill on WhatsApp: the bill image (template layout) with
 * total, paid (advance/partial) and balance due. The text summary is sent only with "Send as text".
 */
export default function BillShareModal({ dealerId, billId, onClose }) {
  const { business, billTemplate, pos } = useAppSettings()
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')
  const [image, setImage] = useState(null)
  const [phone, setPhone] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  // Whether the dealer's unpaid amounts from earlier bills are added to this bill.
  const [includeOld, setIncludeOld] = useState(false)
  // Whether every other unpaid bill (any date) is added with its particulars, in its own section.
  const [includeAll, setIncludeAll] = useState(false)

  useEffect(() => {
    let active = true
    apiRequest(`/payments/dealers/${encodeURIComponent(dealerId)}`)
      .then((result) => {
        if (!active) return
        setDetails(result)
        setPhone(result.dealer.phone || '')
      })
      .catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false }
  }, [dealerId])

  const data = useMemo(() => {
    if (!details) return null
    const row = details.bills.find((entry) => String(entry.bill._id) === String(billId))
    if (!row) return null
    return { business, dealer: details.dealer, bill: row.bill, state: row, payments: details.payments }
  }, [details, billId, business])

  // Other bills of the same day, saved before this one, that still have money to pay. Bills of older days are left out.
  const oldBalance = useMemo(() => {
    if (!details || !data) return null
    const day = new Date(data.bill.issuedDate).toDateString()
    const isEarlier = (other) => new Date(other.issuedDate).toDateString() === day && oldestFirst('issuedDate')(other, data.bill) < 0
    const bills = details.bills
      .filter((row) => row.pendingPaise > 0 && String(row.bill._id) !== String(billId) && isEarlier(row.bill))
      .sort((a, b) => oldestFirst('issuedDate')(a.bill, b.bill))
      .map((row) => ({ bill: row.bill, pendingPaise: row.pendingPaise }))
    return bills.length ? { bills, totalPaise: bills.reduce((sum, row) => sum + row.pendingPaise, 0) } : null
  }, [details, data, billId])
  // Every other bill of this dealer with money still due (any date), oldest first, with its items.
  const pendingBills = useMemo(() => {
    if (!details || !data) return null
    const bills = details.bills
      .filter((row) => row.pendingPaise > 0 && String(row.bill._id) !== String(billId))
      .sort((a, b) => oldestFirst('issuedDate')(a.bill, b.bill))
      .map((row) => ({ bill: row.bill, totalPaise: row.totalPaise, receivedPaise: row.receivedPaise, pendingPaise: row.pendingPaise }))
    return bills.length ? { bills, totalPaise: bills.reduce((sum, row) => sum + row.pendingPaise, 0) } : null
  }, [details, data, billId])
  const sendData = useMemo(() => (data ? { ...data, oldBalance: includeOld && !includeAll ? oldBalance : null, pendingBills: includeAll ? pendingBills : null } : null), [data, includeOld, includeAll, oldBalance, pendingBills])
  // Same-day bills add to this bill's balance; all pending bills turn the bill into a statement.
  const extra = !includeAll && includeOld && oldBalance ? oldBalance : null
  const statementRows = includeAll && pendingBills && data
    ? [...pendingBills.bills, { bill: data.bill, totalPaise: data.state.totalPaise, receivedPaise: data.state.receivedPaise, pendingPaise: data.state.pendingPaise, current: true }].sort((a, b) => oldestFirst('issuedDate')(a.bill, b.bill))
    : null
  function toggle(setter, other) {
    return (event) => { setter(event.target.checked); if (event.target.checked) other(false); setImage(null); setNotice('') }
  }

  useEffect(() => {
    if (!sendData) return undefined
    let active = true
    let url = ''
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#B96C35'
    renderBillImage({ ...sendData, accent, template: billTemplate })
      .then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [sendData, billTemplate])

  const missingBill = details && !data
  const fileName = data ? `${billNumber(data.bill)}.png` : 'bill.png'
  const message = sendData ? billMessage(sendData) : ''
  const number = whatsappNumber(phone)
  const chatUrl = `https://wa.me/${number}`

  /** Prints this bill on the POS (thermal) printer, using Settings → Bill details → POS printing. */
  async function printPos() {
    const receipt = receiptData(details, billId)
    if (!receipt) return
    setNotice('')
    try { await printReceipt({ ...receipt, business }, pos) }
    catch (issue) { setError(issue.message) }
  }

  /** Opens the dealer's chat; with `withText` the bill summary is typed in for you. */
  function openChat(withText = false) {
    const url = withText ? `${chatUrl}?text=${encodeURIComponent(message)}` : chatUrl
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function shareOnWhatsApp() {
    if (!image || !data) return
    setBusy(true); setNotice('')
    try {
      const file = new File([image.blob], fileName, { type: 'image/png' })
      // Phones (and some desktops) can send the image itself straight to WhatsApp.
      // Only the file is shared: adding text makes WhatsApp send the text instead of (or apart from) the image.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        setNotice('Bill image shared.')
        return
      }
      // Otherwise save the image and open the dealer's WhatsApp chat, with no text typed in.
      downloadBlob(image.blob, fileName)
      openChat()
      setNotice('The bill image was downloaded. Attach it in the WhatsApp chat that just opened.')
    } catch (issue) {
      if (issue?.name !== 'AbortError') setError(issue.message || 'Could not share the bill.')
    } finally { setBusy(false) }
  }

  return (
    <Modal className="dealer-delete-dialog bill-share-dialog" busy={busy} onClose={onClose} labelledBy="bill-share-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow"><i className="bi bi-whatsapp" aria-hidden="true" /> SEND BILL</span><h2 id="bill-share-title">Send bill on WhatsApp</h2></div>
        <button type="button" className="payment-close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {error && <p className="api-error" role="alert">{error}</p>}
      {missingBill && <p className="api-error" role="alert">This bill could not be found for the dealer.</p>}
      {!error && !missingBill && <>
        <div className="bill-share-preview">
          {image ? <img src={image.url} alt={`Bill ${data ? billNumber(data.bill) : ''} preview`} /> : <div className="skeleton bill-share-skeleton" aria-label="Preparing bill image" />}
        </div>
        {data && statementRows && <dl className="bill-share-summary is-statement">
          {statementRows.map((row, index) => <div key={row.bill._id}><dt>Bill {index + 1}{row.current ? ' (this bill)' : ''} · {shortDate(row.bill.issuedDate)}<span className="bill-share-bill-no">{billNumber(row.bill)}</span></dt><dd className={row.pendingPaise ? 'is-due' : 'is-paid'}>{formatPaise(row.pendingPaise)}</dd></div>)}
          <div><dt>All bills total</dt><dd>{formatPaise(statementRows.reduce((sum, row) => sum + row.totalPaise, 0))}</dd></div>
          <div><dt>Total received</dt><dd className="is-paid">{formatPaise(statementRows.reduce((sum, row) => sum + row.receivedPaise, 0))}</dd></div>
          <div><dt>Total amount due</dt><dd className="is-due"><strong>{formatPaise(statementRows.reduce((sum, row) => sum + row.pendingPaise, 0))}</strong></dd></div>
        </dl>}
        {data && !statementRows && <dl className="bill-share-summary">
          <div><dt>Total</dt><dd>{formatPaise(data.state.totalPaise)}</dd></div>
          {data.state.receivedPaise > 0 && <div><dt>Paid (advance / partial)</dt><dd className="is-paid">{formatPaise(data.state.receivedPaise)}</dd></div>}
          {data.state.receivedPaise > 0 && !extra && <div><dt>Balance due</dt><dd className={data.state.pendingPaise ? 'is-due' : 'is-paid'}>{formatPaise(data.state.pendingPaise)}</dd></div>}
          <div><dt>Status</dt><dd>{statusText(data.state)}</dd></div>
          {extra && <>
            {extra.bills.map((row) => <div key={row.bill._id}><dt>{shortDate(row.bill.issuedDate)}<span className="bill-share-bill-no">{billNumber(row.bill)}</span></dt><dd className="is-due">{formatPaise(row.pendingPaise)}</dd></div>)}
            <div><dt>Total amount due</dt><dd className="is-due"><strong>{formatPaise(data.state.pendingPaise + extra.totalPaise)}</strong></dd></div>
          </>}
        </dl>}
        {pendingBills && <label className={`bill-share-old${includeAll ? ' is-on' : ''}`}>
          <span className="bill-share-old-text">
            <strong>Add all pending bills</strong>
            <small>{formatPaise(pendingBills.totalPaise)} unpaid from {pendingBills.bills.length} other {pendingBills.bills.length === 1 ? 'bill' : 'bills'}. {includeAll ? 'The bill becomes a statement: each bill with its items, received and balance (oldest first, this bill last), then the grand total.' : 'Not shown on the bill.'}</small>
          </span>
          <span className={`feature-switch${includeAll ? ' is-on' : ''}`}>
            <input type="checkbox" role="switch" checked={includeAll} onChange={toggle(setIncludeAll, setIncludeOld)} aria-label="Add all pending bills to the bill" />
            <span className="feature-switch-track" aria-hidden="true"><span /></span>
          </span>
        </label>}
        {oldBalance && <label className={`bill-share-old${includeOld ? ' is-on' : ''}`}>
          <span className="bill-share-old-text">
            <strong>Add today's other bills</strong>
            <small>{formatPaise(oldBalance.totalPaise)} unpaid from {oldBalance.bills.length} other {oldBalance.bills.length === 1 ? 'bill' : 'bills'} of the same day. {includeOld ? 'Shown on the bill with bill number, date and the total amount due.' : 'Not shown on the bill.'}</small>
          </span>
          <span className={`feature-switch${includeOld ? ' is-on' : ''}`}>
            <input type="checkbox" role="switch" checked={includeOld} onChange={toggle(setIncludeOld, setIncludeAll)} aria-label="Add today's other bills to the bill" />
            <span className="feature-switch-track" aria-hidden="true"><span /></span>
          </span>
        </label>}
        <label className="bill-share-phone">Dealer WhatsApp number
          <input className="form-control" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" />
          <small>{number ? `Opens chat with +${number}` : 'Enter a valid number, or WhatsApp will ask you to pick a contact.'}</small>
        </label>
        {notice && <p className="bill-share-notice" role="status"><i className="bi bi-info-circle" aria-hidden="true" /> {notice}</p>}
        <div className="bill-share-actions">
          <button type="button" className="continue-btn whatsapp-btn" onClick={shareOnWhatsApp} disabled={!image || busy}><i className="bi bi-whatsapp" aria-hidden="true" /> Share bill on WhatsApp</button>
          <button type="button" className="back-button" onClick={() => openChat(true)} disabled={!data}><i className="bi bi-chat-text" aria-hidden="true" /> Send as text</button>
          <button type="button" className="back-button" onClick={() => image && downloadBlob(image.blob, fileName)} disabled={!image}><i className="bi bi-download" aria-hidden="true" /> Download image</button>
          <button type="button" className="back-button" onClick={printPos} disabled={!data}><i className="bi bi-printer" aria-hidden="true" /> Print (POS)</button>
        </div>
      </>}
    </Modal>
  )
}
