import OrderCommandErrorNotice from '../OrderCommandErrorNotice'

export default function StaffMenuSubmitBar({ cartCount, cartTotal, errorMessage, submitting, onSubmit }) {
  if (cartCount <= 0) return null

  return (
    <div className="staff-menu-submit">
      <OrderCommandErrorNotice message={errorMessage} />
      <button type="button" onClick={onSubmit} disabled={submitting}>
        <span className="staff-menu-submit__count">{cartCount}</span>
        <span>{submitting ? '送信中...' : '注文を追加する'}</span>
        <span>¥{cartTotal.toLocaleString()}</span>
      </button>
    </div>
  )
}
