import TodayCheckList from './TodayCheckList'

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split('-')
  if (!year || !month) return '当月'
  return `${Number(year)}年${Number(month)}月`
}

export default function SalesHistoryView({
  assigneeFilter,
  assignees,
  checks,
  endDate,
  hasMore,
  monthKey,
  onAssigneeFilterChange,
  onDateRangeChange,
  onLoadMore,
  onMonthMove,
  onPeriodModeChange,
  onSelectCheck,
  periodMode,
  startDate,
  summary,
  totalCount,
}) {
  return (
    <div className="admin-sales-history-view">
      <section className="admin-sales-card admin-sales-card--padded admin-sales-filters" aria-label="会計履歴の絞り込み">
        <div className="admin-sales-period-tabs" role="group" aria-label="期間">
          <button
            type="button"
            className={periodMode === 'month' ? 'is-active' : ''}
            onClick={() => onPeriodModeChange('month')}
          >
            月ごと
          </button>
          <button
            type="button"
            className={periodMode === 'range' ? 'is-active' : ''}
            onClick={() => onPeriodModeChange('range')}
          >
            期間指定
          </button>
          <button
            type="button"
            className={periodMode === 'all' ? 'is-active' : ''}
            onClick={() => onPeriodModeChange('all')}
          >
            全期間
          </button>
        </div>

        {periodMode === 'month' && (
          <div className="admin-sales-month-picker">
            <button type="button" aria-label="前月" onClick={() => onMonthMove(-1)}>‹</button>
            <strong>{formatMonthLabel(monthKey)}</strong>
            <button type="button" aria-label="翌月" onClick={() => onMonthMove(1)}>›</button>
          </div>
        )}

        {periodMode === 'range' && (
          <div className="admin-sales-date-range">
            <label>
              <span>開始日</span>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={event => onDateRangeChange({ startDate: event.target.value, endDate })}
              />
            </label>
            <span className="admin-sales-date-range__separator" aria-hidden="true">〜</span>
            <label>
              <span>終了日</span>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={event => onDateRangeChange({ startDate, endDate: event.target.value })}
              />
            </label>
          </div>
        )}

        <label className="admin-sales-assignee-filter">
          <span>担当</span>
          <select value={assigneeFilter} onChange={event => onAssigneeFilterChange(event.target.value)}>
            <option value="all">すべて</option>
            <option value="unassigned">担当未設定</option>
            {assignees.map(assignee => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name}{assignee.isActive === false ? '（無効）' : ''}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="admin-sales-attribution-summary" aria-label="担当別集計">
        <button
          type="button"
          className={`admin-sales-attribution-summary__item${assigneeFilter === 'all' ? ' is-selected' : ''}`}
          onClick={() => onAssigneeFilterChange('all')}
        >
          <span className="admin-sales-attribution-summary__label">期間合計</span>
          <strong>¥{Number(summary.salesTotal ?? 0).toLocaleString()}</strong>
          <small>{summary.checkCount ?? 0}件</small>
        </button>
        <button
          type="button"
          className={`admin-sales-attribution-summary__item is-unassigned${assigneeFilter === 'unassigned' ? ' is-selected' : ''}`}
          onClick={() => onAssigneeFilterChange('unassigned')}
        >
          <span className="admin-sales-attribution-summary__label">担当未設定</span>
          <strong>¥{Number(summary.unassigned?.salesTotal ?? 0).toLocaleString()}</strong>
          <small>{summary.unassigned?.checkCount ?? 0}件</small>
        </button>
        {summary.assignees?.map(item => (
          <button
            key={item.assigneeId}
            type="button"
            className={`admin-sales-attribution-summary__item${assigneeFilter === item.assigneeId ? ' is-selected' : ''}`}
            onClick={() => onAssigneeFilterChange(item.assigneeId)}
          >
            <span className="admin-sales-attribution-summary__label">
              {item.assigneeName}{item.isActive === false ? '（無効）' : ''}
            </span>
            <strong>¥{Number(item.salesTotal ?? 0).toLocaleString()}</strong>
            <small>{item.checkCount ?? 0}件</small>
          </button>
        ))}
      </section>

      <TodayCheckList
        checks={checks}
        emptyMessage="対象期間の会計はありません"
        includeDate
        onSelectCheck={onSelectCheck}
        title={`会計一覧（${totalCount}件）`}
      />
      {hasMore && (
        <button type="button" className="admin-sales-load-more" onClick={onLoadMore}>
          さらに50件表示
        </button>
      )}
    </div>
  )
}
