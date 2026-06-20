import { formatKitchenElapsed, formatKitchenOrderOptions } from '../../lib/kitchenDisplay'

function getKitchenOrderActorLabel(item) {
  if (item.orderedBy === 'staff') {
    return item.orderedByStaffName?.trim()
      || item.staffName?.trim()
      || item.actorStaffName?.trim()
      || item.orderedByName?.trim()
      || 'スタッフ'
  }
  if (item.orderedBy === 'customer') return 'お客様'
  return item.orderedBy ?? '不明'
}

export default function KitchenItemRow({ item, nowMs, servedWorkflowEnabled, onCancel, onServed }) {
  const optionsText = formatKitchenOrderOptions(item.optionSelections)
  const actorLabel = getKitchenOrderActorLabel(item)

  return (
    <div className="staff-kitchen-item">
      <div className="staff-kitchen-item__main">
        <div className="staff-kitchen-item__title">
          <span className="staff-kitchen-item__name">{item.productNameSnapshot}</span>
          <span className="staff-kitchen-item__quantity">× {item.quantity}</span>
          {optionsText && (
            <span className="staff-kitchen-item__options">{optionsText}</span>
          )}
        </div>
        <div className="staff-kitchen-item__meta">
          {servedWorkflowEnabled && (
            <span className="staff-kitchen-item__elapsed">{formatKitchenElapsed(item.orderedAt, nowMs)}前</span>
          )}
          <span className="staff-kitchen-item__actor">{actorLabel}</span>
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
