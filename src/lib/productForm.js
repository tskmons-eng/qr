// 商品と分類の入力（2026-10-23 商品設計で作り直し）。
// タグ・タグセット・オプションのテンプレート・追加表示の分類・関連商品・分類の自動タグは、本番で使われていないので無くした
// （ユーザー様の選択）。古いデータに項目が残っていても、書き換えも読み込みもしない。

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
  options: [],
  discountConfig: defaultDiscountConfig,
}

// 厨房の表示と集計に使う分け方。値は今までの 'food' / 'drink' / ''（その他）のまま。
export const CATEGORY_GROUPS = [
  { key: 'food', label: 'フード' },
  { key: 'drink', label: 'ドリンク' },
  { key: '', label: 'その他' },
]

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

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatMonthDay(isoDate) {
  const [, month, day] = String(isoDate).split('-')
  return month && day ? `${Number(month)}月${Number(day)}日` : ''
}

export function discountLabel(discountConfig) {
  if (!discountConfig?.enabled) return ''
  const value = Number(discountConfig.value) || 0
  if (value <= 0) return ''
  return discountConfig.type === 'percent' ? `${value}%引き` : `${value.toLocaleString()}円引き`
}

// 「100円引き・9月19日〜9月23日・毎日」の形。
export function describeDiscount(discountConfig) {
  const label = discountLabel(discountConfig)
  if (!label) return ''
  const start = formatMonthDay(discountConfig.startDate)
  const end = formatMonthDay(discountConfig.endDate)
  const period = start || end ? `${start}〜${end}` : 'ずっと'
  const weekdays = (discountConfig.weekdays ?? []).length
    ? discountConfig.weekdays.map(day => WEEKDAY_LABELS[day]).join('・')
    : '毎日'
  return `${label}・${period}・${weekdays}`
}

export function productFormFromProduct(product) {
  return {
    name: product.name ?? '',
    price: String(product.price ?? ''),
    categoryId: product.categoryId ?? '',
    isVisible: product.isVisible !== false,
    isSoldOut: product.isSoldOut === true,
    options: (product.options ?? []).map(group => ({ ...group, choices: normalizeChoices(group.choices) })),
    discountConfig: normalizeDiscountConfig(product.discountConfig),
  }
}

export function validateProductForm(form) {
  if (!form.name.trim()) return '商品名を入れてください'
  if (!/^\d+$/.test(String(form.price).trim())) return '値段は数字で入れてください'
  if (!form.categoryId) return '分類を選んでください'
  // 選ぶものは、名前と選択肢がそろっていないと保存しない（黙って捨てると「必ず選ぶ」が効かなくなる）。
  // 名前も選択肢も空のものだけは、入れかけて消し忘れたものとして捨てる。
  for (const group of normalizeOptionGroups(form.options ?? [])) {
    const name = (group.groupName ?? '').trim()
    const choiceCount = (group.choices ?? []).filter(choice => String(choice.label ?? '').trim()).length
    if (!name && choiceCount === 0) continue
    if (!name) return '選ぶものの名前（例：味）を入れてください'
    if (choiceCount === 0) return `「${name}」の選択肢を入れて「足す」を押してください`
  }
  return ''
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
    isVisible: form.isVisible,
    isSoldOut: form.isSoldOut,
    options: cleanOptionGroups(form.options),
    discountConfig: cleanDiscountConfig(form.discountConfig),
    imageUrl: imageUrl ?? null,
    updatedAt: timestamp,
  }
}

export function buildCategoryPayload({ storeId, name, group, sortOrder, timestamp }) {
  return {
    storeId,
    name: name.trim(),
    group,
    sortOrder,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export function buildCategoryUpdatePayload({ name, group, isActive, timestamp }) {
  return {
    name: name.trim(),
    group,
    isActive,
    updatedAt: timestamp,
  }
}

// 次に追加する商品・分類の並び順（削除で番号が空いても重ならないように、最大値の次）。
export function nextSortOrder(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.sortOrder) || 0), -1) + 1
}
