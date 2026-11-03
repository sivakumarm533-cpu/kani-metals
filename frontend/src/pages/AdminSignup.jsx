import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { useAuth } from '../auth/authContextValue.js'
import AuthLayout from '../components/AuthLayout.jsx'

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
    let active = true
    apiRequest('/auth/status').then((status) => {
      if (!active) return
      setAdminExists(Boolean(status.adminExists))
      if (!status.adminExists) setEmail(status.signupEmail || '')
    }).catch((err) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [])

  async function beginEnrollment(event) {
    event.preventDefault()
    if (password !== confirmPassword) { setError('Password and confirmation do not match.'); return }
    setBusy(true); setError('')
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

  return <AuthLayout title="Admin setup" intro={adminExists === false && !challenge && !auth ? 'Set up the authorized owner account and connect Google Authenticator.' : null}>
    {error && <div className="api-error" role="alert">{error}</div>}
    {adminExists === null && !error && <p className="auth-status"><span className="btn-spinner btn-spinner-dark" aria-hidden="true" /> Checking admin setup…</p>}
    {adminExists && <p className="auth-status">Admin setup is already complete. Sign in to continue.</p>}
    {adminExists === false && !challenge && !auth && <form onSubmit={beginEnrollment} aria-busy={busy}>
      <label>Authorized email<input className="form-control" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Admin name<input className="form-control" value={name} maxLength="100" autoComplete="name" onChange={(event) => setName(event.target.value)} required /></label>
      <label>Create password<input className="form-control" type="password" minLength="12" maxLength="128" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><small>Use at least 12 characters.</small></label>
      <label>Confirm password<input className="form-control" type="password" minLength="12" maxLength="128" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
      <label>One-time setup key<input className="form-control" type="password" autoComplete="off" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} required /><small>Get this key from the application owner. It is configured on the backend and is not emailed.</small></label>
      <button className="continue-btn btn-block" disabled={busy || adminExists === null}>{busy ? 'Preparing authenticator…' : 'Continue to authenticator setup'}</button>
    </form>}
    {challenge && !auth && <form onSubmit={verifyEnrollment} aria-busy={busy}>
      <p className="auth-status">Scan this QR code with Google Authenticator. Your secret stays in the application until you verify a current code.</p>
      {qrCodeDataUrl && <img className="totp-qr-code" src={qrCodeDataUrl} alt="Google Authenticator setup QR code" />}
      <label>6-digit authenticator code<input className="form-control code-input" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required /></label>
      <button className="continue-btn btn-block" disabled={busy}>{busy ? 'Verifying code…' : 'Verify and enable authenticator'}</button>
    </form>}
    {auth && <>
      <p className="auth-status">Authenticator is enabled. Save these recovery codes somewhere private. Each code works once.</p>
      <div className="totp-recovery-codes" aria-label="One-time recovery codes">{recoveryCodes.map((recoveryCode) => <code key={recoveryCode}>{recoveryCode}</code>)}</div>
      <button type="button" className="continue-btn btn-block" onClick={finishSetup}>I saved my recovery codes</button>
    </>}
    {!auth && <div className="auth-signin-footer"><span>{adminExists ? 'Ready to continue?' : 'Already have an account?'}</span><Link className="back-button btn-block" to="/login">Sign in</Link></div>}
  </AuthLayout>
}
