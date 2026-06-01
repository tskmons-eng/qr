export default function TableMoveModal({
  open,
  vacantTables,
  moving,
  onMove,
  onClose,
}) {
  if (!open) return null

  return (
    <div className="staff-table-modal-backdrop">
      <div className="staff-table-move-dialog">
        <h3 className="staff-table-modal-title staff-table-move-title">席移動</h3>
        <p className="staff-table-modal-subtitle">移動先の空席を選んでください</p>
        {vacantTables.length === 0 ? (
          <p className="staff-table-empty-message">空席がありません</p>
        ) : (
          <div className="staff-table-vacant-list">
            {vacantTables.map(table => (
              <button
                key={table.id}
                type="button"
                onClick={() => onMove(table)}
                disabled={moving}
                className="staff-table-vacant-button"
              >
                {table.tableName}
              </button>
            ))}
          </div>
        )}
        <button type="button" onClick={onClose} className="staff-table-move-cancel">
          キャンセル
        </button>
      </div>
    </div>
  )
}
