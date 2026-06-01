import { normalizeOptionChoice } from '../../lib/optionModal'

export default function OptionChoiceQuantityList({
  group,
  choiceQuantities,
  discountedPrice,
  onQuantityChange,
}) {
  return (
    <section className="option-modal__section">
      <div className="option-modal__section-title">
        {group.groupName}
        <span className="option-modal__badge option-modal__badge--info">選択肢ごとに数量</span>
      </div>
      <div className="option-modal__choice-quantity-list">
        {(group.choices ?? []).map(choice => {
          const normalized = normalizeOptionChoice(choice)
          const choiceLabel = normalized.label
          const extraPrice = normalized.extraPrice ?? 0
          const quantity = choiceQuantities[choiceLabel] ?? 0
          const choicePrice = discountedPrice + extraPrice

          return (
            <div
              key={choiceLabel}
              className={`option-modal__choice-row${quantity > 0 ? ' is-selected' : ''}`}
            >
              <div className="option-modal__choice-main">
                <div className="option-modal__choice-label">{choiceLabel}</div>
                <div className="option-modal__choice-price">
                  ¥{choicePrice.toLocaleString()}
                  {extraPrice > 0 && (
                    <span className="option-modal__extra-price">+¥{extraPrice.toLocaleString()}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="option-modal__round-button"
                onClick={() => onQuantityChange(choiceLabel, Math.max(0, quantity - 1))}
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                max="99"
                value={quantity || ''}
                onChange={event => onQuantityChange(choiceLabel, event.target.value)}
                placeholder="0"
                className="option-modal__choice-input"
              />
              <button
                type="button"
                className="option-modal__round-button option-modal__round-button--primary"
                onClick={() => onQuantityChange(choiceLabel, Math.min(99, quantity + 1))}
              >
                +
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
