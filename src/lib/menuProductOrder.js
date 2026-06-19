export function sortSoldOutProductsLast(products = []) {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => {
      const soldOutDelta = Number(Boolean(a.product?.isSoldOut)) - Number(Boolean(b.product?.isSoldOut))
      if (soldOutDelta !== 0) return soldOutDelta
      return a.index - b.index
    })
    .map(entry => entry.product)
}
