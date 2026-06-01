export default function AdditionalOrderBar({ show, onClick }) {
  if (!show) return null

  return (
    <div className="order-status__additional-bar">
      <button type="button" onClick={onClick} className="order-status__additional-button">
        追加注文する
      </button>
    </div>
  )
}
