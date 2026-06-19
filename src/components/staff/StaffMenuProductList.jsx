function formatOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(option => option.choice).join(' · ')
}

function QuantityControl({ quantity, compact = false, label, onDecrease, onIncrease }) {
  return (
    <div className={`staff-menu-product__quantity${compact ? ' staff-menu-product__quantity--compact' : ''}`}>
      <button type="button" aria-label={`${label}を減らす`} onClick={onDecrease}>−</button>
      <span>{quantity}</span>
      <button type="button" className="is-plus" aria-label={`${label}を増やす`} onClick={onIncrease}>+</button>
    </div>
  )
}

export default function StaffMenuProductList({
  products,
  cart,
  onAddProduct,
  onUpdateQuantity,
}) {
  return (
    <div>
      {products.map(product => {
        const cartItems = cart.filter(item => item.product.id === product.id)
        const simpleItem = cartItems.find(item => item.optionSelections.length === 0)
        const optionCartItems = cartItems.filter(item => item.optionSelections.length > 0)
        const hasOptions = (product.options ?? []).length > 0

        return (
          <div key={product.id} className="staff-menu-product">
            <div className="staff-menu-product__body">
              <div className={`staff-menu-product__name${product.isSoldOut ? ' is-sold-out' : ''}`}>{product.name}</div>
              <div className="staff-menu-product__price">¥{product.price.toLocaleString()}</div>
              {hasOptions && !product.isSoldOut && (
                <div className="staff-menu-product__hint">選択あり</div>
              )}
              {product.isSoldOut && <div className="staff-menu-product__sold-out">売り切れ</div>}
              {optionCartItems.length > 0 && (
                <div className="staff-menu-product__option-list">
                  {optionCartItems.map(cartItem => {
                    const optionLabel = formatOptions(cartItem.optionSelections) ?? 'オプション'
                    return (
                      <div key={cartItem.id} className="staff-menu-product__option-row">
                        <span className="staff-menu-product__option-label">{optionLabel}</span>
                        <QuantityControl
                          compact
                          label={`${product.name} ${optionLabel}`}
                          quantity={cartItem.quantity}
                          onDecrease={() => onUpdateQuantity(cartItem.id, cartItem.quantity - 1)}
                          onIncrease={() => onUpdateQuantity(cartItem.id, cartItem.quantity + 1)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {!hasOptions && simpleItem ? (
              <QuantityControl
                label={product.name}
                quantity={simpleItem.quantity}
                onDecrease={() => onUpdateQuantity(simpleItem.id, simpleItem.quantity - 1)}
                onIncrease={() => onUpdateQuantity(simpleItem.id, simpleItem.quantity + 1)}
              />
            ) : (
              <button
                type="button"
                className="staff-menu-product__add"
                disabled={product.isSoldOut}
                onClick={() => onAddProduct(product)}
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
