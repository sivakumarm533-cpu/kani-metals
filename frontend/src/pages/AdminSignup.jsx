import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import './pages.css'

const allowedEmail = 'sivakumar.m533@gmail.com'

export default function AdminSignup() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [adminExists, setAdminExists] = useState(null)
  const [phase, setPhase] = useState('request')
  const [code, setCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { apiRequest('/auth/status').then((status) => setAdminExists(Boolean(status.adminExists))).catch((err) => setError(err.message)) }, [])

  async function requestCode() {
    setBusy(true); setError(''); setMessage('')
    try { const result = await apiRequest('/auth/request-verification', { method: 'POST', body: JSON.stringify({ email: allowedEmail }) }); setMessage(result.message); setPhase('verify') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function verifyCode(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await apiRequest('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email: allowedEmail, code }) }); setVerificationToken(result.verificationToken); setPhase('create') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function createAdmin(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const auth = await apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify({ verificationToken, name, password }) }); signIn(auth); navigate('/dashboard', { replace: true }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-mark">KM</div><h1>Admin setup</h1><p>One-time setup for the authorized owner account.</p>{error && <div className="api-error" role="alert">{error}</div>}{message && <p className="auth-message" role="status">{message}</p>}
    {adminExists ? <><p>Admin setup is already complete. Sign in to continue.</p><Link className="continue-btn auth-link-button" to="/login">Go to sign in</Link></> : <>
      <p className="auth-allowed-email">Authorized email: <strong>{allowedEmail}</strong></p>
      {phase === 'request' && <button type="button" className="continue-btn" disabled={busy || adminExists === null} onClick={requestCode}>{busy ? 'Sending code…' : 'Send Gmail verification code'}</button>}
      {phase === 'verify' && <form onSubmit={verifyCode}><label>6-digit email code<input className="form-control" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(e) => setCode(e.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify email'}</button></form>}
      {phase === 'create' && <form onSubmit={createAdmin}><label>Admin name<input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Create password<input className="form-control" type="password" minLength="12" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><small>Use at least 12 characters.</small></label><button className="continue-btn" disabled={busy}>{busy ? 'Creating account…' : 'Create admin account'}</button></form>}
    </>}
    <Link to="/login">Already have an account? Sign in</Link>
  </section></main>
}
