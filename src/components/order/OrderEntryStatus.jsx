export default function OrderEntryStatus({ error, loading }) {
  if (loading) {
    return (
      <div className="customer-entry-status">
        <p className="customer-entry-status__loading">読み込み中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="customer-entry-status customer-entry-status--error">
        <p className="customer-entry-status__error">{error}</p>
      </div>
    )
  }

  return null
}
