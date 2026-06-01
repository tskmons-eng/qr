export default function TableCancelModal({
  item,
  passcode,
  passcodeError,
  cancelling,
  onPasscodeChange,
  onConfirm,
  onClose,
}) {
  if (!item) return null

  return (
    <div className="staff-table-modal-backdrop">
      <div className="staff-table-cancel-dialog">
        <h3 className="staff-table-modal-title">注文をキャンセル</h3>
        <p className="staff-table-modal-body">
          「{item.productNameSnapshot} × {item.quantity}」をキャンセルします。
        </p>
        <label className="staff-table-modal-label">管理者パスコード</label>
        <input
          type="password"
          inputMode="numeric"
          value={passcode}
          onChange={event => onPasscodeChange(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && onConfirm()}
          placeholder="パスコード"
          className="staff-table-passcode-input"
        />
        {passcodeError && <p className="staff-table-error">{passcodeError}</p>}
        <div className="staff-table-modal-actions">
          <button type="button" onClick={onClose} className="staff-table-modal-button staff-table-modal-button-secondary">
            戻る
          </button>
          <button type="button" onClick={onConfirm} disabled={cancelling} className="staff-table-modal-button staff-table-modal-button-danger">
            {cancelling ? '処理中...' : 'キャンセル確定'}
          </button>
        </div>
      </div>
    </div>
  )
}
