export default function TableCancelModal({
  item,
  passcodeRequired = true,
  passcodeSet = true,
  passcode,
  passcodeError,
  cancelling,
  onPasscodeChange,
  onConfirm,
  onClose,
}) {
  if (!item) return null
  const blocked = passcodeRequired && !passcodeSet

  return (
    <div className="staff-table-modal-backdrop">
      <div className="staff-table-cancel-dialog">
        <h3 className="staff-table-modal-title">注文をキャンセル</h3>
        <p className="staff-table-modal-body">
          「{item.productNameSnapshot} × {item.quantity}」をキャンセルします。注文ミス用のキャンセルとして履歴に残します。
        </p>
        {!passcodeRequired && (
          <p className="staff-table-modal-note">メニュー管理の権限があるため、パスコード入力は不要です。</p>
        )}
        {blocked && (
          <p className="staff-table-modal-warning">
            取消パスコードが未設定です。メニュー管理の権限がある人に取り消してもらうか、店舗設定でパスコードを決めてください。
          </p>
        )}
        {passcodeRequired && !blocked && (
          <>
            <label className="staff-table-modal-label" htmlFor="staff-cancel-passcode">取消パスコード</label>
            <input
              id="staff-cancel-passcode"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={passcode}
              onChange={event => onPasscodeChange(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && onConfirm()}
              placeholder="パスコード"
              className="staff-table-passcode-input"
            />
          </>
        )}
        {passcodeError && <p className="staff-table-error">{passcodeError}</p>}
        <div className="staff-table-modal-actions">
          <button type="button" onClick={onClose} className="staff-table-modal-button staff-table-modal-button-secondary">
            戻る
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling || blocked}
            className="staff-table-modal-button staff-table-modal-button-danger"
          >
            {cancelling ? '処理中...' : 'キャンセル確定'}
          </button>
        </div>
      </div>
    </div>
  )
}
