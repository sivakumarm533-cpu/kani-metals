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
  const [email, setEmail] = useState(allowedEmail)
  const [code, setCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    apiRequest('/auth/status')
      .then((status) => {
        if (status.adminExists) navigate('/login', { replace: true })
        else setAdminExists(false)
      })
      .catch((err) => setError(err.message))
  }, [navigate])
  useEffect(() => {
    if (resendSeconds <= 0) return undefined
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  async function requestCode() {
    setBusy(true); setError(''); setMessage('')
    try { const result = await apiRequest('/auth/send-otp', { method: 'POST', body: JSON.stringify({ email }) }); setMessage(result.message); setPhase('verify'); setResendSeconds(60) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function verifyCode(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const result = await apiRequest('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp: code }) }); setVerificationToken(result.signupToken); setPhase('create') }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function createAdmin(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const auth = await apiRequest('/auth/create-admin', { method: 'POST', body: JSON.stringify({ signupToken: verificationToken, name, password, confirmPassword }) }); signIn(auth); navigate('/dashboard', { replace: true }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-mark">KM</div><h1>Admin setup</h1><p>One-time setup for the authorized owner account.</p>{error && <div className="api-error" role="alert">{error}</div>}{message && <p className="auth-message" role="status">{message}</p>}
    {adminExists ? <><p>Admin setup is already complete. Sign in to continue.</p><Link className="continue-btn auth-link-button" to="/login">Go to sign in</Link></> : <>
      <label>Authorized Gmail address<input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      {phase === 'request' && <button type="button" className="continue-btn" disabled={busy || adminExists === null} onClick={requestCode}>{busy ? 'Sending code…' : 'Send 6-digit Gmail OTP'}</button>}
      {phase === 'verify' && <><form onSubmit={verifyCode}><label>6-digit email code<input className="form-control" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={code} onChange={(e) => setCode(e.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify OTP'}</button></form><button type="button" className="back-button" disabled={busy || resendSeconds > 0} onClick={requestCode}>{resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : 'Resend OTP'}</button></>}
      {phase === 'create' && <form onSubmit={createAdmin}><label>Admin name<input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Create password<input className="form-control" type="password" minLength="12" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required /><small>Use at least 12 characters.</small></label><label>Confirm password<input className="form-control" type="password" minLength="12" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Creating account…' : 'Create admin account'}</button></form>}
    </>}
    <Link to="/login">Already have an account? Sign in</Link>
  </section></main>
}
