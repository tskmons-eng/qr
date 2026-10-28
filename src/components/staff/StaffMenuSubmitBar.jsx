import OrderCommandErrorNotice from '../OrderCommandErrorNotice'

// 売り切れで品を外してカートが空になっても、何が起きたかの知らせは残す。
export default function StaffMenuSubmitBar({ cartCount, cartTotal, errorMessage, submitting, onSubmit }) {
  if (cartCount <= 0 && !errorMessage) return null

  return (
    <div className="staff-menu-submit">
      <OrderCommandErrorNotice message={errorMessage} />
      {cartCount > 0 && (
        <button type="button" onClick={onSubmit} disabled={submitting}>
          <span className="staff-menu-submit__count">{cartCount}</span>
          <span>{submitting ? '送信中...' : '注文を追加する'}</span>
          <span>¥{cartTotal.toLocaleString()}</span>
        </button>
      )}
    </div>
  )
}
