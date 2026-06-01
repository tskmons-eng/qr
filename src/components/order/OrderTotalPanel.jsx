export default function OrderTotalPanel({ show, total, perPerson, guestCount }) {
  if (!show || total <= 0) return null

  return (
    <section className="order-status__total-panel">
      <div className={`order-status__total-row${perPerson ? ' has-per-person' : ''}`}>
        <span className="order-status__total-label">合計</span>
        <span className="order-status__total-value">¥{total.toLocaleString()}</span>
      </div>
      {perPerson && (
        <div className="order-status__per-person-row">
          <span>お一人様（{guestCount}名）</span>
          <span>¥{perPerson.toLocaleString()}</span>
        </div>
      )}
    </section>
  )
}
