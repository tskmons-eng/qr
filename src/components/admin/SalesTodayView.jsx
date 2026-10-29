import { useEffect, useState } from 'react'
import useMediaQuery from '../../hooks/useMediaQuery'
import AdminSalesModal from './AdminSalesModal'
import CashClosingPanel from './CashClosingPanel'
import SalesClosingSummary from './SalesClosingSummary'
import TodayCheckList from './TodayCheckList'

// 売上の「本日」（2026-10-30 締め 第2章）。
// タブレット（横）：左に本日の会計、右に売上（支払い方法ごと・税・値引き・取り消し）と現金を数えて締める。
// スマホ：上に売上、下に会計の一覧。「締める」は下に固定し、押すと現金を数える窓を開く。
export default function SalesTodayView({ businessDate, checks, closing, closingPanelProps, onSelectCheck, summary }) {
  const wide = useMediaQuery('(min-width: 900px)')
  const [sheetOpen, setSheetOpen] = useState(false)
  const shownSummary = closing?.closingVersion >= 2 ? closing : summary
  const dateLabel = businessDate.slice(5).replace('-', '月').replace(/^0/, '') + '日'

  useEffect(() => {
    if (closing || wide) setSheetOpen(false)
  }, [closing, wide])

  const list = (
    <TodayCheckList checks={checks} title={`本日の会計（${dateLabel}）`} onSelectCheck={onSelectCheck} />
  )
  const panel = <CashClosingPanel {...closingPanelProps} closing={closing} />

  if (wide) {
    return (
      <div className="sales-today">
        <div className="sales-today__list">{list}</div>
        <aside className="sales-today__side">
          <SalesClosingSummary summary={shownSummary} />
          {panel}
        </aside>
      </div>
    )
  }

  return (
    <div className="sales-today is-narrow">
      <section className="admin-sales-card">
        <SalesClosingSummary summary={shownSummary} />
        {closing && panel}
      </section>
      {list}
      {!closing && (
        <>
          <div className="sales-today__fixed">
            <button type="button" className="cash-count__submit" onClick={() => setSheetOpen(true)}>
              本日の売上を締める
            </button>
          </div>
          <AdminSalesModal
            busy={closingPanelProps.saving}
            closeDisabled={closingPanelProps.saving}
            open={sheetOpen}
            title="本日の売上を締める"
            onClose={() => setSheetOpen(false)}
          >
            <SalesClosingSummary compact summary={summary} />
            {panel}
          </AdminSalesModal>
        </>
      )}
    </div>
  )
}
