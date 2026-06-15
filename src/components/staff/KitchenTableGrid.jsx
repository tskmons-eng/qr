import KitchenTableCard from './KitchenTableCard'
import { getNextReservationForTable, getTokyoDateString } from '../../lib/reservationDisplay'

export default function KitchenTableGrid({ groups, reservations = [], nowMs, servedWorkflowEnabled, onCancelItem, onMarkAllServed, onMarkServed }) {
  const today = getTokyoDateString()

  return (
    <div className="staff-kitchen-grid">
      {groups.map(group => (
        <KitchenTableCard
          key={group.table.id}
          group={group}
          reservation={getNextReservationForTable(reservations, group.table.id, today)}
          nowMs={nowMs}
          servedWorkflowEnabled={servedWorkflowEnabled}
          onCancelItem={onCancelItem}
          onMarkAllServed={onMarkAllServed}
          onMarkServed={onMarkServed}
        />
      ))}
    </div>
  )
}
