/** Skeleton shown while a page chunk or the signed-in account is loading. */
export default function PageLoader({ fullScreen = false, label = 'Loading…' }) {
  return (
    <div className={`page-loader${fullScreen ? ' page-loader-full' : ''}`} role="status" aria-live="polite">
      {fullScreen ? <span className="page-loader-spinner" aria-hidden="true" /> : <>
        <span className="skeleton skeleton-line skeleton-title" aria-hidden="true" />
        <span className="skeleton skeleton-line" aria-hidden="true" />
        <span className="page-loader-grid" aria-hidden="true"><span className="skeleton skeleton-card" /><span className="skeleton skeleton-card" /><span className="skeleton skeleton-card" /></span>
      </>}
      <span className="visually-hidden">{label}</span>
    </div>
  )
}
