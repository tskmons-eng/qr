import { getDiscountedProductPrice } from '../../lib/discounts'

export default function CustomerMenuProductList({
  products,
  cartItems,
  interactionDisabled = false,
  customerMenuTapToAddEnabled = true,
  onAddProduct,
  onSetSimpleProductQuantity,
}) {
  if (products.length === 0) {
    return <p className="customer-menu__empty">この分類に商品がありません</p>
  }

  return (
    <div>
      {products.map(product => {
        const hasOptions = (product.options ?? []).length > 0
        const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
        const simpleItem = cartItems.find(item => item.product.id === product.id && item.optionSelections.length === 0)
        const optionQuantity = cartItems
          .filter(item => item.product.id === product.id && item.optionSelections.length > 0)
          .reduce((sum, item) => sum + item.quantity, 0)
        const rowTapEnabled = customerMenuTapToAddEnabled && !product.isSoldOut && !interactionDisabled
        const tapLabel = hasOptions ? `${product.name}のオプションを選択` : `${product.name}を1個追加`
        const ProductMain = rowTapEnabled ? 'button' : 'div'

        function handleRowTap() {
          if (!rowTapEnabled) return
          if (hasOptions) {
            onAddProduct(product)
            return
          }
          onSetSimpleProductQuantity(product, (simpleItem?.quantity ?? 0) + 1)
        }

        return (
          <div
            key={product.id}
            className={`customer-product${product.isSoldOut ? ' is-sold-out' : ''}`}
          >
            <ProductMain
              className="customer-product__main"
              {...(rowTapEnabled ? {
                type: 'button',
                onClick: handleRowTap,
                'aria-label': tapLabel,
              } : {})}
            >
              <div className="customer-product__body">
                <div className={`customer-product__name${product.isSoldOut ? ' is-sold-out' : ''}`}>{product.name}</div>
                <div className={`customer-product__price${discountAmount > 0 ? ' has-discount' : ''}`}>
                  ¥{discountedPrice.toLocaleString()}
                  {discountAmount > 0 && (
                    <span className="customer-product__original-price">¥{originalPrice.toLocaleString()}</span>
                  )}
                </div>
                {hasOptions && !product.isSoldOut && (
                  <div className="customer-product__options">
                    {optionQuantity > 0 ? `${optionQuantity}個選択中` : 'オプションあり'}
                  </div>
                )}
                {product.isSoldOut && <div className="customer-product__sold-out">本日売り切れ</div>}
              </div>

              {product.imageUrl && (
                <img
                  className="customer-product__image"
                  src={product.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width="68"
                  height="68"
                />
              )}
            </ProductMain>

            {hasOptions ? (
              <button
                type="button"
                className="customer-product__select"
                disabled={product.isSoldOut || interactionDisabled}
                onClick={() => onAddProduct(product)}
              >
                {optionQuantity > 0 ? `選択中 ${optionQuantity}` : '選ぶ'}
              </button>
            ) : simpleItem ? (
              <div
                className="customer-product__quantity"
                aria-label={`${product.name}の数量`}
              >
                <button
                  type="button"
                  disabled={product.isSoldOut || interactionDisabled}
                  onClick={() => onSetSimpleProductQuantity(product, simpleItem.quantity - 1)}
                  aria-label={`${product.name}を1個減らす`}
                >
                  −
                </button>
                <span className="customer-product__quantity-value" aria-live="polite">{simpleItem.quantity}</span>
                <button
                  type="button"
                  className="is-plus"
                  disabled={product.isSoldOut || interactionDisabled}
                  onClick={() => onSetSimpleProductQuantity(product, simpleItem.quantity + 1)}
                  aria-label={`${product.name}を1個増やす`}
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="customer-product__add"
                disabled={product.isSoldOut || interactionDisabled}
                onClick={() => onSetSimpleProductQuantity(product, 1)}
                aria-label={`${product.name}を1個追加`}
              >
                +
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
