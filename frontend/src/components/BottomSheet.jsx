import { useEffect, useId, useRef } from 'react'
import Modal from './Modal.jsx'

/**
 * Android-style sheet that slides up from the bottom. Closes with the phone's
 * Back button (it adds one history entry while open), Escape, the backdrop, or
 * by dragging the handle down. Focus is kept inside while open (Modal).
 */
export default function BottomSheet({ title, onClose, children, className = '' }) {
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const mounted = useRef(false)
  const sheetRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    mounted.current = true
    // One history entry for the open sheet, so Back closes it instead of leaving the page.
    if (!window.history.state?.kaniSheet) window.history.pushState({ ...window.history.state, kaniSheet: true }, '')
    const onPop = () => { if (!window.history.state?.kaniSheet) onCloseRef.current?.() }
    window.addEventListener('popstate', onPop)
    return () => {
      mounted.current = false
      window.removeEventListener('popstate', onPop)
      // Closed by a button or Escape: remove our history entry. Deferred so React's
      // development double-mount does not close the sheet straight away.
      window.setTimeout(() => { if (!mounted.current && window.history.state?.kaniSheet) window.history.back() }, 0)
    }
  }, [])

  function startDrag(event) {
    drag.current = { y: event.clientY, delta: 0 }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  function moveDrag(event) {
    if (!drag.current || !sheetRef.current) return
    drag.current.delta = Math.max(0, event.clientY - drag.current.y)
    sheetRef.current.style.transform = `translateY(${drag.current.delta}px)`
  }
  function endDrag() {
    if (!drag.current || !sheetRef.current) return
    const { delta } = drag.current
    drag.current = null
    sheetRef.current.style.transform = ''
    if (delta > 90) onClose()
  }

  return (
    <Modal className={`bottom-sheet ${className}`.trim()} backdropClassName="bottom-sheet-backdrop" onClose={onClose} labelledBy={titleId}>
      <div ref={sheetRef} className="bottom-sheet-inner">
        <div className="bottom-sheet-grip" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <span className="bottom-sheet-handle" aria-hidden="true" />
          <div className="bottom-sheet-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="bottom-sheet-close" aria-label="Close" onClick={onClose}><i className="bi bi-x-lg" aria-hidden="true" /></button>
          </div>
        </div>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </Modal>
  )
}
