import OrderCommandErrorNotice from '../OrderCommandErrorNotice'

export default function GuestCountSelector({ autoAddLabel, count, errorMessage, loading, tableName, onChange, onStart }) {
  return (
    <div className="guest-count-page">
      <h1 className="guest-count-page__title">いらっしゃいませ</h1>
      <p className="guest-count-page__table">{tableName}</p>
      <p className="guest-count-page__prompt">何名様ですか？</p>

      <div className="guest-count-control">
        <button type="button" onClick={() => onChange(-1)} className="guest-count-control__button">
          −
        </button>
        <span className="guest-count-control__value">{count}</span>
        <button type="button" onClick={() => onChange(1)} className="guest-count-control__button">
          ＋
        </button>
      </div>

      <OrderCommandErrorNotice message={errorMessage} />

      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        className="guest-count-page__start"
      >
        {loading ? '...' : autoAddLabel || `${count}名で注文を始める`}
      </button>
    </div>
  )
}
