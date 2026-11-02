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
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try { const auth = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); signIn(auth); navigate(location.state?.from || '/dashboard', { replace: true }) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return <main className="auth-page"><form className="auth-card" onSubmit={submit}><div className="auth-mark">KM</div><h1>Sign in</h1><p>Access the Kani Metals admin panel.</p>{error && <div className="api-error" role="alert">{error}</div>}<label>Email<input className="form-control" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input className="form-control" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="continue-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><Link to="/signup">Set up authorized admin</Link></form></main>
}
