import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import Toast from '../components/Toast.jsx'
import Modal from '../components/Modal.jsx'
import BillShareModal from '../components/BillShareModal.jsx'
import LoadError from '../components/LoadError.jsx'
import { useToast } from '../hooks/useToast.js'
import { formatRupees } from '../utils/format.js'
import { formatPaise } from '../utils/billImage.js'
import { useAppSettings } from '../settings/appSettingsContext.js'

const units = ['kg', 'g', 'ton', 'pcs', 'box', 'meter', 'liter']
const billDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function DealerBills() {
  // Item categories from Settings → Dropdown lists.
  const categories = useAppSettings().lists.itemCategories
  const { dealerId } = useParams()
  const [data, setData] = useState({ key: '', dealer: null, bills: [], error: '' })
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  // What deleting the bill would also remove: { payments, paidPaise, advanceUsedPaise, canDelete } or { error }.
  const [deleteSummary, setDeleteSummary] = useState(null)
  // Money already paid on a bill being deleted: kept as dealer advance (default) or deleted with it.
  const [paidHandling, setPaidHandling] = useState('advance')
  const [sharingBillId, setSharingBillId] = useState(null)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  const [busy, setBusy] = useState(false)
  // Bills shown open in the accordion. null = nothing chosen yet, so the newest bill starts open.
  const [openBillIds, setOpenBillIds] = useState(null)
  const requestKey = `${dealerId}:${retry}`
  const loading = data.key !== requestKey
  const { dealer, bills } = data

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/dealers'), apiRequest(`/bills?dealer=${encodeURIComponent(dealerId)}`)])
      .then(([dealers, dealerBills]) => {
        if (active) setData({ key: requestKey, dealer: dealers.find((entry) => entry._id === dealerId) || null, bills: dealerBills, error: '' })
      })
      .catch((err) => { if (active) setData({ key: requestKey, dealer: null, bills: [], error: err.message }) })
    return () => { active = false }
  }, [dealerId, requestKey])

  const setBills = (update) => setData((current) => ({ ...current, bills: update(current.bills) }))

  function beginEdit(bill) {
    setError('')
    setEditing({ ...bill, issuedDate: new Date(bill.issuedDate).toISOString().slice(0, 10), items: bill.items.map((item) => ({ ...item, editorKey: crypto.randomUUID() })) })
    window.requestAnimationFrame(() => document.getElementById('bill-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function updateItem(index, key, value) {
    setEditing((current) => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }))
  }

  async function saveEdit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const items = editing.items.map((item) => ({ name: item.name, category: item.category, unit: item.unit, image: item.image || '', note: (item.note || '').trim(), quantity: Number(item.quantity), price: Number(item.price) }))
      const saved = await apiRequest(`/bills/${editing._id}`, { method: 'PUT', body: JSON.stringify({ issuedDate: editing.issuedDate, items }) })
      setBills((current) => current.map((bill) => bill._id === saved._id ? saved : bill)); setEditing(null); notify('Bill updated successfully.', 'info')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function askDelete(bill) {
    setDeleting(bill)
    setDeleteSummary(null)
    setPaidHandling('advance')
    apiRequest(`/bills/${bill._id}/delete-summary`)
      .then(setDeleteSummary)
      .catch((err) => setDeleteSummary({ error: err.message }))
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true); setError('')
    try {
      const result = await apiRequest(`/bills/${deleting._id}`, { method: 'DELETE', body: JSON.stringify({ paidHandling }) })
      setBills((current) => current.filter((entry) => entry._id !== deleting._id))
      if (editing?._id === deleting._id) setEditing(null)
      setDeleting(null)
      notify(result?.message || 'Bill deleted successfully.', 'danger', 'bi-trash3-fill')
    } catch (err) { setDeleting(null); setError(err.message) } finally { setBusy(false) }
  }

  if (!loading && data.error) return <section className="boarder-box"><LoadError message={data.error} onRetry={() => setRetry((count) => count + 1)} /><Link className="back-button" to="/itemsentry"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to dealers</Link></section>

  const isBillOpen = (bill, index) => (openBillIds ? openBillIds.includes(bill._id) : index === 0)
  const allOpen = bills.length > 0 && bills.every(isBillOpen)
  const toggleBill = (bill, index) => setOpenBillIds(bills.filter((entry, i) => (entry._id === bill._id ? !isBillOpen(bill, index) : isBillOpen(entry, i))).map((entry) => entry._id))
  const itemPreview = (bill) => bill.items.slice(0, 3).map((item) => item.name).join(', ') + (bill.items.length > 3 ? ` +${bill.items.length - 3} more` : '')

  const editTotal = editing ? editing.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0) : 0

  return <section className="boarder-box dealer-bills-page">
    <Toast toast={toast} />
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/itemsentry">Item entry</Link><i className="bi bi-chevron-right" aria-hidden="true" /><span>{dealer?.name || 'Dealer'}</span></nav>
    <div className="bill-header"><div><h1 className="page-title">Dealer bill history</h1><p>All bills saved for this dealer.</p></div><div className="dealer-history-actions"><Link className="back-button" to="/itemsentry"><i className="bi bi-arrow-left" aria-hidden="true" /> All dealers</Link><Link className="continue-btn" to={`/itemsentry?dealer=${dealerId}`}><i className="bi bi-plus-lg" aria-hidden="true" /> Add bill</Link></div></div>
    <LoadError message={error} />
    {loading && <><div className="skeleton skeleton-row" /><div className="skeleton skeleton-card-lg" /></>}
    {!loading && !dealer && <div className="empty-state empty-state-panel"><i className="bi bi-person-x" aria-hidden="true" /><strong>Dealer not found</strong><span>This dealer may have been deleted.</span></div>}
    {dealer && <section className="dealer-profile-panel"><div className="dealer-profile-avatar">{dealer.profileImage ? <img src={dealer.profileImage} alt={`${dealer.name} profile`} /> : dealer.name.slice(0, 2).toUpperCase()}</div><div className="dealer-profile-details"><h2>{dealer.name}</h2><span className="dealer-type">{dealer.category || 'Regular Dealer'}</span><div className="dealer-profile-contact"><span><i className="bi bi-telephone" aria-hidden="true" /> {dealer.phone}</span>{dealer.location && <span><i className="bi bi-geo-alt" aria-hidden="true" /> {dealer.location}</span>}<span><i className="bi bi-receipt" aria-hidden="true" /> {bills.length} {bills.length === 1 ? 'bill' : 'bills'}</span></div></div></section>}
    {editing && <form className="dealer-form dealer-bill-edit" id="bill-edit-form" onSubmit={saveEdit} aria-busy={busy}>
      <h3>Edit bill</h3><label>Bill date<input className="form-control" type="date" value={editing.issuedDate} onChange={(e) => setEditing({ ...editing, issuedDate: e.target.value })} required /></label>
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Unit</th><th>Price</th><th>Amount</th><th>Action</th></tr></thead><tbody>{editing.items.map((item, index) => <tr key={item.editorKey}>
        <td className="bill-item-name-cell"><input className="form-control bill-item-name-input" type="text" value={item.name} maxLength="120" onChange={(e) => updateItem(index, 'name', e.target.value)} aria-label={`Item ${index + 1} name`} autoComplete="off" required /><input className="form-control bill-item-note-input" type="text" value={item.note || ''} maxLength="200" onChange={(e) => updateItem(index, 'note', e.target.value)} aria-label={`Item ${index + 1} note`} placeholder="Note (optional)" autoComplete="off" /></td>
        <td><select className="form-select" value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value)} aria-label={`Item ${index + 1} category`} required>{!categories.includes(item.category) && <option value={item.category}>{item.category}</option>}{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></td>
        <td><input className="form-control" type="number" inputMode="decimal" min="0.01" step="any" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} aria-label={`Item ${index + 1} quantity`} required /></td>
        <td><select className="form-select" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} aria-label={`Item ${index + 1} unit`} required>{!units.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></td>
        <td><input className="form-control" type="number" inputMode="decimal" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} aria-label={`Item ${index + 1} price per unit`} required /></td>
        <td className="bill-edit-amount">{formatRupees(Number(item.quantity) * Number(item.price))}</td>
        <td><button type="button" className="remove-bill-item" aria-label={`Delete item ${index + 1}`} onClick={() => setEditing((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}>Delete</button></td>
      </tr>)}</tbody></table></div>
      <button type="button" className="back-button" onClick={() => setEditing((current) => ({ ...current, items: [...current.items, { editorKey: crypto.randomUUID(), name: '', category: categories[0], quantity: 1, unit: units[0], price: 0, image: '' }] }))}><i className="bi bi-plus-lg" aria-hidden="true" /> Add item</button>
      <div className="dealer-bill-edit-total">Bill total: {formatRupees(editTotal)}</div>
      <div className="dealer-delete-actions"><button type="button" className="remove-bill-item" onClick={() => askDelete(editing)}>Delete bill</button><button type="button" className="back-button" onClick={() => setEditing(null)}>Cancel</button><button className="continue-btn" disabled={busy || !editing.items.length}>{busy ? 'Saving…' : 'Save and update bill'}</button></div>
    </form>}
    {!loading && dealer && (!bills.length ? <div className="empty-state empty-state-panel"><i className="bi bi-receipt" aria-hidden="true" /><strong>No bills saved for this dealer yet</strong><span>Create the first bill from Item entry.</span><Link className="continue-btn" to={`/itemsentry?dealer=${dealerId}`}>Add bill</Link></div> : <>
      <div className="dealer-bill-list-toolbar"><span>{bills.length} {bills.length === 1 ? 'bill' : 'bills'} · newest first</span><button type="button" className="link-button" onClick={() => setOpenBillIds(allOpen ? [] : bills.map((bill) => bill._id))}><i className={`bi ${allOpen ? 'bi-arrows-collapse' : 'bi-arrows-expand'}`} aria-hidden="true" /> {allOpen ? 'Collapse all' : 'Expand all'}</button></div>
      <div className="dealer-bill-list dealer-bill-accordion">{bills.map((bill, index) => {
      const open = isBillOpen(bill, index)
      return <article className={`dealer-bill-card${open ? ' is-open' : ''}`} key={bill._id}>
      <h3 className="dealer-bill-accordion-heading"><button type="button" className="dealer-bill-toggle" id={`bill-head-${bill._id}`} aria-expanded={open} aria-controls={`bill-panel-${bill._id}`} onClick={() => toggleBill(bill, index)}>
        <span className="dealer-bill-toggle-icon" aria-hidden="true"><i className="bi bi-receipt" /></span>
        <span className="dealer-bill-toggle-text"><span className="dealer-bill-toggle-title">Bill · {billDate(bill.issuedDate)}{bill.hasPayments && <span className="dealer-bill-paid-badge"><i className="bi bi-wallet2" aria-hidden="true" /> Payments</span>}</span><span className="dealer-bill-toggle-meta">{bill.items.length} {bill.items.length === 1 ? 'item' : 'items'}{!open && bill.items.length > 0 ? ` · ${itemPreview(bill)}` : ''}</span></span>
        <strong className="dealer-bill-toggle-total">{formatRupees(bill.total)}</strong>
        <i className="bi bi-chevron-down dealer-bill-chevron" aria-hidden="true" />
      </button></h3>
      {open && <div className="dealer-bill-panel" id={`bill-panel-${bill._id}`} role="region" aria-labelledby={`bill-head-${bill._id}`}>
      <div className="table-responsive"><table className="table align-middle mb-0 responsive-card-table"><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Price / unit</th><th>Amount</th></tr></thead><tbody>{bill.items.map((item, index) => <tr key={`${item.name}-${index}`}><td data-label="Item"><span>{item.name}{item.note && <small className="bill-item-note">{item.note}</small>}</span></td><td data-label="Category">{item.category}</td><td data-label="Quantity">{item.quantity} {item.unit}</td><td data-label="Price / unit">{formatRupees(item.price)}</td><td data-label="Amount">{formatRupees(Number(item.quantity) * Number(item.price))}</td></tr>)}</tbody></table></div>
      <div className="dealer-bill-actions"><button type="button" className="whatsapp-inline-btn" onClick={() => setSharingBillId(bill._id)}><i className="bi bi-whatsapp" aria-hidden="true" /> Send on WhatsApp</button><Link className="back-button" to={`/dealer-payments/${dealerId}?bill=${bill._id}`}><i className="bi bi-wallet2" aria-hidden="true" /> Payments</Link>{bill.hasPayments ? <span className="bill-locked-note" title="Reverse this bill's payments in Payments to edit it."><i className="bi bi-lock" aria-hidden="true" /> Has payments · reverse them to edit</span> : <button type="button" className="edit-bill-item" onClick={() => beginEdit(bill)}>Edit bill</button>}<button type="button" className="remove-bill-item" onClick={() => askDelete(bill)}><i className="bi bi-trash3" aria-hidden="true" /> Delete bill</button></div>
      </div>}
    </article>
    })}</div></>)}
    {sharingBillId && <BillShareModal dealerId={dealerId} billId={sharingBillId} onClose={() => setSharingBillId(null)} />}
    {deleting && (() => {
      const summary = deleteSummary
      const hasPayments = Boolean(summary && !summary.error && summary.payments > 0)
      const blocked = !summary || summary.error || summary.canDelete === false
      const advanceBack = (summary?.advanceUsedPaise || 0) + (paidHandling === 'advance' ? summary?.paidPaise || 0 : 0)
      return <Modal role="alertdialog" busy={busy} onClose={() => setDeleting(null)} labelledBy="bill-delete-title" describedBy="bill-delete-description">
        <div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div>
        <h2 id="bill-delete-title">Delete bill?</h2>
        <p id="bill-delete-description">Delete the bill dated <strong>{billDate(deleting.issuedDate)}</strong> for <strong>{formatRupees(deleting.total)}</strong>? This cannot be undone.</p>
        {!summary && <p>Checking this bill's payments…</p>}
        {summary?.error && <p className="api-error" role="alert">{summary.error}</p>}
        {hasPayments && <>
          <p className="dealer-delete-tip"><i className="bi bi-exclamation-triangle" aria-hidden="true" /> This bill has <strong>{summary.payments} {summary.payments === 1 ? 'payment' : 'payments'}</strong>. They will be deleted with the bill.</p>
          {summary.canDelete === false
            ? <p className="api-error" role="alert">Only an administrator or sub-admin can delete a bill that has payments. You can reverse its payments first in Payments.</p>
            : <>
              {summary.paidPaise > 0 && <fieldset className="payment-extra-choice bill-delete-choice">
                <legend>{formatPaise(summary.paidPaise)} was already paid on this bill. What should happen to it?</legend>
                <label className={`payment-extra-option${paidHandling === 'advance' ? ' is-selected' : ''}`}>
                  <input type="radio" name="paidHandling" checked={paidHandling === 'advance'} onChange={() => setPaidHandling('advance')} />
                  <i className="bi bi-piggy-bank" aria-hidden="true" />
                  <span><strong>Keep as advance</strong><small>{dealer?.name || 'The dealer'} keeps {formatPaise(summary.paidPaise)} to use on their next bill.</small></span>
                </label>
                <label className={`payment-extra-option${paidHandling === 'delete' ? ' is-selected' : ''}`}>
                  <input type="radio" name="paidHandling" checked={paidHandling === 'delete'} onChange={() => setPaidHandling('delete')} />
                  <i className="bi bi-x-circle" aria-hidden="true" />
                  <span><strong>Delete it too</strong><small>Use this if the payments were entered by mistake.</small></span>
                </label>
              </fieldset>}
              {advanceBack > 0 && <p className="dealer-delete-tip"><i className="bi bi-piggy-bank" aria-hidden="true" /> {formatPaise(advanceBack)} will be added to {dealer?.name || 'the dealer'}'s advance{summary.advanceUsedPaise > 0 ? ` (includes ${formatPaise(summary.advanceUsedPaise)} of advance that was used on this bill)` : ''}.</p>}
            </>}
        </>}
        <div className="dealer-delete-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setDeleting(null)} data-autofocus>Cancel</button><button type="button" className="confirm-delete-btn" disabled={busy || blocked} onClick={confirmDelete}>{busy ? 'Deleting…' : hasPayments ? 'Delete bill and payments' : 'Delete bill'}</button></div>
      </Modal>
    })()}
  </section>
}

export default DealerBills
