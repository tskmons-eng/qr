export default function OptionModalActions({ canConfirm, confirmLabel, onCancel, onConfirm }) {
  return (
    <div className="option-modal__actions">
      <button type="button" onClick={onCancel} className="option-modal__button">
        キャンセル
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={!canConfirm}
        className="option-modal__button option-modal__button--primary"
      >
        {confirmLabel}
      </button>
    </div>
  )
}
