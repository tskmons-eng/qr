export default function AdminSalesHeader({ exportDisabled, onExport }) {
  return (
    <div className="admin-sales__header">
      <h2 className="admin-sales__title">売上・レジ締め</h2>
      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="admin-sales__export"
      >
        CSV出力
      </button>
    </div>
  )
}
