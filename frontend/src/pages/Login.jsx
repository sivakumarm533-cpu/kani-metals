import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiRequest } from '../services/api.js'
import { useAuth } from '../auth/AuthContext.jsx'
import './pages.css'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [mode, setMode] = useState('password')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      if (result.requiresTotpEnrollment) {
        setChallenge(result.enrollmentChallenge); setQrCodeDataUrl(result.qrCodeDataUrl); setMode('enroll'); return
      }
      if (result.requiresTotp) { setChallenge(result.loginChallenge); setMode('totp'); return }
      signIn(result); navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function verifyTotp(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const endpoint = mode === 'enroll' ? '/auth/totp/enroll/verify' : '/auth/totp/login/verify'
      const result = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify({ ...(mode === 'enroll' ? { challenge, purpose: 'enrollment' } : { loginChallenge: challenge }), code }) })
      if (mode === 'enroll') {
        setQrCodeDataUrl('')
        setRecoveryCode(result.recoveryCodes?.join('\n') || '')
        setMode('recovery-codes')
        setPendingAuth(result)
        return
      }
      signIn(result); navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const [pendingAuth, setPendingAuth] = useState(null)

  async function verifyRecovery(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await apiRequest('/auth/totp/login/recovery', { method: 'POST', body: JSON.stringify({ loginChallenge: challenge, recoveryCode }) })
      signIn(result); navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function finishEnrollment() {
    signIn(pendingAuth)
    navigate(location.state?.from || '/dashboard', { replace: true })
  }

  function backToPassword() {
    setMode('password'); setChallenge(''); setCode(''); setRecoveryCode(''); setQrCodeDataUrl(''); setError('')
  }

  const heading = mode === 'password' ? 'Sign in' : mode === 'enroll' ? 'Set up Google Authenticator' : mode === 'recovery' ? 'Use a recovery code' : mode === 'recovery-codes' ? 'Save recovery codes' : 'Verify your identity'
  const intro = mode === 'password' ? 'Access the Kani Metals admin panel.' : mode === 'enroll' ? 'Scan the QR code, then verify one current code to enable two-step sign-in.' : mode === 'recovery' ? 'Enter one unused recovery code from your saved list.' : mode === 'recovery-codes' ? 'Authenticator is enabled. Save these one-time recovery codes before continuing.' : 'Enter the current 6-digit code from Google Authenticator.'

  return <main className="auth-page"><section className="auth-card"><div className="auth-mark">KM</div><h1>{heading}</h1><p>{intro}</p>
    {error && <div className="api-error" role="alert">{error}</div>}
    {mode === 'password' && <form onSubmit={submit}><label>Email<input className="form-control" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input className="form-control" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button></form>}
    {mode === 'enroll' && <form onSubmit={verifyTotp}>{qrCodeDataUrl && <img className="totp-qr-code" src={qrCodeDataUrl} alt="Google Authenticator setup QR code" />}<label>6-digit authenticator code<input className="form-control" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify and enable authenticator'}</button></form>}
    {mode === 'totp' && <><form onSubmit={verifyTotp}><label>6-digit authenticator code<input className="form-control" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify and sign in'}</button></form><button type="button" className="back-button" onClick={() => { setMode('recovery'); setError('') }}>Use a recovery code</button></>}
    {mode === 'recovery' && <form onSubmit={verifyRecovery}><label>Recovery code<input className="form-control" autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Checking…' : 'Use recovery code'}</button></form>}
    {mode === 'recovery-codes' && <><div className="totp-recovery-codes" aria-label="One-time recovery codes">{recoveryCode.split('\n').filter(Boolean).map((item) => <code key={item}>{item}</code>)}</div><button type="button" className="continue-btn" onClick={finishEnrollment}>I saved my recovery codes</button></>}
    {mode !== 'password' && mode !== 'recovery-codes' && <button type="button" className="back-button" disabled={busy} onClick={backToPassword}>Back to sign in</button>}
    {mode === 'password' && <Link to="/signup">Admin sign up / setup</Link>}
  </section></main>
}
