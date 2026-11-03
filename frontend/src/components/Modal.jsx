import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal shell used by the confirmation and form dialogs.
 * Moves focus into the dialog, keeps Tab inside it, closes on Escape or backdrop
 * click (unless `busy`), locks page scrolling and restores focus on close.
 */
export default function Modal({ onClose, busy = false, labelledBy, describedBy, role = 'dialog', className = 'dealer-delete-dialog', backdropClassName = '', children }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)

  useEffect(() => {
    onCloseRef.current = onClose
    busyRef.current = busy
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current
    const first = dialog?.querySelector('[data-autofocus]') || dialog?.querySelector(focusableSelector)
    first?.focus({ preventScroll: true })
    document.body.classList.add('modal-open')

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busyRef.current) {
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = [...dialog.querySelectorAll(focusableSelector)].filter((item) => item.offsetParent !== null)
      if (!items.length) return
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true })
    }
  }, [])

  // Rendered into <body> so the overlay always covers the whole screen, whatever
  // transforms or overflow settings the page around it uses.
  return createPortal(
    <div
      className={`dealer-delete-backdrop ${backdropClassName}`.trim()}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose?.() }}
    >
      <section ref={dialogRef} className={className} role={role} aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy}>
        {children}
      </section>
    </div>,
    document.body,
  )
}
