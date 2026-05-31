function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isDiscountActive(discountConfig, date = new Date()) {
  if (!discountConfig?.enabled) return false
  const today = todayKey(date)
  if (discountConfig.startDate && today < discountConfig.startDate) return false
  if (discountConfig.endDate && today > discountConfig.endDate) return false
  const weekdays = discountConfig.weekdays ?? []
  if (weekdays.length > 0 && !weekdays.includes(date.getDay())) return false
  return true
}

export function calculateDiscountAmount(price, discountConfig, date = new Date()) {
  if (!isDiscountActive(discountConfig, date)) return 0
  const value = Number(discountConfig.value) || 0
  if (value <= 0) return 0
  if (discountConfig.type === 'percent') {
    return Math.min(price, Math.floor(price * Math.min(value, 100) / 100))
  }
  return Math.min(price, value)
}

export function getDiscountedProductPrice(product, date = new Date()) {
  const price = Number(product?.price) || 0
  const discountAmount = calculateDiscountAmount(price, product?.discountConfig, date)
  return {
    originalPrice: price,
    discountAmount,
    discountedPrice: price - discountAmount,
  }
}
