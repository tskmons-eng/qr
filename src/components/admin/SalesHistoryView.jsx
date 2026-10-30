import useMediaQuery from '../../hooks/useMediaQuery'
import CashClosingHistory from './CashClosingHistory'
import SalesClosingSummary from './SalesClosingSummary'
import TodayCheckList from './TodayCheckList'

const PERIOD_OPTIONS = [
  { value: 'month', label: '月ごと' },
  { value: 'range', label: '期間' },
  { value: 'all', label: '全期間' },
]

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split('-')
  if (!year || !month) return '当月'
  return `${Number(year)}年${Number(month)}月`
}

function yen(value) {
  return `¥${Number(value ?? 0).toLocaleString()}`
}

// 担当別の売上。1行ずつ並べ、押すとその担当で絞り込む（もう一度押すと全員に戻る）。
function AssigneeSummaryList({ assigneeFilter, onAssigneeFilterChange, summary }) {
  const rows = [
    ...(summary.assignees ?? []).map(item => ({
      id: item.assigneeId,
      name: `${item.assigneeName}${item.isActive === false ? '（無効）' : ''}`,
      checkCount: item.checkCount ?? 0,
      salesTotal: item.salesTotal ?? 0,
    })),
    {
      id: 'unassigned',
      name: '担当未設定',
      checkCount: summary.unassigned?.checkCount ?? 0,
      salesTotal: summary.unassigned?.salesTotal ?? 0,
      unassigned: true,
    },
  ].filter(row => row.checkCount > 0 || row.id === assigneeFilter)
  if (rows.length === 0) return null

  return (
    <div className="sales-history__assignees">
      <div className="admin-sales-card__header">
        <span>担当別</span>
        <span>押すと絞り込み</span>
      </div>
      {rows.map(row => {
        const selected = assigneeFilter === row.id
        return (
          <button
            key={row.id}
            type="button"
            aria-pressed={selected}
            className={`sales-history__assignee${selected ? ' is-selected' : ''}${row.unassigned ? ' is-unassigned' : ''}`}
            onClick={() => onAssigneeFilterChange(selected ? 'all' : row.id)}
          >
            <span className="sales-history__assignee-name">{row.name}</span>
            <span className="sales-history__assignee-count">{row.checkCount}件</span>
            <strong>{yen(row.salesTotal)}</strong>
          </button>
        )
      })}
    </div>
  )
}

// 売上の「履歴」（2026-10-30 作り直し）。上に絞り込み（期間・担当）を1枚にまとめ、
// 期間の売上は本日と同じ形（支払い方法ごと・税・値引き・取り消し）で出す。
// タブレット（横）：左に会計、右に売上・担当別・締めの記録。スマホ：上から絞り込み・売上・担当別・会計・締めの記録。
export default function SalesHistoryView({
  assigneeFilter,
  assignees,
  attributionSummary,
  checks,
  closings,
  endDate,
  hasMore,
  monthKey,
  onAssigneeFilterChange,
  onDateRangeChange,
  onLoadMore,
  onMonthMove,
  onPeriodModeChange,
  onSelectCheck,
  onSelectClosingDate,
  periodMode,
  startDate,
  summary,
  summaryTitle,
  totalCount,
}) {
  const wide = useMediaQuery('(min-width: 900px)')

  const filters = (
    <section className="admin-sales-card sales-history__filters" aria-label="会計履歴の絞り込み">
      <div className="admin-sales-view-tabs sales-history__period" role="group" aria-label="期間">
        {PERIOD_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            aria-pressed={periodMode === option.value}
            className={periodMode === option.value ? 'is-active' : ''}
            onClick={() => onPeriodModeChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {periodMode === 'month' && (
        <div className="sales-history__month">
          <button type="button" aria-label="前の月" onClick={() => onMonthMove(-1)}>‹</button>
          <strong>{formatMonthLabel(monthKey)}</strong>
          <button type="button" aria-label="次の月" onClick={() => onMonthMove(1)}>›</button>
        </div>
      )}

      {periodMode === 'range' && (
        <div className="sales-history__range">
          <input
            type="date"
            aria-label="始めの日"
            value={startDate}
            max={endDate || undefined}
            onChange={event => onDateRangeChange({ startDate: event.target.value, endDate })}
          />
          <span aria-hidden="true">〜</span>
          <input
            type="date"
            aria-label="終わりの日"
            value={endDate}
            min={startDate || undefined}
            onChange={event => onDateRangeChange({ startDate, endDate: event.target.value })}
          />
        </div>
      )}

      <label className="sales-history__assignee-select">
        <span>担当</span>
        <select value={assigneeFilter} onChange={event => onAssigneeFilterChange(event.target.value)}>
          <option value="all">全員</option>
          <option value="unassigned">担当未設定</option>
          {assignees.map(assignee => (
            <option key={assignee.id} value={assignee.id}>
              {assignee.name}{assignee.isActive === false ? '（無効）' : ''}
            </option>
          ))}
        </select>
      </label>
    </section>
  )

  const summaryCard = (
    <>
      <SalesClosingSummary summary={summary} title={summaryTitle} />
      <AssigneeSummaryList
        assigneeFilter={assigneeFilter}
        summary={attributionSummary}
        onAssigneeFilterChange={onAssigneeFilterChange}
      />
    </>
  )

  const list = (
    <>
      <TodayCheckList
        checks={checks}
        count={totalCount}
        emptyMessage="この期間の会計はありません"
        includeDate
        title="会計"
        onSelectCheck={onSelectCheck}
      />
      {hasMore && (
        <button type="button" className="sales-history__more" onClick={onLoadMore}>
          さらに50件表示
        </button>
      )}
    </>
  )

  const closingList = <CashClosingHistory closings={closings} onSelectDate={onSelectClosingDate} />

  if (wide) {
    return (
      <div className="sales-history">
        {filters}
        <div className="sales-today">
          <div className="sales-today__list">{list}</div>
          <aside className="sales-history__side">
            <section className="admin-sales-card">{summaryCard}</section>
            {closingList}
          </aside>
        </div>
      </div>
    )
  }

  return (
    <div className="sales-history">
      {filters}
      <section className="admin-sales-card">{summaryCard}</section>
      {list}
      {closingList}
    </div>
  )
}
