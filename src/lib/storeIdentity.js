export const STORE_NAME_FALLBACK = '店舗名未設定'
export const STORE_NAME_MAX_LENGTH = 40

export function normalizeStoreName(value) {
  const normalizedName = String(value ?? '').trim().replace(/\s+/g, ' ')
  return normalizedName || STORE_NAME_FALLBACK
}

export function validateStoreName(value) {
  const normalizedName = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (normalizedName.length > STORE_NAME_MAX_LENGTH) {
    return `店舗名は${STORE_NAME_MAX_LENGTH}文字以内で入力してください`
  }
  return ''
}
