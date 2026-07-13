import { useEffect, useId, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function AdminSalesModal({
  busy = false,
  children,
  closeDisabled = false,
  onClose,
  open,
  title,
  variant = 'sheet',
}) {
  const generatedTitleId = useId()
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const closeDisabledRef = useRef(closeDisabled)
  const onCloseRef = useRef(onClose)
  const returnFocusRef = useRef(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    closeDisabledRef.current = closeDisabled
  }, [closeDisabled])

  useEffect(() => {
    if (!open) return undefined

    returnFocusRef.current = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!closeDisabledRef.current) onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])]
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="admin-sales-modal__backdrop"
      onMouseDown={event => {
        if (!closeDisabled && event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        aria-labelledby={generatedTitleId}
        aria-modal="true"
        aria-busy={busy || undefined}
        className={`admin-sales-modal admin-sales-modal--${variant}`}
        role="dialog"
        tabIndex={-1}
      >
        <header className="admin-sales-modal__header">
          <h3 className="admin-sales-modal__title" id={generatedTitleId}>{title}</h3>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="閉じる"
            className="admin-sales-modal__close"
            disabled={closeDisabled}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="admin-sales-modal__body">{children}</div>
      </section>
    </div>
  )
}
