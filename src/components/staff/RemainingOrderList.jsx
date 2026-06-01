import { formatTableOrderOptions } from '../../lib/staffTableDetail'

export default function RemainingOrderList({ emptyText, items, served, title, onMarkServed }) {
  return (
    <section className="staff-remaining-section">
      <div className="staff-remaining-section__title">{title}</div>
      <div className="staff-remaining-list">
        {items.map(item => (
          served ? (
            <ServedRemainingItem key={item.id} item={item} />
          ) : (
            <RemainingItem key={item.id} item={item} onMarkServed={onMarkServed} />
          )
        ))}
        {!served && items.length === 0 && (
          <div className="staff-remaining-empty">{emptyText}</div>
        )}
      </div>
    </section>
  )
}

function RemainingItem({ item, onMarkServed }) {
  const optionsText = formatTableOrderOptions(item.optionSelections)

  return (
    <div className="staff-remaining-row">
      <div className="staff-remaining-row__main">
        <div className="staff-remaining-row__name">{item.productNameSnapshot} × {item.quantity}</div>
        {optionsText && <div className="staff-remaining-row__options">{optionsText}</div>}
        <div className="staff-remaining-row__meta">{item.orderedBy === 'staff' ? 'スタッフ注文' : 'お客様注文'}</div>
      </div>
      <button type="button" onClick={() => onMarkServed(item)} className="staff-remaining-row__button">
        提供済み
      </button>
    </div>
  )
}

function ServedRemainingItem({ item }) {
  return (
    <div className="staff-remaining-served-row">
      <span>{item.productNameSnapshot} × {item.quantity}</span>
      <span className="staff-remaining-served-row__status">提供済み</span>
    </div>
  )
}
