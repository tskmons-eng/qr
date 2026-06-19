import TableOrderSection from './TableOrderSection'
import TableOrderSummary from './TableOrderSummary'

export default function TableDetailOrderContent({
  items,
  orderedItems,
  servedItems,
  servedWorkflowEnabled,
  total,
  guestCount,
  onMarkServed,
  onMarkOrdered,
  onCancel,
}) {
  return (
    <>
      <TableOrderSection
        title={servedWorkflowEnabled ? '準備中' : '注文'}
        items={servedWorkflowEnabled ? orderedItems : items}
        served={false}
        servedWorkflowEnabled={servedWorkflowEnabled}
        onMarkServed={onMarkServed}
        onMarkOrdered={onMarkOrdered}
        onCancel={onCancel}
      />
      {servedWorkflowEnabled && (
        <TableOrderSection
          title="提供済み"
          items={servedItems}
          served
          servedWorkflowEnabled={servedWorkflowEnabled}
          onMarkServed={onMarkServed}
          onMarkOrdered={onMarkOrdered}
          onCancel={onCancel}
        />
      )}
      <TableOrderSummary total={total} guestCount={guestCount} />
    </>
  )
}
