import { useEffect, useState } from 'react'
import { apiRequest } from '../services/api.js'
import { useLocation } from 'react-router-dom'
import './pages.css'

const apiBase = `${(import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '').replace(/\/api$/i, '')}/api`

export default function Settings() {
  const location = useLocation()
  const isBackupPage = location.pathname.endsWith('/backup')
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [userToDelete, setUserToDelete] = useState(null)

  useEffect(() => {
    if (!toastMessage) return undefined
    const timeout = window.setTimeout(() => setToastMessage(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  function generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    const random = crypto.getRandomValues(new Uint8Array(20))
    const password = `${Array.from(random, (part) => alphabet[part % alphabet.length]).join('')}Aa1!`
    setForm((current) => ({ ...current, password }))
    setToastType('success'); setToastMessage('Password generated successfully.')
  }

  async function copyPassword() {
    try { await navigator.clipboard.writeText(form.password); setToastType('success'); setToastMessage('Generated password copied to clipboard.') }
    catch { setError('Could not access clipboard. Select and copy the password instead.') }
  }

  async function loadUsers() {
    try { setUsers(await apiRequest('/auth/users')) } catch (err) { setError(err.message) }
  }
  useEffect(() => { if (!isBackupPage) loadUsers() }, [isBackupPage])

  async function createUser(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const user = await apiRequest('/auth/users', { method: 'POST', body: JSON.stringify(form) }); setUsers((current) => [user, ...current]); setForm({ name: '', email: '', password: '' }); setToastType('success'); setToastMessage('User account created successfully.') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function removeUser() {
    if (!userToDelete) return
    setBusy(true); setError('')
    try {
      await apiRequest(`/auth/users/${userToDelete._id}`, { method: 'DELETE' })
      setUsers((current) => current.filter((entry) => entry._id !== userToDelete._id))
      setUserToDelete(null); setToastType('danger'); setToastMessage('User deleted successfully.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function exportData() {
    setError('')
    try {
      const response = await fetch(`${apiBase}/admin/backup/export`, { headers: { Authorization: `Bearer ${localStorage.getItem('kani-auth-token')}` } })
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'Could not export backup.') }
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'kani-metals-backup.json'; anchor.click(); URL.revokeObjectURL(url); setToastType('success'); setToastMessage('Database backup downloaded.')
    } catch (err) { setError(err.message) }
  }

  async function importData(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('Importing replaces all current dealers, products, and bills. Continue only if you have a backup.')) return
    setBusy(true); setError('')
    try {
      const backup = JSON.parse(await file.text())
      const result = await apiRequest('/admin/backup/import', { method: 'POST', body: JSON.stringify(backup) })
      setToastType('success'); setToastMessage(`${result.message} Dealers: ${result.counts.dealers}, products: ${result.counts.products}, bills: ${result.counts.bills}.`)
    } catch (err) { setError(err instanceof SyntaxError ? 'The selected file is not valid JSON.' : err.message) } finally { setBusy(false) }
  }

  return <section className="boarder-box settings-page">{toastMessage && <div className={`app-toast app-toast-${toastType}`} role="status"><i className={`bi ${toastType === 'danger' ? 'bi-trash3-fill' : 'bi-check-circle-fill'}`} aria-hidden="true" />{toastMessage}</div>}<header className="bill-header"><div><h1 className="page-title">{isBackupPage ? 'Database backup' : 'User management'}</h1><p>{isBackupPage ? 'Export or restore business records.' : 'Create and remove user accounts.'}</p></div></header>
    {error && <p className="api-error" role="alert">{error}</p>}
    {isBackupPage ? <section className="settings-panel"><h2>Backup and restore</h2><p>Export or restore dealers, products, and bills as a JSON backup. User accounts and password hashes are never included. Import replaces the current business records.</p><div className="backup-actions"><button type="button" className="continue-btn" onClick={exportData}>Export backup</button><label className="back-button backup-file-label">Import backup<input type="file" accept="application/json,.json" onChange={importData} disabled={busy} /></label></div></section> : <>
      <div className="settings-grid"><section className="settings-panel"><h2>Create user account</h2><p>Users sign in with email and password. Only admins can manage accounts.</p><form className="settings-user-form" onSubmit={createUser}><label>Name<input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label>Email<input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Temporary password<input className="form-control" type="text" minLength="12" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><small>Generate a strong password and share it securely.</small></label><div className="backup-actions"><button type="button" className="back-button" onClick={generatePassword}>Generate password</button>{form.password && <button type="button" className="back-button" onClick={copyPassword}>Copy password</button>}<button className="continue-btn" disabled={busy}>{busy ? 'Working…' : 'Create account'}</button></div></form></section></div>
      <section className="settings-panel settings-users"><h2>Users</h2>{users.length ? <div className="table-responsive"><table className="table align-middle"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Action</th></tr></thead><tbody>{users.map((user) => { const isDemoAdmin = user.name === 'Demo Admin'; const createdAt = user.createdAt ? new Date(user.createdAt) : null; const createdDate = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleDateString() : '—'; return <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td>{isDemoAdmin ? 'Demo admin' : user.role}</td><td>{createdDate}</td><td>{user.role === 'admin' && !isDemoAdmin ? 'Primary admin' : <button type="button" className="remove-bill-item" onClick={() => setUserToDelete(user)}>Delete</button>}</td></tr> })}</tbody></table></div> : <p>No user accounts found.</p>}</section>
    </>}
    {userToDelete && <div className="dealer-delete-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setUserToDelete(null) }}><section className="dealer-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="user-delete-title" aria-describedby="user-delete-description"><div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div><h2 id="user-delete-title">Delete user?</h2><p id="user-delete-description">Delete the account for <strong>{userToDelete.name}</strong>? This action cannot be undone.</p><div className="dealer-delete-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setUserToDelete(null)}>Cancel</button><button type="button" className="confirm-delete-btn" disabled={busy} onClick={removeUser}>{busy ? 'Deleting…' : 'Delete user'}</button></div></section></div>}
  </section>
}
