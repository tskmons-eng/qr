export default function AdminHistoryHeader({ exportDisabled, onExport }) {
  return (
    <div className="admin-history__header">
      <h2 className="admin-history__title">操作履歴</h2>
      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="admin-history__export"
      >
        CSV出力
      </button>
    </div>
  )
}
