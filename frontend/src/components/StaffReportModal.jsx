import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { useAppSettings } from '../settings/appSettingsContext.js'
import { whatsappNumber } from '../utils/billImage.js'
import { renderStaffReport, staffReportMessage } from '../utils/staffReportImage.js'

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

/** Preview the employee's report as an image and send it on WhatsApp, save it, or send it as text. */
export default function StaffReportModal({ data, onClose }) {
  const { business } = useAppSettings()
  const [image, setImage] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [phone, setPhone] = useState(data.employee.phone || '')

  useEffect(() => {
    let active = true
    let url = ''
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
    renderStaffReport({ data, business, accent })
      .then((blob) => { if (!active) return; url = URL.createObjectURL(blob); setImage({ blob, url }) })
      .catch((issue) => { if (active) setError(issue.message) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [data, business])

  const safeName = data.employee.name.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'employee'
  const fileName = `${safeName}-report-${data.month}.png`
  const number = whatsappNumber(phone)
  const chatUrl = `https://wa.me/${number}`

  function openChat(withText = false) {
    const url = withText ? `${chatUrl}?text=${encodeURIComponent(staffReportMessage({ data, business }))}` : chatUrl
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function shareOnWhatsApp() {
    if (!image) return
    setBusy(true); setNotice('')
    try {
      const file = new File([image.blob], fileName, { type: 'image/png' })
      // Phones can hand the image straight to WhatsApp through the share sheet.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        setNotice('Report image shared.')
        return
      }
      // Otherwise save the image and open the chat so it can be attached.
      downloadBlob(image.blob, fileName)
      openChat()
      setNotice('The report image was saved. Attach it in the WhatsApp chat that just opened.')
    } catch (issue) {
      if (issue?.name !== 'AbortError') setError(issue.message || 'Could not share the report.')
    } finally { setBusy(false) }
  }

  function save() {
    if (!image) return
    downloadBlob(image.blob, fileName)
    setNotice('Report image saved to your downloads.')
  }

  return (
    <Modal className="dealer-delete-dialog bill-share-dialog" busy={busy} onClose={onClose} labelledBy="staff-report-title">
      <div className="payment-modal-heading">
        <div><span className="payment-eyebrow"><i className="bi bi-whatsapp" aria-hidden="true" /> SEND REPORT</span><h2 id="staff-report-title">{data.employee.name}'s report</h2></div>
        <button type="button" className="payment-close" aria-label="Close" onClick={onClose}>×</button>
      </div>
      {error && <p className="api-error" role="alert">{error}</p>}
      {!error && <>
        <div className="bill-share-preview">
          {image ? <img src={image.url} alt={`Report of ${data.employee.name}`} /> : <div className="skeleton bill-share-skeleton" aria-label="Preparing report image" />}
        </div>
        <label className="bill-share-phone">WhatsApp number
          <input className="form-control" type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile number" />
          <small>{number ? `Opens chat with +${number}` : 'Enter a valid number, or WhatsApp will ask you to pick a contact.'}</small>
        </label>
        {notice && <p className="bill-share-notice" role="status"><i className="bi bi-info-circle" aria-hidden="true" /> {notice}</p>}
        <div className="bill-share-actions">
          <button type="button" className="continue-btn whatsapp-btn" onClick={shareOnWhatsApp} disabled={!image || busy}><i className="bi bi-whatsapp" aria-hidden="true" /> Share on WhatsApp</button>
          <button type="button" className="back-button" onClick={save} disabled={!image}><i className="bi bi-download" aria-hidden="true" /> Save image</button>
          <button type="button" className="back-button" onClick={() => openChat(true)}><i className="bi bi-chat-text" aria-hidden="true" /> Send as text</button>
        </div>
      </>}
    </Modal>
  )
}
