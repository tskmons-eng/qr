export default function TableActionBar({
  hasOrder,
  onEditGuests,
  onMove,
  onAddOrder,
}) {
  return (
    <div className="staff-table-action-bar">
      {hasOrder && (
        <button type="button" onClick={onEditGuests} className="staff-table-action-button staff-table-guests-button">
          人数変更
        </button>
      )}
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
