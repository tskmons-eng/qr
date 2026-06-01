export function sortOrderItemsByOrderedAt(items) {
  return [...items].sort((a, b) => (a.orderedAt?.seconds ?? 0) - (b.orderedAt?.seconds ?? 0))
}

export function filterVisibleOrderItems(items) {
  return items.filter(item => item.itemStatus !== 'cancelled')
}

export function splitTableOrderItems(items) {
  return {
    orderedItems: items.filter(item => item.itemStatus === 'ordered'),
    servedItems: items.filter(item => item.itemStatus === 'served'),
  }
}

export function calculateTableOrderTotal(items) {
  return items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0)
}

export function stepGuestInputValue(value, delta) {
  const current = parseInt(value || '0', 10)
  return String(delta < 0 ? Math.max(0, current + delta) : current + delta)
}

export function formatTableOrderOptions(optionSelections) {
  if (!optionSelections || optionSelections.length === 0) return null
  return optionSelections.map(option => option.choice).join(' · ')
}
