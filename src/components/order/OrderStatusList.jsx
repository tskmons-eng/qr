import { ORDER_ITEM_STATUS_LABELS } from '../../lib/customerOrderStatus'

export default function OrderStatusList({ items, showServedStatus, showItemPrice }) {
  return (
    <section className="order-status__list">
      {items.map(item => (
        <div key={item.id} className="order-status__item">
          <div>
            <div className="order-status__item-name">{item.productNameSnapshot} × {item.quantity}</div>
            {showServedStatus && (
              <div className={`order-status__item-badge order-status__item-badge--${item.itemStatus}`}>
                {ORDER_ITEM_STATUS_LABELS[item.itemStatus]}
              </div>
            )}
          </div>
          {showItemPrice && (
            <div className="order-status__item-price">¥{item.lineTotal.toLocaleString()}</div>
          )}
        </div>
      ))}
      {items.length === 0 && (
        <p className="order-status__empty">注文がありません</p>
      )}
    </section>
  )
}
