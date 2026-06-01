export function normalizeOptionChoice(choice) {
  if (typeof choice === 'string') return { label: choice, extraPrice: 0 }
  if (!choice) return { label: '', extraPrice: 0 }
  return {
    ...choice,
    label: choice.label ?? '',
    extraPrice: choice.extraPrice ?? 0,
  }
}

export function normalizeQuantity(value) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return 1
  return Math.min(99, Math.max(1, n))
}

export function normalizeChoiceQuantity(value) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return 0
  return Math.min(99, Math.max(0, n))
}

export function calculateChoiceQuantityTotal(choiceQuantities) {
  return Object.values(choiceQuantities).reduce((sum, quantity) => sum + quantity, 0)
}

export function calculateOptionExtraTotal(selections) {
  return Object.values(selections).reduce((sum, selection) => sum + (selection?.extraPrice ?? 0), 0)
}

export function calculateMultiQuantityTotal(group, choiceQuantities, discountedPrice) {
  return (group?.choices ?? []).reduce((sum, choice) => {
    const normalized = normalizeOptionChoice(choice)
    const quantity = choiceQuantities[normalized.label] ?? 0
    return sum + (discountedPrice + (normalized.extraPrice ?? 0)) * quantity
  }, 0)
}

export function buildMultiQuantityOptionItems(group, choiceQuantities) {
  return (group?.choices ?? [])
    .map(choice => {
      const normalized = normalizeOptionChoice(choice)
      const quantity = choiceQuantities[normalized.label] ?? 0
      if (quantity <= 0) return null
      return {
        optionSelections: [{
          groupName: group.groupName,
          choice: normalized.label,
          extraPrice: normalized.extraPrice ?? 0,
        }],
        quantity,
      }
    })
    .filter(Boolean)
}

export function buildOptionSelections(options, selections) {
  return options
    .map(group => {
      const selected = selections[group.groupName]
      if (!selected) return null
      return {
        groupName: group.groupName,
        choice: selected.label,
        extraPrice: selected.extraPrice ?? 0,
      }
    })
    .filter(Boolean)
}

export function canConfirmOptionModal({ options, selections, choiceQuantities, multiQuantityMode }) {
  if (multiQuantityMode) return calculateChoiceQuantityTotal(choiceQuantities) > 0
  return options.filter(group => group.required).every(group => selections[group.groupName])
}
