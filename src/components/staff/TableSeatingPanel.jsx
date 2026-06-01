export default function TableSeatingPanel({
  seatCount,
  seating,
  onSeatCountChange,
  onSeat,
}) {
  return (
    <div className="staff-table-empty-state">
      <p className="staff-table-empty-copy">現在注文はありません</p>
      <div className="staff-table-seat-card">
        <p className="staff-table-seat-question">何名様ですか？</p>
        <div className="staff-table-seat-counter">
          <button type="button" onClick={() => onSeatCountChange(Math.max(1, seatCount - 1))} className="staff-table-seat-step">−</button>
          <span className="staff-table-seat-count">{seatCount}</span>
          <button type="button" onClick={() => onSeatCountChange(Math.min(20, seatCount + 1))} className="staff-table-seat-step">+</button>
        </div>
        <button type="button" onClick={onSeat} disabled={seating} className="staff-table-seat-submit">
          {seating ? '処理中...' : `${seatCount}名で着席する`}
        </button>
      </div>
    </div>
  )
}
