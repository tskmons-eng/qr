import { formatCartOptions } from '../../lib/customerCart'

// カートの中身（注文前なので金額は出さない。.claude/rules/ui.md 2章）。数はその場で増減。
export default function CartItemList({ items, onUpdateQuantity }) {
  if (items.length === 0) return <p className="customer-cart__empty">カートは空です</p>

  return (
    <div className="customer-cart__items">
      {items.map(item => (
        <CartItemRow key={item.id} item={item} onUpdateQuantity={onUpdateQuantity} />
      ))}
    </div>
  )
}

function CartItemRow({ item, onUpdateQuantity }) {
  const { id, product, quantity, optionSelections } = item
  const optionText = formatCartOptions(optionSelections)

  return (
    <div className="customer-cart__item">
      <div className="customer-cart__item-main">
        <div className="customer-cart__item-name">{product.name}</div>
        {optionText && <div className="customer-cart__item-options">{optionText}</div>}
      </div>
      <div className="customer-step" aria-label={`${product.name}の数`}>
        <button type="button" onClick={() => onUpdateQuantity(id, quantity - 1)} aria-label={`${product.name}を1つ減らす`}>−</button>
        <span aria-live="polite">{quantity}</span>
        <button type="button" className="is-plus" disabled={quantity >= 99} onClick={() => onUpdateQuantity(id, quantity + 1)} aria-label={`${product.name}を1つ増やす`}>＋</button>
      </div>
    </div>
  )
}
