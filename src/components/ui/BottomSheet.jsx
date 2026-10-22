import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// 下から出るシート（全画面で共通。2026-10-22）。上の帯や引っぱって更新の枠の重なり順に閉じ込められないよう、ページの直下に出す。
// Esc で閉じ、開いたらシートにフォーカスを移し、閉じたら開いたボタン（returnFocusRef）へ戻す。
export default function BottomSheet({ open, title, onClose, returnFocusRef, closeLabel = '閉じる', children }) {
  const sheetRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      onClose()
      returnFocusRef?.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    sheetRef.current?.focus()
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null

  return createPortal((
    <>
      <div className="ui-sheet-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="ui-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="ui-sheet__grip" />
        <div className="ui-sheet__head">
          <h2 className="ui-sheet__title">{title}</h2>
          {closeLabel && (
            <button type="button" onClick={onClose} className="ui-button ui-button--ghost">
              {closeLabel}
            </button>
          )}
        </div>
        {children}
      </div>
    </>
  ), document.body)
}
