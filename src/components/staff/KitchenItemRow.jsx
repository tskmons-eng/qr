import { formatKitchenElapsed, formatKitchenOrderOptions } from '../../lib/kitchenDisplay'

export default function KitchenItemRow({ item, nowMs, servedWorkflowEnabled, onCancel, onServed }) {
  const optionsText = formatKitchenOrderOptions(item.optionSelections)

  return (
    <div className="staff-kitchen-item">
      <div className="staff-kitchen-item__main">
        <div className="staff-kitchen-item__title">
          <span className="staff-kitchen-item__name">{item.productNameSnapshot}</span>
          <span className="staff-kitchen-item__quantity">× {item.quantity}</span>
        </div>
        {optionsText && (
          <div className="staff-kitchen-item__options">{optionsText}</div>
        )}
        <div className="staff-kitchen-item__meta">
          {servedWorkflowEnabled && `${formatKitchenElapsed(item.orderedAt, nowMs)}前 ・ `}
          {item.orderedBy === 'staff' ? 'スタッフ' : 'お客様'}
        </div>
      </div>
      <div className="staff-kitchen-item__actions">
        {servedWorkflowEnabled && (
          <button type="button" onClick={() => onServed(item)} className="staff-kitchen-item__served">
            提供済み
          </button>
        )}
        <button type="button" onClick={() => onCancel(item)} className="staff-kitchen-item__cancel">
          削除
        </button>
      </div>
    </div>
  )
}
