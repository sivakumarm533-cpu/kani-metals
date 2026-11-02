import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'
import './pages.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/i, '')}/api`

export default function Settings() {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadUsers() {
    try { setUsers(await apiRequest('/auth/users')) } catch (err) { setError(err.message) }
  }
  useEffect(() => { loadUsers() }, [])

  async function createUser(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { const user = await apiRequest('/auth/users', { method: 'POST', body: JSON.stringify(form) }); setUsers((current) => [user, ...current]); setForm({ name: '', email: '', password: '' }); setMessage('User account created.') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function removeUser(user) {
    if (!window.confirm(`Delete the account for ${user.name}?`)) return
    try { await apiRequest(`/auth/users/${user._id}`, { method: 'DELETE' }); setUsers((current) => current.filter((entry) => entry._id !== user._id)); setMessage('User deleted.') }
    catch (err) { setError(err.message) }
  }

  async function exportData() {
    setError(''); setMessage('')
    try {
      const response = await fetch(`${apiBase}/admin/backup/export`, { headers: { Authorization: `Bearer ${localStorage.getItem('kani-auth-token')}` } })
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'Could not export backup.') }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'kani-metals-backup.json'; anchor.click(); URL.revokeObjectURL(url); setMessage('Database backup downloaded.')
    } catch (err) { setError(err.message) }
  }

  async function importData(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('Importing replaces all current dealers, products, and bills. Continue only if you have a backup.')) return
    setBusy(true); setError(''); setMessage('')
    try {
      const backup = JSON.parse(await file.text())
      const result = await apiRequest('/admin/backup/import', { method: 'POST', body: JSON.stringify(backup) })
      setMessage(`${result.message} Dealers: ${result.counts.dealers}, products: ${result.counts.products}, bills: ${result.counts.bills}.`)
    } catch (err) { setError(err instanceof SyntaxError ? 'The selected file is not valid JSON.' : err.message) } finally { setBusy(false) }
  }

  return <section className="boarder-box settings-page"><header className="bill-header"><div><h1 className="page-title">Settings</h1><p>Manage user access and database backups.</p></div></header>
    {error && <p className="api-error" role="alert">{error}</p>}{message && <p className="settings-message" role="status">{message}</p>}
    <div className="settings-grid"><section className="settings-panel"><h2>Create user</h2><p>Users can access business records. Only admins can manage accounts and backups.</p><form className="settings-user-form" onSubmit={createUser}><label>Name<input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Email<input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Temporary password<input className="form-control" type="password" minLength="12" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><small>At least 12 characters. Share it securely.</small></label><button className="continue-btn" disabled={busy}>{busy ? 'Working…' : 'Create user'}</button></form></section>
      <section className="settings-panel"><h2>Database backup</h2><p>Export or restore dealers, products, and bills as a JSON backup. User accounts and password hashes are never included.</p><div className="backup-actions"><button type="button" className="continue-btn" onClick={exportData}>Export backup</button><label className="back-button backup-file-label">Import backup<input type="file" accept="application/json,.json" onChange={importData} disabled={busy} /></label></div></section></div>
    <section className="settings-panel settings-users"><h2>Users</h2>{users.length ? <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td>{user.role}</td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td>{user.role === 'admin' ? 'Primary admin' : <button type="button" className="remove-bill-item" onClick={() => removeUser(user)}>Delete</button>}</td></tr>)}</tbody></table></div> : <p>No user accounts found.</p>}</section>
  </section>
}
