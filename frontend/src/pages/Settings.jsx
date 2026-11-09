import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { apiFetch, apiRequest } from '../services/api.js'
import Modal from '../components/Modal.jsx'
import { compressImageFile } from '../utils/image.js'
import { useAuth } from '../auth/authContextValue.js'
import { roleLabel } from '../config/navigation.js'

const roleBadge = (role) => (role === 'admin' ? 'Admin' : role === 'subadmin' ? 'Sub-admin' : 'User')
const roleDescription = (role) => (role === 'admin' ? 'Primary administrator' : role === 'subadmin' ? 'Can manage users and settings' : 'Team member')

function RoleChooser({ value, onChange, disabled }) {
  return <fieldset className="role-chooser" disabled={disabled}>
    <legend>Access level</legend>
    {[
      { id: 'user', title: 'Team member', text: 'Uses the features you switch on in Feature access.', icon: 'bi-person' },
      { id: 'subadmin', title: 'Sub-admin', text: 'Admin rights: all features, users, activity and settings. Cannot restore backups or manage other sub-admins.', icon: 'bi-shield-check' },
    ].map((option) => <label key={option.id} className={`role-option${value === option.id ? ' is-selected' : ''}`}>
      <input type="radio" name="role" value={option.id} checked={value === option.id} onChange={() => onChange(option.id)} />
      <i className={`bi ${option.icon}`} aria-hidden="true" />
      <span><strong>{option.title}</strong><small>{option.text}</small></span>
    </label>)}
  </fieldset>
}

function UserAvatar({ user, size = 'normal' }) {
  return <span className={`user-avatar user-avatar-${size}`}>{user.profilePicture ? <img src={user.profilePicture} alt={`${user.name} profile`} /> : <span>{user.name?.trim()?.[0]?.toUpperCase() || '?'}</span>}</span>
}

function readableField(field) {
  return field.replace(/([A-Z])/g, ' $1').replace(/^./, (character) => character.toUpperCase())
}

const emptyActivityFilters = { search: '', actor: '', action: '', entity: '', dateFrom: '', dateTo: '' }

function uniqueActivities(records) {
  const seen = new Set()
  return records.filter((record) => {
    const id = String(record._id)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function activityRequestUrl(filters, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '30' })
  for (const key of ['search', 'actor', 'action', 'entity']) if (filters[key]) params.set(key, filters[key])
  if (filters.dateFrom) params.set('dateFrom', new Date(`${filters.dateFrom}T00:00:00`).toISOString())
  if (filters.dateTo) {
    const exclusiveEnd = new Date(`${filters.dateTo}T00:00:00`)
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1)
    params.set('dateTo', exclusiveEnd.toISOString())
  }
  return `/auth/activity?${params.toString()}`
}

function localDayKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function activityDateGroup(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Earlier'
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const activityDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayDifference = Math.round((today - activityDay) / 86400000)
  if (dayDifference === 0) return 'Today'
  if (dayDifference === 1) return 'Yesterday'
  return 'Earlier'
}

function activityTime(value, withDate = true) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown time'
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const group = activityDateGroup(value)
  if (group === 'Today') return withDate ? `Today at ${time}` : time
  if (group === 'Yesterday') return withDate ? `Yesterday at ${time}` : time
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function formatCompareValue(value, field, action, side = 'after') {
  if (value == null || value === '') return <span className="activity-value-empty">—</span>
  if (value === '[image attached]') return action === 'update' && side === 'after' ? 'Image updated' : 'Image attached'
  if (Array.isArray(value)) {
    if (!value.length) return 'No items'
    return <ol className="activity-value-list">{value.map((entry, index) => <li key={index}>
      {entry && typeof entry === 'object'
        ? Object.entries(entry).map(([key, item]) => <span className="activity-value-detail" key={key}><strong>{readableField(key)}:</strong> {formatCompareValue(item, key, action, side)}</span>)
        : formatCompareValue(entry, field, action, side)}
    </li>)}</ol>
  }
  if (typeof value === 'object') {
    return <dl className="activity-value-object">{Object.entries(value).map(([key, item]) => <div key={key}><dt>{readableField(key)}</dt><dd>{formatCompareValue(item, key, action, side)}</dd></div>)}</dl>
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number' && /total|price|amount|cost|rate/i.test(field)) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)
  }
  if (typeof value === 'string' && /total|price|amount|cost|rate/i.test(field) && /^-?\d+(\.\d+)?$/.test(value)) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value))
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString()
  }
  return String(value)
}

function ActivityPage() {
  const [users, setUsers] = useState([])
  const [filters, setFilters] = useState(emptyActivityFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyActivityFilters)
  const [resultState, setResultState] = useState({ key: '', retry: -1, items: [], summary: { total: 0, today: 0, create: 0, update: 0, delete: 0 }, page: 1, pages: 1, error: '' })
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const [retryCount, setRetryCount] = useState(0)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const dialogRef = useRef(null)
  const filterKey = JSON.stringify(appliedFilters)
  const requestUrl = activityRequestUrl(appliedFilters, 1)
  const loading = resultState.key !== filterKey || resultState.retry !== retryCount
  const items = loading ? [] : resultState.items
  const summary = loading ? { total: 0, today: 0, create: 0, update: 0, delete: 0 } : resultState.summary
  const page = loading ? 1 : resultState.page
  const pages = loading ? 1 : resultState.pages
  const error = loading ? '' : resultState.error

  useEffect(() => {
    let cancelled = false
    apiRequest(requestUrl).then((result) => {
      if (cancelled) return
      setUsers(result.actors || [])
      setResultState({ key: filterKey, retry: retryCount, items: uniqueActivities(result.items), summary: result.summary || { total: result.total, today: 0, create: 0, update: 0, delete: 0 }, page: 1, pages: result.pages, error: '' })
    }).catch((requestError) => {
      if (!cancelled) setResultState({ key: filterKey, retry: retryCount, items: [], summary: { total: 0, today: 0, create: 0, update: 0, delete: 0 }, page: 1, pages: 1, error: requestError.message })
    })
    return () => { cancelled = true }
  }, [requestUrl, filterKey, retryCount])

  useEffect(() => {
    if (selectedActivity && dialogRef.current && !dialogRef.current.open) dialogRef.current.showModal()
  }, [selectedActivity])

  async function loadMore() {
    if (loadingMoreRef.current) return
    loadingMoreRef.current = true
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const result = await apiRequest(activityRequestUrl(appliedFilters, nextPage))
      setResultState((current) => current.key === filterKey && current.retry === retryCount
        ? { ...current, items: uniqueActivities([...current.items, ...result.items]), page: nextPage, pages: result.pages, error: '' }
        : current)
    } catch (requestError) { setResultState((current) => ({ ...current, error: requestError.message })) }
    finally { loadingMoreRef.current = false; setLoadingMore(false) }
  }

  function submitFilters(event) {
    event.preventDefault()
    setAppliedFilters({ ...filters })
  }

  function resetFilters() {
    setFilters(emptyActivityFilters)
    setAppliedFilters(emptyActivityFilters)
  }

  const groupedItems = []
  let previousGroup = ''
  items.forEach((item) => {
    const group = activityDateGroup(item.createdAt)
    const key = group === 'Earlier' ? 'Earlier' : localDayKey(item.createdAt)
    if (key !== previousGroup) groupedItems.push({ type: 'heading', key, title: group })
    groupedItems.push({ type: 'activity', key: item._id, item })
    previousGroup = key
  })

  const summaryCards = [
    { key: 'total', label: 'Total Activities', icon: 'bi-activity', tone: 'orange' },
    { key: 'today', label: "Today's Activities", icon: 'bi-calendar-check', tone: 'purple' },
    { key: 'create', label: 'Create Actions', icon: 'bi-plus-circle', tone: 'green' },
    { key: 'update', label: 'Update Actions', icon: 'bi-pencil-square', tone: 'blue' },
    { key: 'delete', label: 'Delete Actions', icon: 'bi-trash3', tone: 'red' },
  ]

  return <div className="activity-page">
    <section className="activity-summary-grid" aria-label="Activity summary">
      {summaryCards.map((card) => <article className={`activity-summary-card activity-summary-${card.tone}`} key={card.key}><span className="activity-summary-icon"><i className={`bi ${card.icon}`} aria-hidden="true" /></span><div><span>{card.label}</span><strong>{loading ? '…' : error ? '—' : Number(summary[card.key] || 0).toLocaleString('en-IN')}</strong></div></article>)}
    </section>
    <form className="activity-filter-panel" onSubmit={submitFilters}>
      <label className="activity-search-field"><span>Search</span><span className="activity-search-input"><i className="bi bi-search" aria-hidden="true" /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Username, email, or record" /></span></label>
      <label><span>User</span><select value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.target.value })}><option value="">All users</option>{users.map((user) => <option key={user._id} value={user._id}>{user.name}</option>)}</select></label>
      <label><span>Action</span><select value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })}><option value="">All actions</option><option value="create">Create</option><option value="update">Update</option><option value="delete">Delete</option></select></label>
      <label><span>Data type</span><select value={filters.entity} onChange={(event) => setFilters({ ...filters, entity: event.target.value })}><option value="">All data</option><option value="product">Product</option><option value="dealer">Dealer</option><option value="bill">Bill</option><option value="payment">Payment</option><option value="user">User</option><option value="backup">Backup</option><option value="settings">Settings</option><option value="itemPrice">Item price</option></select></label>
      <label><span>From</span><input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
      <label><span>To</span><input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
      <div className="activity-filter-actions"><button type="submit" className="continue-btn">Apply</button><button type="button" className="back-button" onClick={resetFilters}>Reset</button></div>
    </form>
    {error && items.length > 0 && <p className="api-error" role="alert">{error}</p>}
    <section className="activity-results" aria-live="polite">
      <div className="activity-results-heading"><h2>Recent activity</h2><span>{Number(summary.total || 0).toLocaleString('en-IN')} records</span></div>
      {loading ? <div className="activity-skeleton-list" aria-label="Loading activities">{Array.from({ length: 5 }, (_, index) => <div className="activity-skeleton" key={index} />)}</div> : error ? <div className="activity-empty-state" role="alert"><span className="activity-empty-icon"><i className="bi bi-exclamation-circle" aria-hidden="true" /></span><h3>Could not load activity</h3><p>{error}</p><button type="button" className="back-button" onClick={() => setRetryCount((count) => count + 1)}>Try again</button></div> : groupedItems.length ? <div className="activity-timeline">
        {groupedItems.map((row) => row.type === 'heading' ? <h3 className="activity-date-heading" key={`heading-${row.key}`}>{row.title}</h3> : <article className="activity-row" key={row.item._id}>
          <span className="activity-avatar">{row.item.actorName?.trim()?.[0]?.toUpperCase() || '?'}</span>
          <div className="activity-row-main"><div className="activity-row-title"><strong>{row.item.actorName}</strong><span>{row.item.action} a {row.item.entity === 'backup' ? 'Backup' : row.item.entity}</span><span className={`activity-action activity-action-${row.item.action}`}>{row.item.action}</span><span className="activity-entity">{row.item.entity}</span></div><div className="activity-row-meta"><span>{row.item.actorEmail}</span><span className="activity-meta-dot">·</span><strong>{row.item.entityLabel}</strong><span className="activity-meta-dot">·</span><span>{row.item.changes?.length || 0} changed {row.item.changes?.length === 1 ? 'field' : 'fields'}</span></div></div>
          <time className="activity-row-time" dateTime={row.item.createdAt}>{activityTime(row.item.createdAt, false)}</time>
          <button type="button" className="activity-view-button" onClick={() => setSelectedActivity(row.item)} aria-label={`View changes for ${row.item.entityLabel}`}>View changes <i className="bi bi-arrow-right-short" aria-hidden="true" /></button>
        </article>)}
      </div> : <div className="activity-empty-state"><span className="activity-empty-icon"><i className="bi bi-inbox" aria-hidden="true" /></span><h3>No activity found</h3><p>Try changing your search or filters.</p><button type="button" className="back-button" onClick={resetFilters}>Reset filters</button></div>}
      {!loading && page < pages && <button type="button" className="activity-load-more" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more activity'}</button>}
    </section>
    <dialog className="activity-changes-dialog" ref={dialogRef} onClose={() => setSelectedActivity(null)} aria-labelledby="activity-dialog-title">
      {selectedActivity && <><header className="activity-dialog-header"><div><span className="activity-eyebrow">ACTIVITY DETAILS</span><h2 id="activity-dialog-title">{selectedActivity.actorName} {selectedActivity.action} a {selectedActivity.entity}</h2><p>{selectedActivity.entityLabel} · {activityTime(selectedActivity.createdAt)}</p></div><button type="button" className="activity-dialog-close" onClick={() => dialogRef.current?.close()} aria-label="Close activity details"><i className="bi bi-x-lg" aria-hidden="true" /></button></header>
        <div className="activity-comparison-wrap"><table className="activity-comparison-table"><thead><tr><th>Field</th><th>Previous value</th><th>New value</th></tr></thead><tbody>{selectedActivity.changes?.length ? selectedActivity.changes.map((change) => <tr key={change.field}><th scope="row">{readableField(change.field)}</th><td data-label="Previous value">{selectedActivity.action === 'create' ? <span className="activity-value-empty">—</span> : formatCompareValue(change.before, change.field, selectedActivity.action, 'before')}</td><td data-label="New value">{selectedActivity.action === 'delete' ? <span className="activity-value-empty">—</span> : formatCompareValue(change.after, change.field, selectedActivity.action, 'after')}</td></tr>) : <tr><td colSpan="3" className="activity-no-changes">No field details were recorded for this activity.</td></tr>}</tbody></table></div>
        <footer className="activity-dialog-footer"><span>Record reference: {selectedActivity.entityId || '—'}</span><button type="button" className="continue-btn" onClick={() => dialogRef.current?.close()}>Done</button></footer>
      </>}
    </dialog>
  </div>
}

export default function Settings() {
  const location = useLocation()
  const { user: currentUser } = useAuth()
  const isPrimaryAdmin = currentUser?.role === 'admin'
  const canManage = (user) => user.role === 'user' || (user.role === 'subadmin' && isPrimaryAdmin)
  const isBackupPage = location.pathname.endsWith('/backup')
  const isActivityPage = location.pathname.endsWith('/activity')
  const [users, setUsers] = useState([])
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [profileFile, setProfileFile] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'user' })
  const [editProfileFile, setEditProfileFile] = useState(null)
  const [usersSummary, setUsersSummary] = useState({ totalUsers: 0, activeUsers: 0, administrators: 0, subAdmins: 0, regularUsers: 0 })
  const [usersResultKey, setUsersResultKey] = useState('')
  const [usersRetry, setUsersRetry] = useState(0)
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [usersLoadError, setUsersLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState('success')
  const [userToDelete, setUserToDelete] = useState(null)
  const createUserDialogRef = useRef(null)
  const createProfileFileRef = useRef(null)
  const usersRequestKey = `${isBackupPage}-${isActivityPage}-${usersRetry}`
  const usersLoading = !isBackupPage && !isActivityPage && usersResultKey !== usersRequestKey

  useEffect(() => {
    if (!toastMessage) return undefined
    const timeout = window.setTimeout(() => setToastMessage(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [toastMessage])

  useEffect(() => {
    let cancelled = false
    if (isBackupPage || isActivityPage) return undefined
    Promise.all([apiRequest('/auth/users'), apiRequest('/auth/users/summary')]).then(([result, summary]) => {
      if (cancelled) return
      setUsers(result)
      setUsersSummary(summary)
      setUsersLoadError('')
      setUsersResultKey(usersRequestKey)
    }).catch((err) => { if (!cancelled) { setUsersLoadError(err.message); setUsersResultKey(usersRequestKey) } })
    return () => { cancelled = true }
  }, [isBackupPage, isActivityPage, usersRetry, usersRequestKey])

  useEffect(() => {
    if (createUserOpen && createUserDialogRef.current && !createUserDialogRef.current.open) createUserDialogRef.current.showModal()
  }, [createUserOpen])

  const visibleUsers = users.filter((user) => {
    const query = userSearch.trim().toLowerCase()
    const matchesQuery = !query || `${user.name} ${user.email}`.toLowerCase().includes(query)
    return matchesQuery && (!roleFilter || user.role === roleFilter)
  })

  function generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
    const random = crypto.getRandomValues(new Uint8Array(20))
    const password = `${Array.from(random, (part) => alphabet[part % alphabet.length]).join('')}Aa1!`
    setForm((current) => ({ ...current, password }))
    setToastType('success'); setToastMessage('Password generated successfully.')
  }

  function openCreateUser() {
    setForm({ name: '', email: '', password: '', role: 'user' })
    setProfileFile(null)
    if (createProfileFileRef.current) createProfileFileRef.current.value = ''
    setShowPassword(false)
    setError('')
    setCreateUserOpen(true)
  }

  function retryUsersLoad() {
    setUsersLoadError('')
    setUsersRetry((attempt) => attempt + 1)
  }

  async function copyPassword() {
    try { await navigator.clipboard.writeText(form.password); setToastType('success'); setToastMessage('Generated password copied to clipboard.') }
    catch { setError('Could not access clipboard. Select and copy the password instead.') }
  }

  async function createUser(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const body = new FormData()
      Object.entries(form).forEach(([key, value]) => body.append(key, value))
      if (profileFile) body.append('profilePicture', await compressImageFile(profileFile))
      const user = await apiRequest('/auth/users', { method: 'POST', body })
      setUsers((current) => [user, ...current]); setForm({ name: '', email: '', password: '', role: 'user' }); setProfileFile(null)
      apiRequest('/auth/users/summary').then(setUsersSummary).catch(() => {})
      if (createProfileFileRef.current) createProfileFileRef.current.value = ''
      if (createUserDialogRef.current?.open) createUserDialogRef.current.close()
      setToastType('success'); setToastMessage(user.role === 'subadmin' ? 'Sub-admin account created successfully.' : 'User account created successfully.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function openEditUser(user) {
    setEditingUser(user); setEditForm({ name: user.name, email: user.email, role: user.role }); setEditProfileFile(null); setError('')
  }

  async function updateUser(event) {
    event.preventDefault()
    if (!editingUser) return
    setBusy(true); setError('')
    try {
      const body = new FormData()
      Object.entries(editForm).forEach(([key, value]) => { if (key !== 'role' || isPrimaryAdmin) body.append(key, value) })
      if (editProfileFile) body.append('profilePicture', await compressImageFile(editProfileFile))
      const updated = await apiRequest(`/auth/users/${editingUser._id}`, { method: 'PATCH', body })
      setUsers((current) => current.map((user) => user._id === updated._id ? updated : user))
      apiRequest('/auth/users/summary').then(setUsersSummary).catch(() => {})
      setEditingUser(null); setToastType('info'); setToastMessage('User account updated.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function removeUser() {
    if (!userToDelete) return
    setBusy(true); setError('')
    try {
      await apiRequest(`/auth/users/${userToDelete._id}`, { method: 'DELETE' })
      setUsers((current) => current.filter((entry) => entry._id !== userToDelete._id))
      apiRequest('/auth/users/summary').then(setUsersSummary).catch(() => {})
      setUserToDelete(null); setToastType('danger'); setToastMessage('User deleted successfully.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function exportData() {
    setError(''); setBusy(true)
    try {
      const response = await apiFetch('/admin/backup/export')
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || 'Could not export backup.') }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `kani-metals-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      // Revoking immediately can cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 2000)
      setToastType('success'); setToastMessage('Database backup downloaded.')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function importData(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!window.confirm('Importing replaces current dealers, products, bills, and payment records. Continue only if you have a current backup?')) return
    setBusy(true); setError('')
    try {
      const backup = JSON.parse(await file.text())
      const result = await apiRequest('/admin/backup/import', { method: 'POST', body: JSON.stringify(backup) })
      setToastType('success'); setToastMessage(`${result.message} Dealers: ${result.counts.dealers}, products: ${result.counts.products}, bills: ${result.counts.bills}, payments: ${result.counts.payments}.`)
    } catch (err) { setError(err instanceof SyntaxError ? 'The selected file is not valid JSON.' : err.message) } finally { setBusy(false) }
  }

  const heading = isBackupPage ? 'Database backup' : isActivityPage ? 'User activity' : 'User Management'
  const description = isBackupPage ? 'Export or restore business records.' : isActivityPage ? 'Review who changed dealers, products, bills, and user accounts.' : isPrimaryAdmin ? 'Add team members and give trusted people sub-admin rights.' : 'Add and manage team members.'

  return <section className="boarder-box settings-page">
    {toastMessage && createPortal(<div key={`${toastType}-${toastMessage}`} className={`app-toast app-toast-${toastType}`} role="status"><i className={`bi ${toastType === 'danger' ? 'bi-trash3-fill' : toastType === 'info' ? 'bi-pencil-square' : 'bi-check-circle-fill'}`} aria-hidden="true" />{toastMessage}</div>, document.body)}
    {!isActivityPage && <header className="bill-header settings-page-header"><div><h1 className="page-title">{heading}</h1><p>{description}</p></div>{!isBackupPage && <button type="button" className="continue-btn user-add-button" onClick={openCreateUser}><i className="bi bi-plus-lg" aria-hidden="true" /> Add User</button>}</header>}
    {error && !isActivityPage && !createUserOpen && !usersLoading && <p className="api-error" role="alert">{error}</p>}

    {isBackupPage ? <section className="settings-panel"><h2>Backup and restore</h2><p>Export or restore dealers, products, bills, and payment history as a JSON backup. User accounts and password hashes are never included. Import replaces current business records.</p><div className="backup-actions"><button type="button" className="continue-btn" onClick={exportData} disabled={busy}><i className="bi bi-download" aria-hidden="true" /> {busy ? 'Working…' : 'Export backup'}</button><label className={`back-button backup-file-label${busy ? ' is-disabled' : ''}`}><i className="bi bi-upload" aria-hidden="true" /> Import backup<input type="file" accept="application/json,.json" onChange={importData} disabled={busy} /></label></div></section> : null}

    {isActivityPage && <ActivityPage />}

    {!isBackupPage && !isActivityPage && <>
      <section className="user-summary-grid" aria-label="User summary">
        {[
          { label: 'Total Users', count: usersSummary.totalUsers, icon: 'bi-people', tone: 'orange' },
          { label: 'Active Users', count: usersSummary.activeUsers, icon: 'bi-person-check', tone: 'green', note: 'With active login sessions' },
          { label: 'Admins & sub-admins', count: (usersSummary.administrators || 0) + (usersSummary.subAdmins || 0), icon: 'bi-shield-lock', tone: 'purple', note: `${usersSummary.subAdmins || 0} sub-admin${usersSummary.subAdmins === 1 ? '' : 's'}` },
          { label: 'Regular Users', count: usersSummary.regularUsers, icon: 'bi-person', tone: 'blue' },
        ].map((card) => <article className={`user-summary-card user-summary-${card.tone}`} key={card.label}><span className="user-summary-icon"><i className={`bi ${card.icon}`} aria-hidden="true" /></span><div><span>{card.label}</span><strong>{usersLoading ? '…' : Number(card.count || 0).toLocaleString('en-IN')}</strong>{card.note && <small>{card.note}</small>}</div></article>)}
      </section>
      <section className="user-management-panel">
        <div className="user-management-toolbar"><label className="user-search"><span>Search users</span><span className="user-search-input"><i className="bi bi-search" aria-hidden="true" /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search by name or email" /></span></label><label className="user-role-filter"><span>Role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">All roles</option><option value="admin">Administrator</option><option value="subadmin">Sub-admin</option><option value="user">Team member</option></select></label><button type="button" className="user-clear-filter" onClick={() => { setUserSearch(''); setRoleFilter('') }} disabled={!userSearch && !roleFilter}>Clear filters</button><span className="user-result-count">{usersLoading ? 'Loading users…' : `${visibleUsers.length} of ${users.length} users`}</span></div>
        {usersLoadError && !usersLoading && <div className="user-load-error" role="alert"><i className="bi bi-exclamation-circle" aria-hidden="true" /><span>{usersLoadError}</span><button type="button" onClick={retryUsersLoad}>Retry</button></div>}
        <div className="user-table-wrap">
          <table className="user-management-table"><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Created date</th><th>Actions</th></tr></thead><tbody>
            {usersLoading ? Array.from({ length: 5 }, (_, index) => <tr className="user-skeleton-row" key={index}><td colSpan="5"><span /></td></tr>) : visibleUsers.map((user) => { const createdAt = user.createdAt ? new Date(user.createdAt) : null; const createdDate = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleDateString() : '—'; return <tr className={user.role !== 'user' ? 'user-primary-admin' : ''} key={user._id}><td><div className="managed-user-cell"><UserAvatar user={user} /><span><strong>{user.name}</strong><small>{roleDescription(user.role)}</small></span>{user.role === 'admin' && <span className="primary-admin-label">Primary</span>}</div></td><td className="managed-user-email">{user.email}</td><td><span className={`managed-user-role managed-user-role-${user.role}`}>{roleBadge(user.role)}</span></td><td>{createdDate}</td><td><div className="managed-user-actions">{!canManage(user) ? <span className="primary-admin-protected"><i className="bi bi-shield-lock" aria-hidden="true" /> Protected</span> : <><button type="button" className="user-action-edit" onClick={() => openEditUser(user)} aria-label={`Edit ${user.name}`}><i className="bi bi-pencil-square" aria-hidden="true" /> Edit</button><button type="button" className="user-action-delete" onClick={() => setUserToDelete(user)} aria-label={`Delete ${user.name}`}><i className="bi bi-trash3" aria-hidden="true" /></button></>}</div></td></tr> })}
            {!usersLoading && !error && visibleUsers.length === 0 && <tr><td colSpan="5"><div className="user-empty-state"><span><i className="bi bi-person-lines-fill" aria-hidden="true" /></span><strong>{users.length ? 'No users match these filters' : 'No users yet'}</strong><small>{users.length ? 'Try another name or role, or clear the filters.' : 'Add a user to get started with your team.'}</small>{users.length > 0 && <button type="button" onClick={() => { setUserSearch(''); setRoleFilter('') }}>Clear filters</button>}</div></td></tr>}
          </tbody></table>
        </div>
        <div className="user-mobile-list">
          {usersLoading ? Array.from({ length: 4 }, (_, index) => <div className="user-mobile-skeleton" key={index} />) : visibleUsers.map((user) => <article className={`user-mobile-card${user.role !== 'user' ? ' is-primary-admin' : ''}`} key={user._id}><div className="user-mobile-card-top"><div className="managed-user-cell"><UserAvatar user={user} /><span><strong>{user.name}</strong><small>{roleDescription(user.role)}</small></span></div><span className={`managed-user-role managed-user-role-${user.role}`}>{roleBadge(user.role)}</span></div><p>{user.email}</p><small>Created {user.createdAt && !Number.isNaN(new Date(user.createdAt).getTime()) ? new Date(user.createdAt).toLocaleDateString() : '—'}</small><div className="managed-user-actions">{!canManage(user) ? <span className="primary-admin-protected"><i className="bi bi-shield-lock" aria-hidden="true" /> {user.role === 'admin' ? 'Primary admin protected' : 'Managed by the primary admin'}</span> : <><button type="button" className="user-action-edit" onClick={() => openEditUser(user)}><i className="bi bi-pencil-square" aria-hidden="true" /> Edit</button><button type="button" className="user-action-delete" onClick={() => setUserToDelete(user)}><i className="bi bi-trash3" aria-hidden="true" /> Delete</button></>}</div></article>)}
          {!usersLoading && !error && visibleUsers.length === 0 && <div className="user-empty-state"><span><i className="bi bi-person-lines-fill" aria-hidden="true" /></span><strong>{users.length ? 'No users match these filters' : 'No users yet'}</strong><small>{users.length ? 'Try another name or role, or clear the filters.' : 'Add a user to get started with your team.'}</small></div>}
        </div>
      </section>
    </>}

    {!isBackupPage && !isActivityPage && <dialog className="user-create-dialog" ref={createUserDialogRef} onClose={() => setCreateUserOpen(false)} aria-labelledby="create-user-title">
      <header className="user-dialog-header"><div><span className="activity-eyebrow">TEAM ACCESS</span><h2 id="create-user-title">Create user account</h2><p>Add a team member or sub-admin to your workspace.</p></div><button type="button" className="activity-dialog-close" onClick={() => createUserDialogRef.current?.close()} aria-label="Close create user dialog"><i className="bi bi-x-lg" aria-hidden="true" /></button></header>
      <form className="user-create-form" onSubmit={createUser}>
        {error && <p className="api-error" role="alert">{error}</p>}
        <label>Full name<input className="form-control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength="100" autoComplete="name" required /></label>
        <label>Email address<input className="form-control" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required /></label>
        <label>Temporary password<span className="user-password-control"><input className="form-control" type={showPassword ? 'text' : 'password'} minLength="12" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" /></button></span></label>
        <div className="user-password-actions"><button type="button" className="user-password-secondary" onClick={generatePassword}><i className="bi bi-shuffle" aria-hidden="true" /> Generate secure password</button><button type="button" className="user-password-secondary" onClick={copyPassword} disabled={!form.password}><i className="bi bi-copy" aria-hidden="true" /> Copy password</button></div>
        <div className="user-password-warning"><i className="bi bi-shield-exclamation" aria-hidden="true" /><span>Share temporary passwords securely. Users should change their password after signing in.</span></div>
        {isPrimaryAdmin && <RoleChooser value={form.role} onChange={(role) => setForm({ ...form, role })} disabled={busy} />}
        <label className="user-photo-field">Profile picture <input ref={createProfileFileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setProfileFile(event.target.files?.[0] || null)} /><small>Optional. JPG, PNG, or WebP up to 900 KB.</small></label>
        <footer className="user-dialog-actions"><button type="button" className="back-button" disabled={busy} onClick={() => createUserDialogRef.current?.close()}>Cancel</button><button className="continue-btn" disabled={busy}>{busy ? <><span className="user-button-spinner" /> Creating…</> : <><i className="bi bi-person-plus" aria-hidden="true" /> {form.role === 'subadmin' ? 'Create sub-admin' : 'Create user'}</>}</button></footer>
      </form>
    </dialog>}

    {editingUser && <Modal className="dealer-delete-dialog user-edit-dialog" busy={busy} onClose={() => setEditingUser(null)} labelledBy="user-edit-title"><h2 id="user-edit-title">Edit {roleLabel(editingUser.role).toLowerCase()}</h2>{error && <p className="api-error" role="alert">{error}</p>}<form className="settings-user-form" onSubmit={updateUser}><label>Name<input className="form-control" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required /></label><label>Email<input className="form-control" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required /></label>{isPrimaryAdmin && <RoleChooser value={editForm.role} onChange={(role) => setEditForm({ ...editForm, role })} disabled={busy} />}<label>New profile picture<input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setEditProfileFile(event.target.files?.[0] || null)} /></label><div className="dealer-delete-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setEditingUser(null)}>Cancel</button><button className="continue-btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></div></form></Modal>}
    {userToDelete && <Modal role="alertdialog" busy={busy} onClose={() => setUserToDelete(null)} labelledBy="user-delete-title" describedBy="user-delete-description"><div className="dealer-delete-icon"><i className="bi bi-trash3" aria-hidden="true" /></div><h2 id="user-delete-title">Delete user?</h2><p id="user-delete-description">Delete <strong>{userToDelete.name}</strong> ({userToDelete.email})? They will lose access to the workspace immediately. This action cannot be undone.</p><div className="dealer-delete-actions"><button type="button" className="back-button" disabled={busy} onClick={() => setUserToDelete(null)} data-autofocus>Cancel</button><button type="button" className="confirm-delete-btn" disabled={busy} onClick={removeUser}>{busy ? 'Deleting…' : 'Delete user'}</button></div></Modal>}
  </section>
}
