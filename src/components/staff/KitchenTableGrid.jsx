import KitchenTableCard from './KitchenTableCard'

export default function KitchenTableGrid({ groups, nowMs, servedWorkflowEnabled, onCancelItem, onMarkAllServed, onMarkServed }) {
  return (
    <div className="staff-kitchen-grid">
      {groups.map(group => (
        <KitchenTableCard
          key={group.table.id}
          group={group}
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
