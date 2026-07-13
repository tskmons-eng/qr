export default function AdminHistoryHeader({ exportDisabled, onExport }) {
  return (
    <div className="admin-history__header">
      <div>
        <h2 className="admin-history__title">操作ログ</h2>
        <p className="admin-history__description">会計確定、キャンセル、席移動、担当変更などの記録です</p>
      </div>
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
