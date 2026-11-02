import { useEffect, useState } from 'react'
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
  const [loginChallenge, setLoginChallenge] = useState('')
  const [otp, setOtp] = useState('')
  const [requiresOtp, setRequiresOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [demoEnabled, setDemoEnabled] = useState(false)
  const [demoCredentials, setDemoCredentials] = useState(null)

  useEffect(() => {
    if (import.meta.env.DEV) apiRequest('/auth/status').then((status) => { setDemoEnabled(status.demoLoginEnabled); setDemoCredentials(status.demoCredentials || null) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (resendSeconds <= 0) return undefined
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendSeconds])

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const auth = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      if (auth.requiresOtp) { setLoginChallenge(auth.loginChallenge); setRequiresOtp(true); return }
      signIn(auth); navigate(location.state?.from || '/dashboard', { replace: true })
    }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function sendOtp() {
    setBusy(true); setError(''); setMessage('')
    try { const result = await apiRequest('/auth/send-login-otp', { method: 'POST', body: JSON.stringify({ loginChallenge }) }); setOtpSent(true); setResendSeconds(60); setMessage(result.message) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function verifyOtp(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const auth = await apiRequest('/auth/verify-login-otp', { method: 'POST', body: JSON.stringify({ loginChallenge, otp }) }); signIn(auth); navigate(location.state?.from || '/dashboard', { replace: true }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function signInDemo() {
    setBusy(true); setError('')
    try { const auth = await apiRequest('/auth/demo-login', { method: 'POST', body: JSON.stringify(demoCredentials) }); signIn(auth); navigate('/dashboard', { replace: true }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <main className="auth-page"><section className="auth-card"><div className="auth-mark">KM</div><h1>{requiresOtp ? 'Verify admin login' : 'Sign in'}</h1><p>{requiresOtp ? 'Admin password verified. Complete email verification to continue.' : 'Access the Kani Metals admin panel.'}</p>{error && <div className="api-error" role="alert">{error}</div>}{message && <p className="auth-message" role="status">{message}</p>}
    {!requiresOtp ? <><form onSubmit={submit}><label>Email<input className="form-control" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input className="form-control" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button></form>{import.meta.env.DEV && demoEnabled && demoCredentials && <div className="demo-login-card"><strong>Local demo credentials</strong><span>Email: {demoCredentials.email}</span><span>Password: {demoCredentials.password}</span><button type="button" className="demo-login-button" onClick={signInDemo} disabled={busy}>{busy ? 'Signing in…' : 'Sign in with demo account'}</button></div>}</> : <><button type="button" className="continue-btn" onClick={sendOtp} disabled={busy || resendSeconds > 0}>{busy ? 'Sending code…' : resendSeconds > 0 ? `Resend OTP in ${resendSeconds}s` : otpSent ? 'Resend Gmail OTP' : 'Send 6-digit Gmail OTP'}</button>{otpSent && <form onSubmit={verifyOtp}><label>6-digit Gmail OTP<input className="form-control" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={otp} onChange={(e) => setOtp(e.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify OTP and sign in'}</button></form>}<button type="button" className="back-button" onClick={() => { setRequiresOtp(false); setOtpSent(false); setOtp(''); setLoginChallenge('') }}>Back to sign in</button></>}
    <Link to="/signup">Set up authorized admin</Link></section></main>
}
