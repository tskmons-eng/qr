import {
  groupCustomerOrderItemsByStatus,
  normalizeCustomerOrderItemStatus,
} from '../../lib/customerOrderStatus'

export default function OrderStatusList({
  items,
  latestClientRequestId,
  isReflectingLatestOrder,
  showServedStatus,
  showItemPrice,
}) {
  const sections = groupCustomerOrderItemsByStatus(items, { showServedStatus })

  if (sections.length === 0) {
    return (
      <section className="order-status__list">
        <p className="order-status__empty">
          {isReflectingLatestOrder ? '注文を反映しています。保存済みの場合はまもなく表示されます。' : '注文がありません'}
        </p>
      </section>
    )
  }

  return (
    <section className="order-status__list">
      {sections.map(section => (
        <div key={section.key} className={`order-status__section order-status__section--${section.key}`}>
          <div className="order-status__section-header">
            <div>
              <h2 className="order-status__section-title">{section.sectionTitle}</h2>
              <p className="order-status__section-description">{section.description}</p>
            </div>
            <span className="order-status__section-count">{section.items.length}</span>
          </div>
          {section.items.map(item => (
            <OrderStatusItem
              key={item.id}
              item={item}
              latestClientRequestId={latestClientRequestId}
              showItemPrice={showItemPrice}
            />
          ))}
        </div>
      ))}
    </section>
  )
}

function OrderStatusItem({ item, latestClientRequestId, showItemPrice }) {
  const customerStatus = item.customerStatus ?? normalizeCustomerOrderItemStatus(item.itemStatus)
  const statusLabel = item.customerStatusLabel ?? (customerStatus === 'cancelled' ? 'キャンセル' : '注文済み')
  const isCancelled = customerStatus === 'cancelled'
  const isLatestItem = Boolean(latestClientRequestId) && item.clientRequestId === latestClientRequestId
  const lineTotal = Number(item.lineTotal)
  const priceText = isCancelled
    ? '会計対象外'
    : `¥${(Number.isFinite(lineTotal) ? lineTotal : 0).toLocaleString()}`
  const showStatusBadge = isCancelled

  return (
    <div className={`order-status__item order-status__item--${customerStatus}`}>
      <div className="order-status__item-main">
        <div className="order-status__item-name">
          {item.productNameSnapshot || '商品'} × {item.quantity || 0}
        </div>
        {(showStatusBadge || isLatestItem) && (
          <div className="order-status__item-tags">
            {showStatusBadge && (
              <div className={`order-status__item-badge order-status__item-badge--${customerStatus}`}>
                {statusLabel}
              </div>
            )}
            {isLatestItem && (
              <div className="order-status__item-new-label">今回追加</div>
            )}
          </div>
        )}
      </div>
      {showItemPrice && (
        <div className={`order-status__item-price${isCancelled ? ' order-status__item-price--cancelled' : ''}`}>
          {priceText}
        </div>
      )}
    </div>
  )
}
