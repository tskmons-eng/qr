import { useEffect, useState } from 'react'
import AdminSalesModal from './AdminSalesModal'

export default function CashClosingPanel({
  businessDate,
  error,
  memo,
  onClose,
  onMemoChange,
  saving,
  summary,
  todayClosed,
}) {
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  useEffect(() => {
    if (todayClosed) setConfirmationOpen(false)
  }, [todayClosed])

  return (
    <>
      <section className="admin-sales-card admin-sales-card--padded admin-sales-closing">
        <div className="admin-sales-card__label">レジ締め</div>
        {todayClosed ? (
          <div className="admin-sales-closing__done" role="status">本日のレジ締めは完了しています</div>
        ) : (
          <>
            <label className="admin-sales-field__label" htmlFor="cash-closing-memo">締めメモ（任意）</label>
            <textarea
              id="cash-closing-memo"
              value={memo}
              onChange={event => onMemoChange(event.target.value)}
              placeholder="引き継ぎ事項など"
              rows={2}
              className="admin-sales-closing__memo"
            />
            {error && <div className="admin-sales-inline-error" role="alert">{error}</div>}
            <button
              type="button"
              onClick={() => setConfirmationOpen(true)}
              disabled={saving}
              className="admin-sales-closing__button"
            >
              本日のレジを締める
            </button>
          </>
        )}
      </section>

      <AdminSalesModal
        busy={saving}
        closeDisabled={saving}
        open={confirmationOpen}
        title="レジ締めの確認"
        variant="dialog"
        onClose={() => setConfirmationOpen(false)}
      >
        <p className="admin-sales-confirm__lead">次の内容で本日のレジを締めます。</p>
        <dl className="admin-sales-confirm__summary">
          <div><dt>日付</dt><dd>{businessDate}</dd></div>
          <div><dt>売上合計</dt><dd>¥{summary.salesTotal.toLocaleString()}</dd></div>
          <div><dt>会計件数</dt><dd>{summary.checkCount}件</dd></div>
          <div><dt>客数</dt><dd>{summary.customerCount}名</dd></div>
          <div><dt>メモ</dt><dd>{memo.trim() || 'なし'}</dd></div>
        </dl>
        {error && <div className="admin-sales-inline-error" role="alert">{error}</div>}
        <div className="admin-sales-modal__actions">
          <button
            type="button"
            className="admin-sales-button admin-sales-button--secondary"
            disabled={saving}
            onClick={() => setConfirmationOpen(false)}
          >
            戻る
          </button>
          <button
            type="button"
            className="admin-sales-button admin-sales-button--primary"
            disabled={saving}
            onClick={onClose}
          >
            {saving ? '締め処理中…' : 'この内容で締める'}
          </button>
        </div>
      </AdminSalesModal>
    </>
  )
}
