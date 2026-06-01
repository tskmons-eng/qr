export default function CashClosingPanel({ memo, saving, todayClosed, onClose, onMemoChange }) {
  return (
    <section className="admin-sales-card admin-sales-card--padded admin-sales-closing">
      <div className="admin-sales-card__label">レジ締め</div>
      {todayClosed ? (
        <div className="admin-sales-closing__done">本日のレジ締めは完了しています</div>
      ) : (
        <>
          <textarea
            value={memo}
            onChange={event => onMemoChange(event.target.value)}
            placeholder="メモ（任意）"
            rows={2}
            className="admin-sales-closing__memo"
          />
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="admin-sales-closing__button"
          >
            {saving ? '処理中...' : 'レジ締めを実行する'}
          </button>
        </>
      )}
    </section>
  )
}
