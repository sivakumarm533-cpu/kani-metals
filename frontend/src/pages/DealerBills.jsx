import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import Toast from '../components/Toast.jsx'
import Modal from '../components/Modal.jsx'
import BillShareModal from '../components/BillShareModal.jsx'
import LoadError from '../components/LoadError.jsx'
import { useToast } from '../hooks/useToast.js'
import { formatRupees } from '../utils/format.js'

const categories = ['Metal', 'Plastic', 'Paper', 'Electronics']
const units = ['kg', 'g', 'ton', 'pcs', 'box', 'meter', 'liter']
const billDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

function DealerBills() {
  const { dealerId } = useParams()
  const [data, setData] = useState({ key: '', dealer: null, bills: [], error: '' })
  const [retry, setRetry] = useState(0)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [sharingBillId, setSharingBillId] = useState(null)
  const [error, setError] = useState('')
  const [toast, notify] = useToast()
  const [busy, setBusy] = useState(false)
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
      const items = editing.items.map((item) => ({ name: item.name, category: item.category, unit: item.unit, image: item.image || '', quantity: Number(item.quantity), price: Number(item.price) }))
      const saved = await apiRequest(`/bills/${editing._id}`, { method: 'PUT', body: JSON.stringify({ issuedDate: editing.issuedDate, items }) })
      setBills((current) => current.map((bill) => bill._id === saved._id ? saved : bill)); setEditing(null); notify('Bill updated successfully.', 'info')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true); setError('')
    try {
      await apiRequest(`/bills/${deleting._id}`, { method: 'DELETE' })
      setBills((current) => current.filter((entry) => entry._id !== deleting._id))
      if (editing?._id === deleting._id) setEditing(null)
      setDeleting(null)
      notify('Bill deleted successfully.', 'danger', 'bi-trash3-fill')
    } catch (err) { setDeleting(null); setError(err.message) } finally { setBusy(false) }
  }

  if (!loading && data.error) return <section className="boarder-box"><LoadError message={data.error} onRetry={() => setRetry((count) => count + 1)} /><Link className="back-button" to="/itemsentry"><i className="bi bi-arrow-left" aria-hidden="true" /> Back to dealers</Link></section>

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
        <td className="bill-item-name-cell"><input className="form-control bill-item-name-input" type="text" value={item.name} maxLength="120" onChange={(e) => updateItem(index, 'name', e.target.value)} aria-label={`Item ${index + 1} name`} autoComplete="off" required /></td>
        <td><select className="form-select" value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value)} aria-label={`Item ${index + 1} category`} required>{!categories.includes(item.category) && <option value={item.category}>{item.category}</option>}{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></td>
        <td><input className="form-control" type="number" inputMode="decimal" min="0.01" step="any" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} aria-label={`Item ${index + 1} quantity`} required /></td>
        <td><select className="form-select" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} aria-label={`Item ${index + 1} unit`} required>{!units.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></td>
        <td><input className="form-control" type="number" inputMode="decimal" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} aria-label={`Item ${index + 1} price per unit`} required /></td>
        <td className="bill-edit-amount">{formatRupees(Number(item.quantity) * Number(item.price))}</td>
        <td><button type="button" className="remove-bill-item" aria-label={`Delete item ${index + 1}`} onClick={() => setEditing((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}>Delete</button></td>
      </tr>)}</tbody></table></div>
      <button type="button" className="back-button" onClick={() => setEditing((current) => ({ ...current, items: [...current.items, { editorKey: crypto.randomUUID(), name: '', category: categories[0], quantity: 1, unit: units[0], price: 0, image: '' }] }))}><i className="bi bi-plus-lg" aria-hidden="true" /> Add item</button>
      <div className="dealer-bill-edit-total">Bill total: {formatRupees(editTotal)}</div>
      <div className="dealer-delete-actions"><button type="button" className="remove-bill-item" onClick={() => setDeleting(editing)}>Delete bill</button><button type="button" className="back-button" onClick={() => setEditing(null)}>Cancel</button><button className="continue-btn" disabled={busy || !editing.items.length}>{busy ? 'Saving…' : 'Save and update bill'}</button></div>
    </form>}
    {!loading && dealer && (!bills.length ? <div className="empty-state empty-state-panel"><i className="bi bi-receipt" aria-hidden="true" /><strong>No bills saved for this dealer yet</strong><span>Create the first bill from Item entry.</span><Link className="continue-btn" to={`/itemsentry?dealer=${dealerId}`}>Add bill</Link></div> : <div className="dealer-bill-list">{bills.map((bill) => <article className="dealer-bill-card" key={bill._id}>
      <div className="dealer-bill-heading"><div><h3>Bill · {billDate(bill.issuedDate)}</h3><span>{bill.items.length} {bill.items.length === 1 ? 'item' : 'items'}</span></div><strong>{formatRupees(bill.total)}</strong></div>
      <div className="table-responsive"><table className="table align-middle mb-0 responsive-card-table"><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Price / unit</th><th>Amount</th></tr></thead><tbody>{bill.items.map((item, index) => <tr key={`${item.name}-${index}`}><td data-label="Item">{item.name}</td><td data-label="Category">{item.category}</td><td data-label="Quantity">{item.quantity} {item.unit}</td><td data-label="Price / unit">{formatRupees(item.price)}</td><td data-label="Amount">{formatRupees(Number(item.quantity) * Number(item.price))}</td></tr>)}</tbody></table></div>
      <div className="dealer-bill-actions"><button type="button" className="whatsapp-inline-btn" onClick={() => setSharingBillId(bill._id)}><i className="bi bi-whatsapp" aria-hidden="true" /> Send on WhatsApp</button><Link className="back-button" to={`/dealer-payments/${dealerId}?bill=${bill._id}`}><i className="bi bi-wallet2" aria-hidden="true" /> Payments</Link><button type="button" className="edit-bill-item" onClick={() => beginEdit(bill)}>Edit bill</button><button type="button" className="remove-bill-item" onClick={() => setDeleting(bill)}>Delete bill</button></div>
    </article>)}</div>)}
    {sharingBillId && <BillShareModal dealerId={dealerId} billId={sharingBillId} onClose={() => setSharingBillId(null)} />}
    {deleting && <Modal role="alertdialog" busy={busy} onClose={() => setDeleting(null)} labelledBy="bill-delete-title" describedBy="bill-delete-description"><div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div><h2 id="bill-delete-title">Delete bill?</h2><p id="bill-delete-description">Delete this bill dated <strong>{billDate(deleting.issuedDate)}</strong>? This cannot be undone.</p><div className="dealer-delete-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setDeleting(null)} data-autofocus>Cancel</button><button type="button" className="confirm-delete-btn" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete bill'}</button></div></Modal>}
  </section>
}

export default DealerBills
