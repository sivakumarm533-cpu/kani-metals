import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { useAuth } from '../auth/authContextValue.js'
import AuthLayout from '../components/AuthLayout.jsx'

const REMEMBER_KEY = 'kani-remember-me'
const EMAIL_KEY = 'kani-last-email'
const readStored = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const writeStored = (key, value) => { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* storage unavailable */ } }

/** Asks the browser's password manager to save the sign-in (Chrome, Edge, Android). */
async function offerToSavePassword(email, password) {
  try {
    if (window.PasswordCredential && navigator.credentials?.store) await navigator.credentials.store(new window.PasswordCredential({ id: email, password }))
  } catch { /* the browser declined or does not support it */ }
}

const headings = {
  password: ['Sign in', 'Access the Kani Metals admin panel.'],
  enroll: ['Set up Google Authenticator', 'Scan the QR code, then verify one current code to enable two-step sign-in.'],
  totp: ['Verify your identity', 'Enter the current 6-digit code from Google Authenticator.'],
  recovery: ['Use a recovery code', 'Enter one unused recovery code from your saved list.'],
  'recovery-codes': ['Save recovery codes', 'Authenticator is enabled. Save these one-time recovery codes before continuing.'],
}

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [remember, setRemember] = useState(() => readStored(REMEMBER_KEY, 'true') !== 'false')
  const [email, setEmail] = useState(() => (readStored(REMEMBER_KEY, 'true') !== 'false' ? readStored(EMAIL_KEY, '') : ''))
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [mode, setMode] = useState('password')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [pendingAuth, setPendingAuth] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const destination = typeof location.state?.from === 'string' && location.state.from.startsWith('/') ? location.state.from : '/dashboard'

  if (!loading && user && mode !== 'recovery-codes') return <Navigate to={destination} replace />

  function finish(auth) {
    writeStored(REMEMBER_KEY, String(remember))
    writeStored(EMAIL_KEY, remember ? email.trim() : null)
    if (remember && password) offerToSavePassword(email.trim(), password)
    signIn(auth)
    navigate(destination, { replace: true })
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, remember }) })
      if (result.requiresTotpEnrollment) {
        setChallenge(result.enrollmentChallenge); setQrCodeDataUrl(result.qrCodeDataUrl); setCode(''); setMode('enroll'); return
      }
      if (result.requiresTotp) { setChallenge(result.loginChallenge); setCode(''); setMode('totp'); return }
      finish(result)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function verifyTotp(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const enrolling = mode === 'enroll'
      const endpoint = enrolling ? '/auth/totp/enroll/verify' : '/auth/totp/login/verify'
      const result = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify({ ...(enrolling ? { challenge, purpose: 'enrollment' } : { loginChallenge: challenge }), code }) })
      if (enrolling) {
        setQrCodeDataUrl('')
        setRecoveryCodes(result.recoveryCodes || [])
        setPendingAuth(result)
        setMode('recovery-codes')
        return
      }
      finish(result)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function verifyRecovery(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/totp/login/recovery', { method: 'POST', body: JSON.stringify({ loginChallenge: challenge, recoveryCode }) })
      finish(result)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function backToPassword() {
    setMode('password'); setChallenge(''); setCode(''); setRecoveryCode(''); setQrCodeDataUrl(''); setError('')
  }

  const [heading, intro] = headings[mode]
  const codeInput = (
    <label>6-digit authenticator code
      <input className="form-control code-input" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} required />
    </label>
  )

  return <AuthLayout title={heading} intro={intro}>
    {error && <div className="api-error" role="alert">{error}</div>}
    {mode === 'password' && <form onSubmit={submit} aria-busy={busy} method="post" action="/login" name="login">
      <label htmlFor="login-email">Email<input id="login-email" name="email" className="form-control" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus={!email} /></label>
      <label>Password
        <span className="password-field">
          <input id="login-password" name="password" className="form-control" type={showPassword ? 'text' : 'password'} autoComplete="current-password" autoFocus={Boolean(email)} value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" /></button>
        </span>
      </label>
      <label className="remember-me"><input type="checkbox" name="remember" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span><strong>Keep me signed in</strong><small>Stay signed in on this device for 30 days. Untick on shared computers.</small></span></label>
      <button className="continue-btn btn-block" disabled={busy}>{busy ? <><span className="btn-spinner" aria-hidden="true" /> Checking…</> : 'Sign in'}</button>
    </form>}
    {mode === 'enroll' && <form onSubmit={verifyTotp} aria-busy={busy}>
      {qrCodeDataUrl && <img className="totp-qr-code" src={qrCodeDataUrl} alt="Google Authenticator setup QR code" />}
      {codeInput}
      <button className="continue-btn btn-block" disabled={busy}>{busy ? 'Verifying…' : 'Verify and enable authenticator'}</button>
    </form>}
    {mode === 'totp' && <>
      <form onSubmit={verifyTotp} aria-busy={busy}>
        {codeInput}
        <button className="continue-btn btn-block" disabled={busy}>{busy ? 'Verifying…' : 'Verify and sign in'}</button>
      </form>
      <button type="button" className="link-button" onClick={() => { setMode('recovery'); setError('') }}>Lost your phone? Use a recovery code</button>
    </>}
    {mode === 'recovery' && <form onSubmit={verifyRecovery} aria-busy={busy}>
      <label>Recovery code<input className="form-control code-input" autoComplete="one-time-code" placeholder="XXXX-XXXX-XXXX-XXXX" autoFocus value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} required /></label>
      <button className="continue-btn btn-block" disabled={busy}>{busy ? 'Checking…' : 'Use recovery code'}</button>
    </form>}
    {mode === 'recovery-codes' && <>
      <div className="totp-recovery-codes" aria-label="One-time recovery codes">{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div>
      <button type="button" className="continue-btn btn-block" onClick={() => finish(pendingAuth)}>I saved my recovery codes</button>
    </>}
    {mode !== 'password' && mode !== 'recovery-codes' && <button type="button" className="back-button btn-block" disabled={busy} onClick={backToPassword}><i className="bi bi-arrow-left" aria-hidden="true" /> Back to sign in</button>}
    {mode === 'password' && <p className="auth-footnote">First-time owner setup? <Link to="/signup">Admin sign up / setup</Link></p>}
  </AuthLayout>
}
