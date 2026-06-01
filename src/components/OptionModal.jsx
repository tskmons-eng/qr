import { useState } from 'react'
import { getDiscountedProductPrice } from '../lib/discounts'
import {
  buildMultiQuantityOptionItems,
  buildOptionSelections,
  calculateChoiceQuantityTotal,
  calculateMultiQuantityTotal,
  calculateOptionExtraTotal,
  canConfirmOptionModal,
  normalizeChoiceQuantity,
  normalizeQuantity,
} from '../lib/optionModal'
import OptionChoiceQuantityList from './option-modal/OptionChoiceQuantityList'
import OptionGroupSelector from './option-modal/OptionGroupSelector'
import OptionModalActions from './option-modal/OptionModalActions'
import OptionModalHeader from './option-modal/OptionModalHeader'
import OptionModalSummary from './option-modal/OptionModalSummary'
import OptionQuantityControl from './option-modal/OptionQuantityControl'

export default function OptionModal({ product, onConfirm, onClose }) {
  const options = product.options ?? []
  const [selections, setSelections] = useState({})
  const [quantity, setQuantity] = useState(1)
  const [choiceQuantities, setChoiceQuantities] = useState({})
  const multiQuantityMode = options.length === 1

  function handleSelect(group, choice) {
    setSelections(prev => {
      const current = prev[group.groupName]
      const isSame = current?.label === choice.label
      if (isSame && !group.required) {
        const next = { ...prev }
        delete next[group.groupName]
        return next
      }
      return { ...prev, [group.groupName]: choice }
    })
  }

  function handleChoiceQuantityChange(choiceLabel, value) {
    setChoiceQuantities(prev => ({
      ...prev,
      [choiceLabel]: normalizeChoiceQuantity(value),
    }))
  }

  function handleQuantityChange(value) {
    setQuantity(normalizeQuantity(value))
  }

  function handleConfirm() {
    if (multiQuantityMode) {
      onConfirm(buildMultiQuantityOptionItems(options[0], choiceQuantities))
      return
    }

    onConfirm(buildOptionSelections(options, selections), quantity)
  }

  const choiceQuantityTotal = calculateChoiceQuantityTotal(choiceQuantities)
  const allRequiredSelected = canConfirmOptionModal({
    options,
    selections,
    choiceQuantities,
    multiQuantityMode,
  })
  const totalExtra = calculateOptionExtraTotal(selections)
  const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)
  const unitPrice = discountedPrice + totalExtra
  const modalTotal = multiQuantityMode
    ? calculateMultiQuantityTotal(options[0], choiceQuantities, discountedPrice)
    : unitPrice * quantity
  const confirmLabel = multiQuantityMode ? `${choiceQuantityTotal}個追加` : `${quantity}個追加`

  return (
    <div className="option-modal-backdrop" onClick={onClose}>
      <div className="option-modal" onClick={event => event.stopPropagation()}>
        <OptionModalHeader
          productName={product.name}
          unitPrice={unitPrice}
          originalPrice={originalPrice}
          totalExtra={totalExtra}
          discountAmount={discountAmount}
        />

        {multiQuantityMode ? (
          <>
            <OptionChoiceQuantityList
              group={options[0]}
              choiceQuantities={choiceQuantities}
              discountedPrice={discountedPrice}
              onQuantityChange={handleChoiceQuantityChange}
            />
            <OptionModalSummary quantity={choiceQuantityTotal} total={modalTotal} />
          </>
        ) : (
          <>
            {options.map(group => (
              <OptionGroupSelector
                key={group.groupName}
                group={group}
                selectedChoiceLabel={selections[group.groupName]?.label}
                onSelect={handleSelect}
              />
            ))}
            <OptionQuantityControl
              quantity={quantity}
              totalPrice={modalTotal}
              onQuantityChange={handleQuantityChange}
            />
          </>
        )}

        <OptionModalActions
          canConfirm={allRequiredSelected}
          confirmLabel={confirmLabel}
          onCancel={onClose}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  )
}
