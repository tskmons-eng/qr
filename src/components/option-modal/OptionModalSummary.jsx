export default function OptionModalSummary({ quantity, total }) {
  return (
    <div className="option-modal__summary">
      <span>合計 {quantity}個</span>
      <span>¥{total.toLocaleString()}</span>
    </div>
  )
}
