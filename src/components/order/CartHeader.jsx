export default function CartHeader({ onBack }) {
  return (
    <header className="customer-cart__header">
      <button type="button" onClick={onBack} className="customer-cart__back-button">←</button>
      <span className="customer-cart__title">カート確認</span>
    </header>
  )
}
