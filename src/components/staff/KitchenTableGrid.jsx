import KitchenTableCard from './KitchenTableCard'

export default function KitchenTableGrid({ groups, nowMs, onCancelItem, onMarkAllServed, onMarkServed }) {
  return (
    <div className="staff-kitchen-grid">
      {groups.map(group => (
        <KitchenTableCard
          key={group.table.id}
          group={group}
          nowMs={nowMs}
          onCancelItem={onCancelItem}
          onMarkAllServed={onMarkAllServed}
          onMarkServed={onMarkServed}
        />
      ))}
    </div>
  )
}
