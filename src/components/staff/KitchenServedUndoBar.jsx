export default function KitchenServedUndoBar({ undoState, undoing, onDismiss, onUndo }) {
  if (!undoState) return null

  return (
    <div className="staff-kitchen-undo" role="status">
      <div className="staff-kitchen-undo__text">
        <span className="staff-kitchen-undo__label">提供済み</span>
        <strong>{undoState.label}</strong>
      </div>
      <div className="staff-kitchen-undo__actions">
        <button
          type="button"
          className="staff-kitchen-undo__button"
          disabled={undoing}
          onClick={onUndo}
        >
          {undoing ? '戻し中' : '戻す'}
        </button>
        <button
          type="button"
          className="staff-kitchen-undo__dismiss"
          aria-label="提供済みUndo表示を閉じる"
          disabled={undoing}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
    </div>
  )
}
