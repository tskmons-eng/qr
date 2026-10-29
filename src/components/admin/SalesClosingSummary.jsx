import { PAYMENT_METHOD_OPTIONS } from '../../lib/paymentMethods'

function yen(value) {
  return `¥${Number(value ?? 0).toLocaleString()}`
}

// 本日の売上：合計・件数・客数・客単価と、支払い方法ごと・税・値引き・取り消し（2026-10-30 締め 第2章）。
// summary は src/lib/closingSummary.js の summarizeChecksForClosing の形。締め済みなら締めの記録の数字を渡す。
export default function SalesClosingSummary({ compact = false, summary, title = '本日の売上' }) {
  const byPaymentMethod = summary.byPaymentMethod ?? {}
  const otherMethod = byPaymentMethod.other ?? { count: 0, total: 0 }

  return (
    <div className={`sales-summary${compact ? ' is-compact' : ''}`}>
      <div className="sales-summary__total">
        <span>{title}</span>
        <strong>{yen(summary.salesTotal)}</strong>
      </div>
      <div className="sales-summary__kpis">
        <div>会計<strong>{summary.checkCount}件</strong></div>
        <div>客数<strong>{summary.customerCount}名</strong></div>
        <div>客単価<strong>{yen(summary.averageSpend)}</strong></div>
      </div>
      <div className="sales-summary__rows">
        {PAYMENT_METHOD_OPTIONS.map(option => {
          const row = byPaymentMethod[option.value] ?? { count: 0, total: 0 }
          return (
            <div key={option.value} className="sales-summary__row">
              <span>{option.label}</span>
              <span>{row.count}件</span>
              <strong>{yen(row.total)}</strong>
            </div>
          )
        })}
        {otherMethod.count > 0 && (
          <div className="sales-summary__row">
            <span>その他</span>
            <span>{otherMethod.count}件</span>
            <strong>{yen(otherMethod.total)}</strong>
          </div>
        )}
        {!compact && (
          <>
            <div className="sales-summary__row is-muted">
              <span>うち消費税</span>
              <span />
              <strong>{yen(summary.taxTotal)}</strong>
            </div>
            {summary.discountCount > 0 && (
              <div className="sales-summary__row is-discount">
                <span>値引き</span>
                <span>{summary.discountCount}件</span>
                <strong>-{yen(summary.discountTotal)}</strong>
              </div>
            )}
            {summary.voidedCount > 0 && (
              <div className="sales-summary__row is-muted">
                <span>取り消し・打ち直し前</span>
                <span>{summary.voidedCount}件</span>
                <strong>{yen(summary.voidedTotal)}</strong>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
