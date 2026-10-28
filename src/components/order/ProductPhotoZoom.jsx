import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getDiscountedProductPrice } from '../../lib/discounts'

// 写真を押したとき、ふわっと大きく見せる（ユーザー様 2026-10-28「写真タップしたら軽く拡大されるように！」）。
// 名前・値段と、そのままカートへ入れるボタン付き。外側か × で閉じる。選ぶもののある品は「選ぶ」のシートへ。
export default function ProductPhotoZoom({ product, disabled = false, onAdd, onSelectOptions, onClose }) {
  const [quantity, setQuantity] = useState(1)
  const hasOptions = (product.options ?? []).length > 0
  const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal((
    <div className="customer-photo-zoom" role="presentation" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="customer-photo-zoom__card" role="dialog" aria-modal="true" aria-label={product.name}>
        <img className="customer-photo-zoom__image" src={product.imageUrl} alt={product.name} decoding="async" />
        <button type="button" className="customer-photo-zoom__close" onClick={onClose} aria-label="閉じる">×</button>
        <div className="customer-photo-zoom__body">
          <div className="customer-photo-zoom__name">{product.name}</div>
          <div className="customer-photo-zoom__price">
            {discountAmount > 0 && <span className="customer-product__original-price">¥{originalPrice.toLocaleString()}</span>}
            ¥{discountedPrice.toLocaleString()}
          </div>
          {product.isSoldOut ? (
            <p className="customer-photo-zoom__sold-out">本日売り切れ</p>
          ) : hasOptions ? (
            <button type="button" className="customer-photo-zoom__add" disabled={disabled} onClick={onSelectOptions}>選ぶ</button>
          ) : (
            <div className="customer-photo-zoom__row">
              <div className="customer-step" aria-label={`${product.name}の数`}>
                <button type="button" onClick={() => setQuantity(value => Math.max(1, value - 1))} aria-label="1つ減らす">−</button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" className="is-plus" onClick={() => setQuantity(value => Math.min(99, value + 1))} aria-label="1つ増やす">＋</button>
              </div>
              <button type="button" className="customer-photo-zoom__add" disabled={disabled} onClick={() => onAdd(quantity)}>カートへ</button>
            </div>
          )}
        </div>
      </section>
    </div>
  ), document.body)
}
