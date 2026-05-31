export function normalizeTags(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '')
  return [...new Set(
    raw
      .split(/[,\s、，]+/)
      .map(tag => tag.trim())
      .filter(Boolean)
  )]
}

export function hasAnyTag(productTags, categoryTags) {
  const productSet = new Set(normalizeTags(productTags))
  return normalizeTags(categoryTags).some(tag => productSet.has(tag))
}

export function productMatchesCategory(product, category) {
  if (!category) return false
  if (product.categoryId === category.id) return true
  if ((product.displayCategoryIds ?? []).includes(category.id)) return true
  return !!category.autoTagMode && hasAnyTag(product.tags, category.autoTags)
}
