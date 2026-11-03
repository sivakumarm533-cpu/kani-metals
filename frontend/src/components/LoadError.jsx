/** Inline error banner with an optional retry button. */
export default function LoadError({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="api-error api-error-row" role="alert">
      <i className="bi bi-exclamation-circle" aria-hidden="true" />
      <span>{message}</span>
      {onRetry && <button type="button" className="back-button" onClick={onRetry}>Retry</button>}
    </div>
  )
}
