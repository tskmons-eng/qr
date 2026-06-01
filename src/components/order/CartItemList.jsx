import { calculateCartItemPricing, formatCartOptions, normalizeCartQuantity } from '../../lib/customerCart'

export default function CartItemList({ items, total, onUpdateQuantity }) {
  if (items.length === 0) return <p className="customer-cart__empty">カートは空です</p>

  return (
    <>
      <div className="customer-cart__items">
        {items.map(item => (
          <CartItemRow key={item.id} item={item} onUpdateQuantity={onUpdateQuantity} />
        ))}
      </div>
      <div className="customer-cart__total-row">
        <span>合計</span>
        <span>¥{total.toLocaleString()}</span>
      </div>
    </>
  )
}

function CartItemRow({ item, onUpdateQuantity }) {
  const { id, product, quantity, optionSelections } = item
  const optionText = formatCartOptions(optionSelections)
  const pricing = calculateCartItemPricing({ product, optionSelections, quantity })

  return (
    <div className="customer-cart__item">
      <div className="customer-cart__item-main">
        <div className="customer-cart__item-name">{product.name}</div>
        {optionText && <div className="customer-cart__item-options">{optionText}</div>}
        <div className="customer-cart__item-unit">
          ¥{pricing.unitPrice.toLocaleString()}
          {pricing.discountAmount > 0 && (
            <span className="customer-cart__regular-price">
              通常¥{pricing.regularUnitPrice.toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <div className="customer-cart__quantity">
        <button type="button" onClick={() => onUpdateQuantity(id, quantity - 1)} className="customer-cart__step">-</button>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          max="99"
          value={quantity}
          onChange={event => onUpdateQuantity(id, normalizeCartQuantity(event.target.value))}
          className="customer-cart__quantity-input"
        />
        <button type="button" onClick={() => onUpdateQuantity(id, quantity + 1)} className="customer-cart__step">+</button>
      </div>
      <div className="customer-cart__line-total">¥{pricing.lineTotal.toLocaleString()}</div>
    </div>
  )
}
