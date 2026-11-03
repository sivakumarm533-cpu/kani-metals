import mark from '../assets/logos/kani-metal-mark.webp'

/** Shared frame for the sign-in and admin setup screens. */
export default function AuthLayout({ title, intro, children }) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <img className="auth-mark" src={mark} alt="" width="52" height="52" />
          <span>Kani Metals<small>Admin panel</small></span>
        </div>
        <div className="auth-heading">
          <h1 id="auth-title">{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
        {children}
      </section>
    </main>
  )
}
