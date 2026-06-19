import { formatKitchenElapsed, getKitchenWaitLevel } from '../../lib/kitchenDisplay'
import KitchenItemRow from './KitchenItemRow'
import { TableReservationBadge } from './TodayReservationNoticeList'

export default function KitchenTableCard({ group, reservation, nowMs, servedWorkflowEnabled, onCancelItem, onMarkAllServed, onMarkServed }) {
  const { table, items, oldest } = group
  const waitLevel = servedWorkflowEnabled ? getKitchenWaitLevel(oldest, nowMs) : 'idle'
  const isCrowded = items.length >= 8

  return (
    <div className={`staff-kitchen-table staff-kitchen-table--${waitLevel}${isCrowded ? ' staff-kitchen-table--crowded' : ''}`}>
      <div className="staff-kitchen-table__header">
        <div>
          <span className="staff-kitchen-table__name">{table.tableName}</span>
          <span className="staff-kitchen-table__guests">{table.guestCount}名</span>
          <span className="staff-kitchen-table__item-count">{items.length}品</span>
          <TableReservationBadge reservation={reservation} />
        </div>
        <div className="staff-kitchen-table__actions">
          {servedWorkflowEnabled && (
            <>
              <span className="staff-kitchen-table__wait">{formatKitchenElapsed(oldest, nowMs)}待ち</span>
              <button
                type="button"
                onClick={() => onMarkAllServed(items)}
                className="staff-kitchen-table__served-all"
              >
                全提供
              </button>
            </>
          )}
        </div>
      </div>
      <div className="staff-kitchen-table__items">
        {items.map(item => (
          <KitchenItemRow
            key={item.id}
            item={item}
            nowMs={nowMs}
            servedWorkflowEnabled={servedWorkflowEnabled}
            onCancel={rowItem => onCancelItem(rowItem, table)}
            onServed={onMarkServed}
          />
        ))}
      </div>
    </div>
  )
}
