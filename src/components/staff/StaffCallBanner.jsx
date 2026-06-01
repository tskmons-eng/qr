export default function StaffCallBanner({ calls, onRespond }) {
  if (calls.length === 0) return null

  return (
    <div className="staff-call-banner">
      {calls.map(call => {
        const isCheckout = call.type === 'checkout'
        return (
          <div
            key={call.id}
            className={`staff-call-banner__item${isCheckout ? ' staff-call-banner__item--checkout' : ''}`}
          >
            <div className="staff-call-banner__main">
              <span className="staff-call-banner__icon">{isCheckout ? '💳' : '🔔'}</span>
              <div>
                <span className="staff-call-banner__table">{call.tableName}</span>
                <span className="staff-call-banner__type">
                  {isCheckout ? '会計希望' : '呼び出し'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRespond(call)}
              className="staff-call-banner__respond"
            >
              対応する
            </button>
          </div>
        )
      })}
    </div>
  )
}
