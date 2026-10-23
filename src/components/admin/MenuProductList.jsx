import { useState } from 'react'
import { CATEGORY_GROUPS, discountLabel } from '../../lib/productForm'

// メニュー一覧（2026-10-23 商品設計）。分類の見出しの下に1品1行。売り切れはその場で切り替え。
// 「⋮⋮」をつまむ（指は長押し・マウスは引っぱる）と、同じ分類の中で並べ替えられる。
function groupLabel(group) {
  return CATEGORY_GROUPS.find(item => item.key === (group ?? ''))?.label ?? 'その他'
}

function optionSummary(product) {
  const group = (product.options ?? [])[0]
  if (!group) return ''
  return `選ぶ：${(group.choices ?? []).map(choice => choice.label ?? choice).join('・')}`
}

export default function MenuProductList({ sections, touchDrag, reorderHandlers, onOpenProduct, onToggleSoldOut, onToggleVisible, onOpenCategory }) {
  const [dragId, setDragId] = useState(null)

  return (
    <div>
      {sections.map(section => (
        <section key={section.id} className="menu-admin__section">
          <div className="menu-admin__cat">
            <b>{section.name}</b>
            {section.category && (
              <span className={`menu-admin__group${section.category.group ? ` menu-admin__group--${section.category.group}` : ''}`}>
                {groupLabel(section.category.group)}
              </span>
            )}
            {section.category?.isActive === false && <span className="menu-admin__group menu-admin__group--hidden">お客様に出していない</span>}
            <span className="menu-admin__count">{section.products.length}品</span>
            {section.category && (
              <button type="button" onClick={() => onOpenCategory(section.category)} className="menu-admin__cat-edit">分類を直す</button>
            )}
          </div>
          {section.products.map(product => {
            const discount = discountLabel(product.discountConfig)
            const options = optionSummary(product)
            const hidden = product.isVisible === false
            const dropTarget = touchDrag?.type === 'product' && touchDrag.targetId === product.id && touchDrag.id !== product.id
            return (
              <div
                key={product.id}
                data-reorder-type="product"
                data-reorder-id={product.id}
                onDragOver={event => { if (dragId) event.preventDefault() }}
                onDrop={() => { if (dragId) reorderHandlers.onDrop(dragId, product.id); setDragId(null) }}
                className={`menu-admin__item${hidden ? ' is-hidden' : ''}${dropTarget ? ' is-drop-target' : ''}${touchDrag?.id === product.id ? ' is-dragging' : ''}`}
              >
                <span
                  className="menu-admin__grip"
                  draggable
                  onDragStart={() => setDragId(product.id)}
                  onDragEnd={() => setDragId(null)}
                  onTouchStart={event => reorderHandlers.onTouchStart('product', product.id, event)}
                  onTouchMove={event => reorderHandlers.onTouchMove('product', event)}
                  onTouchEnd={event => reorderHandlers.onTouchEnd('product', event)}
                  onTouchCancel={reorderHandlers.onTouchCancel}
                  aria-label="つまんで並べ替え"
                >⋮⋮</span>
                <button type="button" onClick={() => onOpenProduct(product)} className="menu-admin__item-main">
                  {product.imageUrl
                    ? <img src={product.imageUrl} alt="" className="menu-admin__thumb" loading="lazy" />
                    : <span className="menu-admin__thumb menu-admin__thumb--empty">写真なし</span>}
                  <span className="menu-admin__item-text">
                    <b>{product.name}</b>
                    <span className="menu-admin__item-meta">
                      <span className="menu-admin__price">¥{Number(product.price ?? 0).toLocaleString()}</span>
                      {discount && <span className="menu-admin__tag menu-admin__tag--discount">期間割引 {discount}</span>}
                      {options && <span className="menu-admin__tag">{options}</span>}
                      {hidden && <span className="menu-admin__tag">お客様に出していない</span>}
                    </span>
                  </span>
                </button>
                {hidden ? (
                  <button type="button" onClick={() => onToggleVisible(product)} className="menu-admin__switch">出す</button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleSoldOut(product)}
                    className={`menu-admin__switch${product.isSoldOut ? ' is-sold-out' : ''}`}
                  >
                    {product.isSoldOut ? '売り切れ中' : '売切にする'}
                  </button>
                )}
              </div>
            )
          })}
          {section.products.length === 0 && <p className="menu-admin__empty">この分類にはまだ商品がありません</p>}
        </section>
      ))}
    </div>
  )
}
