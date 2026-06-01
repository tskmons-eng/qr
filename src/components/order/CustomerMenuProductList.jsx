import { getDiscountedProductPrice } from '../../lib/discounts'

export default function CustomerMenuProductList({
  products,
  cartItems,
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

        return (
          <div key={product.id} className="customer-product">
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
                  オプションあり{optionQuantity > 0 && ` / ${optionQuantity}個選択中`}
                </div>
              )}
              {product.isSoldOut && <div className="customer-product__sold-out">売り切れ</div>}
            </div>

            {product.imageUrl && (
              <img className="customer-product__image" src={product.imageUrl} alt={product.name} />
            )}

            {hasOptions ? (
              <button
                type="button"
                className="customer-product__select"
                disabled={product.isSoldOut}
                onClick={() => onAddProduct(product)}
              >
                選択
              </button>
            ) : (
              <div className="customer-product__quantity">
                <button
                  type="button"
                  disabled={product.isSoldOut || !simpleItem}
                  onClick={() => onSetSimpleProductQuantity(product, (simpleItem?.quantity ?? 0) - 1)}
                >
                  -
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="99"
                  value={simpleItem?.quantity ?? ''}
                  onChange={e => onSetSimpleProductQuantity(product, e.target.value)}
                  placeholder="0"
                  disabled={product.isSoldOut}
                />
                <button
                  type="button"
                  className="is-plus"
                  disabled={product.isSoldOut}
                  onClick={() => onSetSimpleProductQuantity(product, (simpleItem?.quantity ?? 0) + 1)}
                >
                  +
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
