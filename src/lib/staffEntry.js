export const SAVED_STAFF_STORE_CODE_KEY = 'savedStaffStoreCode'

export function normalizeStaffStoreCode(value) {
  return value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
}

export function canEnterStaffStore(code) {
  return code.trim().toUpperCase().length >= 6
}

export function getSavedStaffStoreCode(storage = localStorage) {
  return storage.getItem(SAVED_STAFF_STORE_CODE_KEY)
}

export function saveStaffStoreCodePreference({ code, remember, storage = localStorage }) {
  if (remember) {
    storage.setItem(SAVED_STAFF_STORE_CODE_KEY, code)
  } else {
    storage.removeItem(SAVED_STAFF_STORE_CODE_KEY)
  }
}

// スタッフの端末で読む二次元コードの行き先（2026-10-23）。読むと店舗コードが入る。店舗コードと同じ扱いなので店の外に貼らない。
export const STAFF_JOINED_BY_QR_KEY = 'staffJoinedByQr'

export function buildStaffJoinUrl(code, origin = window.location.origin) {
  return `${origin}/join/${encodeURIComponent(code)}`
}

