import { formatKitchenElapsed, getKitchenWaitLevel } from '../../lib/kitchenDisplay'
import KitchenItemRow from './KitchenItemRow'

export default function KitchenTableCard({ group, nowMs, servedWorkflowEnabled, onCancelItem, onMarkAllServed, onMarkServed }) {
  const { table, items, oldest } = group
  const waitLevel = servedWorkflowEnabled ? getKitchenWaitLevel(oldest, nowMs) : 'idle'

  return (
    <div className={`staff-kitchen-table staff-kitchen-table--${waitLevel}`}>
      <div className="staff-kitchen-table__header">
        <div>
          <span className="staff-kitchen-table__name">{table.tableName}</span>
          <span className="staff-kitchen-table__guests">{table.guestCount}名</span>
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
