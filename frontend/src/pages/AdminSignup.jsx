import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import './pages.css'

export default function AdminSignup() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [adminExists, setAdminExists] = useState(null)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [setupKey, setSetupKey] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [auth, setAuth] = useState(null)
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    apiRequest('/auth/status').then((status) => {
      setAdminExists(Boolean(status.adminExists))
      if (!status.adminExists) setEmail(status.signupEmail || '')
    }).catch((err) => setError(err.message))
  }, [navigate])

  async function beginEnrollment(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/totp/enroll', { method: 'POST', body: JSON.stringify({ email, name, password, confirmPassword, setupKey }) })
      setChallenge(result.challenge); setQrCodeDataUrl(result.qrCodeDataUrl)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function verifyEnrollment(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/totp/enroll/verify', { method: 'POST', body: JSON.stringify({ challenge, code }) })
      setAuth(result); setRecoveryCodes(result.recoveryCodes || []); setQrCodeDataUrl('')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function finishSetup() {
    signIn(auth)
    navigate('/dashboard', { replace: true })
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-mark">KM</div><h1>Admin setup</h1>
    {error && <div className="api-error" role="alert">{error}</div>}
    {adminExists === null && <p>Checking admin setup…</p>}
    {adminExists && <p>Admin setup is already complete. Sign in to continue.</p>}
    {adminExists === false && !challenge && !auth && <>
      <p>Set up the authorized owner account and connect Google Authenticator.</p>
      <form onSubmit={beginEnrollment}>
        <label>Authorized email<input className="form-control" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Admin name<input className="form-control" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label>Create password<input className="form-control" type="password" minLength="12" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><small>Use at least 12 characters.</small></label>
        <label>Confirm password<input className="form-control" type="password" minLength="12" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        <label>One-time setup key<input className="form-control" type="password" autoComplete="off" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} required /><small>Get this key from the application owner. It is configured on the backend and is not emailed.</small></label>
        <button className="continue-btn" disabled={busy || adminExists === null}>{busy ? 'Preparing authenticator…' : 'Continue to authenticator setup'}</button>
      </form>
    </>}
    {challenge && !auth && <form onSubmit={verifyEnrollment}>
      <p>Scan this QR code with Google Authenticator. Your secret stays in the application until you verify a current code.</p>
      {qrCodeDataUrl && <img className="totp-qr-code" src={qrCodeDataUrl} alt="Google Authenticator setup QR code" />}
      <label>6-digit authenticator code<input className="form-control" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label>
      <button className="continue-btn" disabled={busy}>{busy ? 'Verifying code…' : 'Verify and enable authenticator'}</button>
    </form>}
    {auth && <>
      <p>Authenticator is enabled. Save these recovery codes somewhere private. Each code works once.</p>
      <div className="totp-recovery-codes" aria-label="One-time recovery codes">{recoveryCodes.map((recoveryCode) => <code key={recoveryCode}>{recoveryCode}</code>)}</div>
      <button type="button" className="continue-btn" onClick={finishSetup}>I saved my recovery codes</button>
    </>}
    {!auth && <div className="auth-signin-footer"><span>{adminExists ? 'Ready to continue?' : 'Already have an account?'}</span><Link className="continue-btn auth-link-button" to="/login">Sign in</Link></div>}
  </section></main>
}
