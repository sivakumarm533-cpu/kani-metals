import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import './pages.css'

const categories = ['Metal', 'Plastic', 'Paper', 'Electronics']
const units = ['kg', 'g', 'ton', 'pcs', 'box', 'meter', 'liter']

function DealerBills() {
  const { dealerId } = useParams()
  const [dealer, setDealer] = useState(null)
  const [bills, setBills] = useState([])
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const [dealers, allBills] = await Promise.all([apiRequest('/dealers'), apiRequest('/bills')])
      setDealer(dealers.find((entry) => entry._id === dealerId) || null)
      setBills(allBills.filter((bill) => (bill.dealer?._id || bill.dealer) === dealerId))
    } catch (err) { setError(err.message) }
  }

  useEffect(() => { load() }, [dealerId])
  useEffect(() => {
    if (!toastMessage) return undefined
    const timeout = window.setTimeout(() => setToastMessage(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  function beginEdit(bill) {
    setEditing({ ...bill, issuedDate: new Date(bill.issuedDate).toISOString().slice(0, 10), items: bill.items.map((item) => ({ ...item, editorKey: crypto.randomUUID() })) })
  }

  function updateItem(index, key, value) {
    setEditing((current) => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }))
  }

  async function saveEdit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const saved = await apiRequest(`/bills/${editing._id}`, { method: 'PUT', body: JSON.stringify({ issuedDate: editing.issuedDate, items: editing.items.map(({ editorKey, ...item }) => ({ ...item, quantity: Number(item.quantity), price: Number(item.price) })) }) })
      setBills((current) => current.map((bill) => bill._id === saved._id ? saved : bill)); setEditing(null); setToastMessage('Bill updated successfully.'); setToastType('info')
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
      setToastMessage('Bill deleted successfully.')
      setToastType('danger')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (error && !dealer && !bills.length) return <section className="boarder-box"><p className="api-error" role="alert">{error}</p><Link className="back-button" to="/itemsentry">Back to dealers</Link></section>

  return <section className="boarder-box dealer-bills-page">
    {toastMessage && <div className={`app-toast app-toast-${toastType}`} role="status"><i className={`bi ${toastType === 'danger' ? 'bi-trash3-fill' : toastType === 'info' ? 'bi-pencil-square' : 'bi-check-circle-fill'}`} aria-hidden="true" />{toastMessage}</div>}
    <div className="bill-header"><div><h2 className="page-title">Dealer bill history</h2><p>All bills saved for this dealer.</p></div><div className="dealer-history-actions"><Link className="back-button" to="/itemsentry">All dealers</Link><Link className="continue-btn" to={`/itemsentry?dealer=${dealerId}`}>Add bill</Link></div></div>
    {error && <p className="api-error" role="alert">{error}</p>}
    {dealer && <section className="dealer-profile-panel"><div className="dealer-profile-avatar">{dealer.profileImage ? <img src={dealer.profileImage} alt={`${dealer.name} profile`} /> : dealer.name.slice(0, 2).toUpperCase()}</div><div className="dealer-profile-details"><h3>{dealer.name}</h3><span className="dealer-type">{dealer.category || 'Regular Dealer'}</span><div className="dealer-profile-contact"><span><i className="bi bi-telephone" /> {dealer.phone}</span><span><i className="bi bi-geo-alt" /> {dealer.location}</span></div></div></section>}
    {editing && <form className="dealer-form dealer-bill-edit" onSubmit={saveEdit}>
      <h3>Edit bill</h3><label>Bill date<input className="form-control" type="date" value={editing.issuedDate} onChange={(e) => setEditing({ ...editing, issuedDate: e.target.value })} required /></label>
      <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Unit</th><th>Price</th><th>Amount</th><th>Action</th></tr></thead><tbody>{editing.items.map((item, index) => <tr key={item.editorKey}>
        <td className="bill-item-name-cell"><input className="form-control bill-item-name-input" type="text" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} aria-label="Item name" autoComplete="off" required /></td>
        <td><select className="form-select" value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value)} aria-label="Category" required>{!categories.includes(item.category) && <option value={item.category}>{item.category}</option>}{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></td>
        <td><input className="form-control" type="number" min="0.01" step="any" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} aria-label="Quantity" required /></td>
        <td><select className="form-select" value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} aria-label="Unit" required>{!units.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}{units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></td>
        <td><input className="form-control" type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(index, 'price', e.target.value)} aria-label="Price per unit" required /></td>
        <td className="bill-edit-amount">₹{(Number(item.quantity) * Number(item.price)).toFixed(2)}</td>
        <td><button type="button" className="remove-bill-item" onClick={() => setEditing((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}>Delete</button></td>
      </tr>)}</tbody></table></div>
      <button type="button" className="back-button" onClick={() => setEditing((current) => ({ ...current, items: [...current.items, { editorKey: crypto.randomUUID(), name: '', category: categories[0], quantity: 1, unit: units[0], price: 0, image: '' }] }))}>Add item</button>
      <div className="dealer-bill-edit-total">Bill total: ₹{editing.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0).toFixed(2)}</div>
      <div className="dealer-delete-actions"><button type="button" className="remove-bill-item" onClick={() => setDeleting(editing)}>Delete bill</button><button type="button" className="back-button" onClick={() => setEditing(null)}>Cancel</button><button className="continue-btn" disabled={busy || !editing.items.length}>{busy ? 'Saving…' : 'Save and update bill'}</button></div>
    </form>}
    {!bills.length ? <p className="dealer-empty-state">No bills saved for this dealer yet.</p> : <div className="dealer-bill-list">{bills.map((bill) => <article className="dealer-bill-card" key={bill._id}>
      <div className="dealer-bill-heading"><div><h3>Bill · {new Date(bill.issuedDate).toLocaleDateString()}</h3><span>{bill.items.length} {bill.items.length === 1 ? 'item' : 'items'}</span></div><strong>₹{Number(bill.total).toFixed(2)}</strong></div>
      <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Price / unit</th><th>Amount</th></tr></thead><tbody>{bill.items.map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}</td><td>{item.category}</td><td>{item.quantity} {item.unit}</td><td>₹{Number(item.price).toFixed(2)}</td><td>₹{(Number(item.quantity) * Number(item.price)).toFixed(2)}</td></tr>)}</tbody></table></div>
      <div className="dealer-bill-actions"><button type="button" className="edit-bill-item" onClick={() => beginEdit(bill)}>Edit bill</button><button type="button" className="remove-bill-item" onClick={() => setDeleting(bill)}>Delete bill</button></div>
    </article>)}</div>}
    {deleting && <div className="dealer-delete-backdrop" role="presentation"><section className="dealer-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="bill-delete-title"><div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div><h2 id="bill-delete-title">Delete bill?</h2><p>Delete this bill dated <strong>{new Date(deleting.issuedDate).toLocaleDateString()}</strong>? This cannot be undone.</p><div className="dealer-delete-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="confirm-delete-btn" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete bill'}</button></div></section></div>}
  </section>
}

export default DealerBills
