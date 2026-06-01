export default function TableOrderSummary({ total, guestCount }) {
  return (
    <>
      <div className="staff-table-total-row">
        <span>合計</span>
        <span>¥{total.toLocaleString()}</span>
      </div>
      {guestCount > 0 && (
        <div className="staff-table-unit-row">
          <span>客単価</span>
          <span>¥{Math.round(total / guestCount).toLocaleString()}</span>
        </div>
      )}
    </>
  )
}
