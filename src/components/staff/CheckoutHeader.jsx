export default function CheckoutHeader({ activeStaff, onBack }) {
  return (
    <div className="checkout-header">
      <button type="button" onClick={onBack}>←</button>
      <span>会計</span>
      {activeStaff && <span className="checkout-header__staff">{activeStaff.name}</span>}
    </div>
  )
}
