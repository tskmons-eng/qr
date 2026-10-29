import { useEffect, useState } from 'react'
import { formatSalesTimestamp } from '../../lib/adminSales'
import { paymentMethodLabel } from '../../lib/paymentMethods'
import AdminSalesModal from './AdminSalesModal'

const VOID_REASONS = ['打ち間違い', '二重に会計した', '返金した', 'その他']

// 会計の取り消し（2026-10-30 締め 第2章）。理由を選んでから押せる。取り消した会計は売上・締めから外れ、一覧に薄く残る。
export default function CheckVoidSheet({ check, error, onClose, onVoid, saving }) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    setReason('')
    setDetail('')
  }, [check?.id])

  if (!check) return null
  const fullReason = [reason, detail.trim()].filter(Boolean).join('：')

  return (
    <AdminSalesModal busy={saving} closeDisabled={saving} open title="この会計を取り消す" onClose={onClose}>
      <div className="admin-sales-detail__hero">
        <div>
          <strong className="admin-sales-detail__table">
            {[check.tableNameSnapshot, `${check.guestCount ?? 0}名`].filter(Boolean).join('・')}
          </strong>
          <div className="admin-sales-detail__meta">
            {formatSalesTimestamp(check.completedAt) || '日時不明'} ・ {paymentMethodLabel(check.paymentMethod)}
          </div>
        </div>
        <strong>¥{Number(check.total ?? 0).toLocaleString()}</strong>
      </div>
      <div className="admin-sales-field__label">理由</div>
      <div className="void-reasons" role="radiogroup" aria-label="取り消す理由">
        {VOID_REASONS.map(item => (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={reason === item}
            className={reason === item ? 'is-active' : ''}
            onClick={() => setReason(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <input
        className="void-reasons__detail"
        type="text"
        value={detail}
        maxLength={60}
        onChange={event => setDetail(event.target.value)}
        placeholder="くわしく（任意）"
        aria-label="取り消す理由のくわしい内容"
      />
      <div className="void-reasons__note">
        取り消した会計は元に戻せません。お客様にお金を返すときは、レジから返してください。
      </div>
      {error && <div className="admin-sales-inline-error" role="alert">{error}</div>}
      <div className="admin-sales-modal__actions">
        <button type="button" className="admin-sales-button admin-sales-button--secondary" disabled={saving} onClick={onClose}>
          戻る
        </button>
        <button
          type="button"
          className="admin-sales-button admin-sales-button--danger"
          disabled={saving || !reason}
          onClick={() => onVoid(fullReason)}
        >
          {saving ? '取り消しています…' : '取り消す'}
        </button>
      </div>
    </AdminSalesModal>
  )
}
