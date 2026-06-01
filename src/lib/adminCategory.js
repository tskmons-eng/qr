export function sortAdminCategories(categories) {
  return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

export function normalizeAdminCategoryName(value) {
  return value.trim()
}

export function buildAdminCategoryPayload({ name, sortOrder, storeId, timestamp }) {
  return {
    storeId,
    name: normalizeAdminCategoryName(name),
    sortOrder,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function buildAdminCategoryActivePayload(category, timestamp) {
  return {
    isActive: !category.isActive,
    updatedAt: timestamp,
  }
}
