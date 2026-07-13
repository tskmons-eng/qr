import { useEffect, useMemo, useState } from 'react'
import { formatSalesTimestamp } from '../../lib/adminSales'
import { loadCheckDetailItems } from '../../services/salesHistoryService'
import AdminSalesModal from './AdminSalesModal'

function paymentMethodLabel(method) {
  if (!method || method === 'cash' || method === '現金') return '現金'
  return method
}

function getOptionLabel(item) {
  const options = Array.isArray(item.optionSelections) ? item.optionSelections : []
  return options.map(option => {
    const choice = option.choice ?? option.name ?? option.optionName ?? option.label
    if (!choice) return null
    return option.groupName ? `${option.groupName}: ${choice}` : choice
  }).filter(Boolean).join('、')
}

export default function SalesCheckDetailModal({
  assignees,
  check,
  error,
  onClose,
  onSaveAttribution,
  saving,
  successMessage,
}) {
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailReloadToken, setDetailReloadToken] = useState(0)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('')

  useEffect(() => {
    setSelectedAssigneeId(check?.salesAssigneeId ?? '')
  }, [check?.id, check?.salesAssigneeId])

  useEffect(() => {
    if (!check) return undefined
    let cancelled = false
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)

    loadCheckDetailItems(check)
      .then(result => {
        if (!cancelled) setDetail(result)
      })
      .catch(() => {
        if (!cancelled) setDetailError('商品明細を取得できませんでした。会計合計は保存済みの金額を表示しています。')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => { cancelled = true }
  }, [check, detailReloadToken])

  const selectableAssignees = useMemo(() => {
    if (!check) return []
    return assignees.filter(assignee => assignee.isActive !== false || assignee.id === check.salesAssigneeId)
  }, [assignees, check])

  if (!check) return null

  const subtotal = Number(check.subtotalBeforeItemDiscount ?? check.subtotal ?? check.total ?? 0)
  const itemDiscount = Number(check.itemDiscountAmount ?? 0)
  const checkoutDiscount = Number(check.checkoutDiscountAmount ?? Math.max(0, Number(check.discountAmount ?? 0) - itemDiscount))

  return (
    <AdminSalesModal
      busy={saving}
      closeDisabled={saving}
      open
      title="会計の詳細"
      onClose={onClose}
    >
      <div className="admin-sales-detail__hero">
        <div>
          <div className="admin-sales-detail__date">{formatSalesTimestamp(check.completedAt) || '日時不明'}</div>
          <div className="admin-sales-detail__meta">
            {check.guestCount ?? 0}名 ・ 会計: {check.closedByStaffName ?? check.closedByEmail ?? '不明'}
          </div>
        </div>
        <strong>¥{Number(check.total ?? 0).toLocaleString()}</strong>
      </div>

      <section className="admin-sales-detail__section">
        <h4>商品明細</h4>
        {detailLoading && <div className="admin-sales-state-message" role="status">明細を読み込み中…</div>}
        {detailError && (
          <div className="admin-sales-inline-error" role="alert">
            <span>{detailError}</span>
            <button
              type="button"
              className="admin-sales-button admin-sales-button--secondary"
              onClick={() => setDetailReloadToken(token => token + 1)}
            >
              明細を再試行
            </button>
          </div>
        )}
        {detail?.hasIncompleteItems && (
          <div className="admin-sales-inline-warning" role="status">
            {detail.missingCount > 0 && (
              <>一部明細を取得できません（{detail.missingCount}件）。</>
            )}
            {detail.hasSubtotalMismatch && (
              <>保存済みの小計と取得できた明細の合計が一致しません。</>
            )}
            保存済みの会計合計を正として表示しています。
          </div>
        )}
        {!detailLoading && !detailError && detail?.items.length === 0 && (
          <div className="admin-sales-state-message">保存済みの商品明細はありません</div>
        )}
        {detail?.items.map(item => {
          const optionLabel = getOptionLabel(item)
          return (
            <div key={item.id} className="admin-sales-detail-item">
              <div>
                <span className="admin-sales-detail-item__name">{item.productNameSnapshot ?? '商品'}</span>
                <span className="admin-sales-detail-item__quantity"> × {item.quantity ?? 0}</span>
                {optionLabel && <small>{optionLabel}</small>}
              </div>
              <strong>¥{Number(item.lineTotal ?? 0).toLocaleString()}</strong>
            </div>
          )
        })}
      </section>

      <section className="admin-sales-detail__section">
        <h4>金額</h4>
        <dl className="admin-sales-detail__amounts">
          <div><dt>小計</dt><dd>¥{subtotal.toLocaleString()}</dd></div>
          {itemDiscount > 0 && <div><dt>商品別割引</dt><dd>-¥{itemDiscount.toLocaleString()}</dd></div>}
          {checkoutDiscount > 0 && <div><dt>会計割引</dt><dd>-¥{checkoutDiscount.toLocaleString()}</dd></div>}
          {check.discountNote && <div><dt>割引理由</dt><dd>{check.discountNote}</dd></div>}
          <div className="is-total"><dt>合計</dt><dd>¥{Number(check.total ?? 0).toLocaleString()}</dd></div>
          <div><dt>支払方法</dt><dd>{paymentMethodLabel(check.paymentMethod)}</dd></div>
          {check.receivedCash !== undefined && check.receivedCash !== null && (
            <div><dt>お預かり</dt><dd>¥{Number(check.receivedCash).toLocaleString()}</dd></div>
          )}
          {check.changeAmount !== undefined && check.changeAmount !== null && (
            <div><dt>お釣り</dt><dd>¥{Number(check.changeAmount).toLocaleString()}</dd></div>
          )}
        </dl>
      </section>

      <section className="admin-sales-detail__section admin-sales-detail__assignment">
        <h4>担当</h4>
        <label className="admin-sales-field__label" htmlFor="sales-check-assignee">この会計の担当者</label>
        <select
          id="sales-check-assignee"
          value={selectedAssigneeId}
          disabled={saving}
          onChange={event => setSelectedAssigneeId(event.target.value)}
        >
          <option value="">担当未設定</option>
          {selectableAssignees.map(assignee => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}{assignee.isActive === false ? '（無効）' : ''}
            </option>
          ))}
        </select>
        {error && <div className="admin-sales-inline-error" role="alert">{error}</div>}
        {successMessage && <div className="admin-sales-inline-success" role="status">{successMessage}</div>}
        <div className="admin-sales-detail__assignment-actions">
          {check.isSalesAssigned && (
            <button
              type="button"
              className="admin-sales-button admin-sales-button--secondary"
              disabled={saving}
              onClick={() => {
                setSelectedAssigneeId('')
                onSaveAttribution('')
              }}
            >
              担当を解除
            </button>
          )}
          <button
            type="button"
            className="admin-sales-button admin-sales-button--primary"
            disabled={saving || selectedAssigneeId === (check.salesAssigneeId ?? '')}
            onClick={() => onSaveAttribution(selectedAssigneeId)}
          >
            {saving ? '保存中…' : '担当を保存'}
          </button>
        </div>
      </section>
    </AdminSalesModal>
  )
}
