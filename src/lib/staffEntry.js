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
