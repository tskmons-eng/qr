function formatOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(option => option.choice).join(' · ')
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
              {cartItems.map(cartItem => cartItem.optionSelections.length > 0 && (
                <div key={cartItem.id} className="staff-menu-product__options">
                  {formatOptions(cartItem.optionSelections)} × {cartItem.quantity}
                </div>
              ))}
            </div>

            {!hasOptions && simpleItem ? (
              <div className="staff-menu-product__quantity">
                <button type="button" onClick={() => onUpdateQuantity(simpleItem.id, simpleItem.quantity - 1)}>−</button>
                <span>{simpleItem.quantity}</span>
                <button type="button" className="is-plus" onClick={() => onUpdateQuantity(simpleItem.id, simpleItem.quantity + 1)}>+</button>
              </div>
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
