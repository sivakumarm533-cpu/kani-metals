import { useId } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import Modal from './Modal.jsx'

/*
 * Small shared building blocks. Styles live in styles/app-shell.css and use the
 * theme tokens, so every theme works without extra CSS.
 */

/** Page title row: eyebrow, title, optional description and actions (right on desktop, wrapped on phones). */
export function PageHeader({ eyebrow, title, description, actions, className = '' }) {
  return (
    <header className={`page-header ui-page-header ${className}`.trim()}>
      <div className="ui-page-header-text">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="ui-page-actions">{actions}</div>}
    </header>
  )
}

/** A figure with label: used for money totals and counts. `tone`: primary, success, warning, danger. */
export function StatCard({ icon, label, value, note, tone = 'primary', to, loading = false }) {
  const body = (
    <>
      <span className={`ui-stat-icon is-${tone}`} aria-hidden="true"><i className={`bi ${icon}`} /></span>
      <span className="ui-stat-label">{label}</span>
      <strong className="ui-stat-value">{loading ? <span className="skeleton skeleton-number" aria-label="Loading" /> : value}</strong>
      {note && <small className="ui-stat-note">{note}</small>}
    </>
  )
  return to ? <Link className={`ui-stat is-${tone}`} to={to}>{body}</Link> : <div className={`ui-stat is-${tone}`}>{body}</div>
}

/** Coloured pill with an icon and words, so state is never shown by colour alone. */
export function StatusBadge({ tone = 'neutral', icon, children }) {
  return <span className={`ui-badge is-${tone}`}>{icon && <i className={`bi ${icon}`} aria-hidden="true" />}{children}</span>
}

export function SearchInput({ value, onChange, placeholder = 'Search', label = 'Search', className = '' }) {
  return (
    <label className={`ui-search ${className}`.trim()}>
      <i className="bi bi-search" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} enterKeyHint="search" />
      {value && <button type="button" className="ui-search-clear" aria-label="Clear search" onClick={() => onChange('')}><i className="bi bi-x-lg" aria-hidden="true" /></button>}
    </label>
  )
}

/** One-choice chips that scroll sideways on phones. `options`: [[id, label]]. */
export function FilterChips({ options, value, onChange, label }) {
  return (
    <div className="ui-chips" role="radiogroup" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" role="radio" aria-checked={value === id} className={`ui-chip${value === id ? ' is-active' : ''}`} onClick={() => onChange(id)}>{text}</button>
      ))}
    </div>
  )
}

export function EmptyState({ icon = 'bi-inbox', title, text, action }) {
  return (
    <div className="ui-empty">
      <span className="ui-empty-icon" aria-hidden="true"><i className={`bi ${icon}`} /></span>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function SkeletonLoader({ rows = 3, variant = 'row' }) {
  return <div className={`ui-skeleton-list is-${variant}`} aria-hidden="true">{Array.from({ length: rows }, (_, index) => <span key={index} className="skeleton" />)}</div>
}

/**
 * Action button that floats above the phone bottom bar (hidden on larger screens).
 * Rendered into <body> so page animations or containers can never move it.
 */
export function FloatingActionButton({ icon = 'bi-plus-lg', label, onClick, to }) {
  const content = <><i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span></>
  const button = to ? <Link className="ui-fab" to={to}>{content}</Link> : <button type="button" className="ui-fab" onClick={onClick}>{content}</button>
  return createPortal(button, document.body)
}

/** Accessible yes/no question. `tone="danger"` for destructive actions. */
export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', busy = false, onConfirm, onCancel, children }) {
  const titleId = useId()
  const textId = useId()
  return (
    <Modal role="alertdialog" className="dealer-delete-dialog ui-confirm" busy={busy} onClose={onCancel} labelledBy={titleId} describedBy={textId}>
      <span className={`ui-confirm-icon is-${tone}`} aria-hidden="true"><i className={`bi ${tone === 'danger' ? 'bi-exclamation-triangle' : 'bi-question-circle'}`} /></span>
      <h2 id={titleId}>{title}</h2>
      <p id={textId}>{message}</p>
      {children}
      <div className="ui-confirm-actions">
        <button type="button" className="back-button" disabled={busy} onClick={onCancel} data-autofocus>{cancelLabel}</button>
        <button type="button" className={tone === 'danger' ? 'confirm-delete-btn' : 'continue-btn'} disabled={busy} onClick={onConfirm}>{busy ? 'Please wait…' : confirmLabel}</button>
      </div>
    </Modal>
  )
}
