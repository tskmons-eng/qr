export function normalizeStaffCode(value) {
  return value.replace(/\D/g, '').slice(0, 4)
}

export function buildStaffAutoLoginKey(storeId) {
  return `staffAutoLogin:${storeId}`
}

export function getStaffUpdatedAtSeconds(staff) {
  const updatedAt = staff?.updatedAt
  if (typeof updatedAt?.seconds === 'number') return updatedAt.seconds
  if (typeof updatedAt?.toMillis === 'function') return Math.floor(updatedAt.toMillis() / 1000)
  return null
}

export function getStaffAutoLoginPreference(storeId, storage = localStorage) {
  if (!storeId) return null
  const raw = storage.getItem(buildStaffAutoLoginKey(storeId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.staffId) return null
    return {
      staffId: String(parsed.staffId),
      updatedAtSeconds: typeof parsed.updatedAtSeconds === 'number' ? parsed.updatedAtSeconds : null,
    }
  } catch {
    return null
  }
}

export function saveStaffAutoLoginPreference({ storeId, staff, storage = localStorage }) {
  if (!storeId || !staff?.id) return
  storage.setItem(buildStaffAutoLoginKey(storeId), JSON.stringify({
    staffId: staff.id,
    updatedAtSeconds: getStaffUpdatedAtSeconds(staff),
  }))
}

export function clearStaffAutoLoginPreference(storeId, storage = localStorage) {
  if (!storeId) return
  storage.removeItem(buildStaffAutoLoginKey(storeId))
}

export function canAutoLoginStaff(staff, savedPreference) {
  if (!staff?.id || !savedPreference?.staffId) return false
  if (String(staff.id) !== savedPreference.staffId) return false
  return getStaffUpdatedAtSeconds(staff) === savedPreference.updatedAtSeconds
}

export function validateStaffMemberForm({ name, code }) {
  if (!name.trim()) return '名前を入力してください'
  if (!/^\d{4}$/.test(code)) return 'コードは4桁の数字にしてください'
  return ''
}
