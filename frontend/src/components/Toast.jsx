const defaultIcons = { success: 'bi-check-circle-fill', info: 'bi-pencil-square', danger: 'bi-exclamation-circle-fill' }

/** Renders the toast created by useToast. The key restarts the enter/exit animation for each message. */
export default function Toast({ toast }) {
  if (!toast?.message) return null
  return (
    <div key={toast.id} className={`app-toast app-toast-${toast.type}`} role="status" aria-live="polite">
      <i className={`bi ${toast.icon || defaultIcons[toast.type] || defaultIcons.success}`} aria-hidden="true" />
      <span>{toast.message}</span>
    </div>
  )
}
