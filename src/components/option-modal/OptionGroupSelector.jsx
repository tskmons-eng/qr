import { normalizeOptionChoice } from '../../lib/optionModal'

export default function OptionGroupSelector({ group, selectedChoiceLabel, onSelect }) {
  return (
    <section className="option-modal__section">
      <div className="option-modal__section-title">
        {group.groupName}
        {group.required
          ? <span className="option-modal__badge option-modal__badge--required">必須</span>
          : <span className="option-modal__badge">任意</span>
        }
      </div>
      <div className="option-modal__choice-buttons">
        {(group.choices ?? []).map(choice => {
          const normalized = normalizeOptionChoice(choice)
          const choiceLabel = normalized.label
          const extraPrice = normalized.extraPrice ?? 0
          const selected = selectedChoiceLabel === choiceLabel

          return (
            <button
              type="button"
              key={choiceLabel}
              onClick={() => onSelect(group, normalized)}
              className={`option-modal__choice-button${selected ? ' is-selected' : ''}`}
            >
              <span>{choiceLabel}</span>
              {extraPrice > 0 && (
                <span className="option-modal__extra-price">+¥{extraPrice.toLocaleString()}</span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
