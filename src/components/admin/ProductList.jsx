import ProductListItem from './ProductListItem'

export default function ProductList({
  products,
  displayedProducts,
  productSearch,
  productCatFilter,
  dragProductId,
  touchDrag,
  getCategoryName,
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
  return (
    <div className="admin-list-stack">
      {displayedProducts.map(product => {
        const index = products.indexOf(product)
        return (
          <ProductListItem
            key={product.id}
            product={product}
            categoryName={getCategoryName(product.categoryId)}
            isFirst={index === 0}
            isLast={index === products.length - 1}
            dragProductId={dragProductId}
            touchDrag={touchDrag}
            onMove={onMove}
            onReorder={onReorder}
            onSetDragProductId={onSetDragProductId}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchCancel}
            onToggleSoldOut={onToggleSoldOut}
            onToggleVisible={onToggleVisible}
            onEdit={onEdit}
          />
        )
      })}
      {displayedProducts.length === 0 && (
        <p className="admin-empty-state">
          {productSearch || productCatFilter ? '該当する商品がありません' : '商品がまだありません'}
        </p>
      )}
    </div>
  )
}
