import { normalizeTags } from './productTags.js'

export const defaultDiscountConfig = {
  enabled: false,
  type: 'amount',
  value: '',
  startDate: '',
  endDate: '',
  weekdays: [],
}

export const emptyProductForm = {
  name: '',
  price: '',
  categoryId: '',
  isVisible: true,
  isSoldOut: false,
  optionsEnabled: false,
  options: [],
  linkedEnabled: false,
  linkedProductIds: [],
  displayCategoryIds: [],
  tagsInput: '',
  discountConfig: defaultDiscountConfig,
}

export function normalizeChoices(choices) {
  return (choices ?? []).map(choice => (
    typeof choice === 'string' ? { label: choice, extraPrice: 0 } : choice
  ))
}

export function normalizeOptionGroups(options) {
  return (options ?? []).map(group => ({
    groupName: (group.groupName ?? '').trim(),
    required: group.required ?? true,
    choices: normalizeChoices(group.choices)
      .map(choice => ({
        label: (choice.label ?? '').trim(),
        extraPrice: Math.max(0, Number(choice.extraPrice) || 0),
      }))
      .filter(choice => choice.label),
  }))
}

export function cleanOptionGroups(options) {
  return normalizeOptionGroups(options).filter(group => (
    group.groupName && (group.choices ?? []).length > 0
  ))
}

export function normalizeDiscountConfig(discountConfig) {
  return {
    ...defaultDiscountConfig,
    ...(discountConfig ?? {}),
    value: discountConfig?.value === undefined ? '' : String(discountConfig.value),
    weekdays: discountConfig?.weekdays ?? [],
  }
}

export function cleanDiscountConfig(discountConfig) {
  const value = Math.max(0, Number(discountConfig?.value) || 0)
  return {
    enabled: !!discountConfig?.enabled && value > 0,
    type: discountConfig?.type === 'percent' ? 'percent' : 'amount',
    value,
    startDate: discountConfig?.startDate ?? '',
    endDate: discountConfig?.endDate ?? '',
    weekdays: discountConfig?.weekdays ?? [],
  }
}

export function discountLabel(discountConfig) {
  if (!discountConfig?.enabled) return ''
  const value = Number(discountConfig.value) || 0
  if (value <= 0) return ''
  return discountConfig.type === 'percent' ? `${value}%OFF` : `¥${value.toLocaleString()}OFF`
}

export function mergeTagsInput(currentValue, tagsToAdd) {
  return [...new Set([...normalizeTags(currentValue), ...normalizeTags(tagsToAdd)])].join(', ')
}

export function buildNewProductPayload({ storeId, form, sortOrder, timestamp }) {
  return {
    storeId,
    name: form.name.trim(),
    price: Number(form.price),
    categoryId: form.categoryId,
    isVisible: form.isVisible,
    isSoldOut: form.isSoldOut,
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function buildProductUpdatePayload({ form, imageUrl, timestamp }) {
  return {
    name: form.name.trim(),
    price: Number(form.price),
    categoryId: form.categoryId,
    displayCategoryIds: (form.displayCategoryIds ?? []).filter(id => id !== form.categoryId),
    tags: normalizeTags(form.tagsInput),
    isVisible: form.isVisible,
    isSoldOut: form.isSoldOut,
    options: form.optionsEnabled ? cleanOptionGroups(form.options) : [],
    discountConfig: cleanDiscountConfig(form.discountConfig),
    linkedProductIds: form.linkedEnabled ? (form.linkedProductIds ?? []) : [],
    imageUrl: imageUrl ?? null,
    updatedAt: timestamp,
  }
}

export function buildOptionsUpdatePayload({ form, timestamp }) {
  return {
    options: form.optionsEnabled ? cleanOptionGroups(form.options) : [],
    updatedAt: timestamp,
  }
}

export function buildRelatedProductsUpdatePayload({ form, timestamp }) {
  return {
    linkedProductIds: form.linkedEnabled ? (form.linkedProductIds ?? []) : [],
    updatedAt: timestamp,
  }
}

export function buildQuickCategoryPayload({ storeId, name, sortOrder, timestamp }) {
  return {
    storeId,
    name: name.trim(),
    sortOrder,
    autoTagMode: false,
    autoTags: [],
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function buildCategoryPayload({ storeId, name, group, autoTagMode, tagsInput, sortOrder, timestamp }) {
  return {
    storeId,
    name: name.trim(),
    group,
    sortOrder,
    autoTagMode,
    autoTags: normalizeTags(tagsInput),
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function buildCategoryUpdatePayload({ name, group, autoTagMode, tagsInput, timestamp }) {
  return {
    name: name.trim(),
    group,
    autoTagMode,
    autoTags: normalizeTags(tagsInput),
    updatedAt: timestamp,
  }
}
