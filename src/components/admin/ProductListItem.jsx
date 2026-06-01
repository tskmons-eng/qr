export default function ProductListItem({
  product,
  categoryName,
  isFirst,
  isLast,
  dragProductId,
  touchDrag,
  onMove,
  onReorder,
  onSetDragProductId,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  onToggleSoldOut,
  onToggleVisible,
  onEdit,
}) {
  const isDragging = dragProductId === product.id || touchDrag?.id === product.id
  const className = [
    'product-list-item',
    touchDrag?.targetId === product.id ? 'is-reorder-target' : '',
    isDragging ? 'is-dragging' : '',
    product.isVisible ? '' : 'is-hidden',
    touchDrag?.type === 'product' ? 'is-touch-reordering' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      data-reorder-type="product"
      data-reorder-id={product.id}
      draggable
      onTouchStart={event => onTouchStart('product', product.id, event)}
      onTouchMove={event => onTouchMove('product', event)}
      onTouchEnd={event => onTouchEnd('product', event)}
      onTouchCancel={onTouchCancel}
      onDragStart={event => {
        onSetDragProductId(product.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={event => event.preventDefault()}
      onDrop={async event => {
        event.preventDefault()
        await onReorder(dragProductId, product.id)
        onSetDragProductId(null)
      }}
      onDragEnd={() => onSetDragProductId(null)}
      className={className}
    >
      <div className="product-list-row">
        <div className="product-list-main">
          <div className="sort-button-stack">
            <button type="button" onClick={() => onMove(product, -1)} disabled={isFirst} className="sort-move-button">▲</button>
            <button type="button" onClick={() => onMove(product, 1)} disabled={isLast} className="sort-move-button">▼</button>
          </div>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="product-list-image" />
          ) : (
            <div className="product-list-image-placeholder" />
          )}
          <div>
            <div className="product-list-category">{categoryName}</div>
            <div className="product-list-name">{product.name}</div>
            <div className="product-list-meta">
              ¥{product.price.toLocaleString()}
              {(product.options ?? []).length > 0 && <span className="product-list-muted-label">オプションあり</span>}
              {(product.linkedProductIds ?? []).length > 0 && <span className="product-list-muted-label">関連{product.linkedProductIds.length}件</span>}
              {(product.displayCategoryIds ?? []).length > 0 && <span className="product-list-category-count">+{product.displayCategoryIds.length}カテゴリー</span>}
            </div>
            {(product.tags ?? []).length > 0 && (
              <div className="product-list-tags">
                {product.tags.map(tag => (
                  <span key={tag} className="tag-pill">#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="product-list-actions">
          {product.isSoldOut && <span className="sold-out-badge">売切</span>}
          <button type="button" onClick={() => onToggleSoldOut(product)} className="button button-secondary product-list-action">
            {product.isSoldOut ? '売切解除' : '売切'}
          </button>
          <button type="button" onClick={() => onToggleVisible(product)} className="button button-secondary product-list-action">
            {product.isVisible ? '非表示' : '表示'}
          </button>
          <button type="button" onClick={() => onEdit(product)} className="button button-secondary product-list-action">
            編集
          </button>
        </div>
      </div>
    </div>
  )
}
