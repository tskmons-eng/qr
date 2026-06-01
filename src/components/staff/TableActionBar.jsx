export default function TableActionBar({
  hasOrder,
  onMove,
  onAddOrder,
}) {
  return (
    <div className="staff-table-action-bar">
      {hasOrder && (
        <button type="button" onClick={onMove} className="staff-table-action-button staff-table-move-button">
          席移動
        </button>
      )}
      {hasOrder && (
        <button type="button" onClick={onAddOrder} className="staff-table-action-button staff-table-add-order-button">
          + 注文追加
        </button>
      )}
    </div>
  )
}
