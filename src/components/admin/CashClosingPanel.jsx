import { formatSalesTimestamp } from '../../lib/adminSales'
import { calculateCashCount } from '../../lib/closingSummary'

function yen(value) {
  return `¥${Number(value ?? 0).toLocaleString()}`
}

function CashDifference({ difference }) {
  if (difference === null || difference === undefined) return null
  const label = difference === 0 ? '差額' : difference < 0 ? '差額（足りない）' : '差額（多い）'
  return (
    <div className={`cash-count__diff${difference === 0 ? '' : ' is-off'}`} role="status">
      <span>{label}</span>
      <strong>{difference > 0 ? '+' : ''}{difference < 0 ? '-' : ''}{yen(Math.abs(difference))}</strong>
    </div>
  )
}

// 現金を数えて締める（2026-10-30 締め 第2章）。数字はサーバーが会計から数え直して残す。差額があっても締められる。
export default function CashClosingPanel({
  cashSales,
  closing,
  countedCash,
  error,
  memo,
  onClose,
  onCountedCashChange,
  onMemoChange,
  onOpeningCashChange,
  openingCash,
  saving,
}) {
  if (closing) {
    const hasCash = closing.expectedCash !== undefined && closing.expectedCash !== null
    const closedBy = [
      formatSalesTimestamp(closing.closedAt, { includeDate: false }),
      closing.closedByStaffName ?? closing.closedByEmail,
    ].filter(Boolean).join(' ')
    return (
      <div className="cash-count is-closed">
        <div className="cash-count__done" role="status">
          本日の売上は締めました{closedBy ? `（${closedBy}）` : ''}
        </div>
        {hasCash && (
          <>
            <div className="cash-count__row"><span>始めに入れたお釣り</span><strong>{yen(closing.openingCash)}</strong></div>
            <div className="cash-count__row"><span>レジにあるはずの現金</span><strong>{yen(closing.expectedCash)}</strong></div>
            {closing.countedCash !== null && closing.countedCash !== undefined && (
              <div className="cash-count__row"><span>数えた現金</span><strong>{yen(closing.countedCash)}</strong></div>
            )}
            <CashDifference difference={closing.cashDifference} />
          </>
        )}
        {closing.memo && <div className="cash-count__memo">メモ：{closing.memo}</div>}
      </div>
    )
  }

  const cash = calculateCashCount({ cashSales, openingCash, countedCash })

  return (
    <div className="cash-count">
      <div className="cash-count__label">現金を数える</div>
      <label className="cash-count__row">
        <span>始めに入れたお釣り</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={openingCash}
          onChange={event => onOpeningCashChange(event.target.value)}
          placeholder="0"
        />
      </label>
      <div className="cash-count__row">
        <span>レジにあるはずの現金</span>
        <strong>{yen(cash.expectedCash)}</strong>
      </div>
      <label className="cash-count__row">
        <span>数えた現金</span>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          value={countedCash}
          onChange={event => onCountedCashChange(event.target.value)}
          placeholder="数えた額"
        />
      </label>
      <CashDifference difference={cash.cashDifference} />
      <input
        className="cash-count__memo-input"
        type="text"
        value={memo}
        maxLength={500}
        onChange={event => onMemoChange(event.target.value)}
        placeholder="メモ（任意）"
        aria-label="締めのメモ"
      />
      {error && <div className="admin-sales-inline-error" role="alert">{error}</div>}
      <button type="button" className="cash-count__submit" disabled={saving} onClick={onClose}>
        {saving ? '締めています…' : '本日の売上を締める'}
      </button>
    </div>
  )
}
