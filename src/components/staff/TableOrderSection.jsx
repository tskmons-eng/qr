import { formatTableOrderOptions } from '../../lib/staffTableDetail'

export default function TableOrderSection({
  title,
  items,
  served,
  onMarkServed,
  onMarkOrdered,
  onCancel,
}) {
  if (items.length === 0) return null

  return (
    <section className="staff-table-order-section">
      <div className="staff-table-section-title">{title}</div>
      <div className="staff-table-order-list">
        {items.map(item => (
          <TableOrderItem
            key={item.id}
            item={item}
            served={served}
            onMarkServed={onMarkServed}
            onMarkOrdered={onMarkOrdered}
            onCancel={onCancel}
          />
        ))}
      </div>
    </section>
  )
}

function TableOrderItem({
  item,
  served,
  onMarkServed,
  onMarkOrdered,
  onCancel,
}) {
  const optionsText = formatTableOrderOptions(item.optionSelections)

  return (
    <div className={`staff-table-order-row${served ? ' is-served' : ''}`}>
      <div className="staff-table-order-main">
        <div className="staff-table-order-name-row">
          <span className="staff-table-order-name">{item.productNameSnapshot} × {item.quantity}</span>
          {item.categoryGroup === 'drink' && <span className="staff-table-category-badge staff-table-category-drink">🥤</span>}
          {item.categoryGroup === 'food' && <span className="staff-table-category-badge staff-table-category-food">🍽</span>}
        </div>
        {optionsText && (
          <div className="staff-table-order-options">{optionsText}</div>
        )}
        <div className="staff-table-order-meta">
          ¥{item.lineTotal.toLocaleString()}
          {!served && <> · {item.orderedBy === 'staff' ? 'スタッフ' : 'お客様'}</>}
        </div>
      </div>
      {served ? (
        <button type="button" onClick={() => onMarkOrdered(item)} className="staff-table-row-button staff-table-row-button-muted">
          戻す
        </button>
      ) : (
        <button type="button" onClick={() => onMarkServed(item)} className="staff-table-row-button staff-table-row-button-primary">
          提供済み
        </button>
      )}
      <button type="button" onClick={() => onCancel(item)} className="staff-table-row-button staff-table-row-button-danger">
        削除
      </button>
    </div>
  )
}
