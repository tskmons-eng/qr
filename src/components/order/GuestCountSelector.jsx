import OrderCommandErrorNotice from '../OrderCommandErrorNotice'

export default function GuestCountSelector({ autoAddNote, count, errorMessage, loading, ready, tableName, onChange, onStart }) {
  return (
    <div className="guest-count-page">
      <div className="guest-count-page__table">{tableName}</div>
      <h1 className="guest-count-page__title">ご来店人数</h1>
      <p className="guest-count-page__prompt">注文を始める人数を選んでください</p>

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
        disabled={loading || !ready}
        className="guest-count-page__start"
      >
        {loading ? '注文を準備しています...' : ready ? `${count}名で注文を始める` : 'メニューを準備しています...'}
      </button>
      {autoAddNote && ready && <p className="guest-count-page__note">{autoAddNote}</p>}
    </div>
  )
}
