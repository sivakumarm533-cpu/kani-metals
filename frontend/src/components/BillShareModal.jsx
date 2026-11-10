import { useEffect, useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { apiRequest } from '../services/api.js'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { billMessage, billNumber, formatPaise, renderBillImage, statusText, whatsappNumber } from '../utils/billImage.js'

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
  const { business, billTemplate } = useAppSettings()
  const [details, setDetails] = useState(null)
  const [error, setError] = useState('')
  const [image, setImage] = useState(null)
  const [phone, setPhone] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

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

  useEffect(() => {
    if (!data) return undefined
    let active = true
    let url = ''
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#B96C35'
    renderBillImage({ ...data, accent, template: billTemplate })
      .then((blob) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      })
      .catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [data, billTemplate])

  const missingBill = details && !data
  const fileName = data ? `${billNumber(data.bill)}.png` : 'bill.png'
  const message = data ? billMessage(data) : ''
  const number = whatsappNumber(phone)
  const chatUrl = `https://wa.me/${number}`

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
        {data && <dl className="bill-share-summary">
          <div><dt>Total</dt><dd>{formatPaise(data.state.totalPaise)}</dd></div>
          <div><dt>Paid (advance / partial)</dt><dd className="is-paid">{formatPaise(data.state.receivedPaise)}</dd></div>
          <div><dt>Balance due</dt><dd className={data.state.pendingPaise ? 'is-due' : 'is-paid'}>{formatPaise(data.state.pendingPaise)}</dd></div>
          <div><dt>Status</dt><dd>{statusText(data.state)}</dd></div>
        </dl>}
        <label className="bill-share-phone">Dealer WhatsApp number
          <input className="form-control" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" />
          <small>{number ? `Opens chat with +${number}` : 'Enter a valid number, or WhatsApp will ask you to pick a contact.'}</small>
        </label>
        {notice && <p className="bill-share-notice" role="status"><i className="bi bi-info-circle" aria-hidden="true" /> {notice}</p>}
        <div className="bill-share-actions">
          <button type="button" className="continue-btn whatsapp-btn" onClick={shareOnWhatsApp} disabled={!image || busy}><i className="bi bi-whatsapp" aria-hidden="true" /> Share bill on WhatsApp</button>
          <button type="button" className="back-button" onClick={() => openChat(true)} disabled={!data}><i className="bi bi-chat-text" aria-hidden="true" /> Send as text</button>
          <button type="button" className="back-button" onClick={() => image && downloadBlob(image.blob, fileName)} disabled={!image}><i className="bi bi-download" aria-hidden="true" /> Download image</button>
        </div>
      </>}
    </Modal>
  )
}
