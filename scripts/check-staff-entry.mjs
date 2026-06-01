import assert from 'node:assert/strict'
import {
  canEnterStaffStore,
  normalizeStaffStoreCode,
  saveStaffStoreCodePreference,
  SAVED_STAFF_STORE_CODE_KEY,
} from '../src/lib/staffEntry.js'

assert.equal(normalizeStaffStoreCode(' ab-12_cd 345 '), 'AB12CD')
assert.equal(canEnterStaffStore('ABC12'), false)
assert.equal(canEnterStaffStore('ABC123'), true)

const storage = new Map()
const storageAdapter = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key),
}
saveStaffStoreCodePreference({ code: 'ABC123', remember: true, storage: storageAdapter })
assert.equal(storage.get(SAVED_STAFF_STORE_CODE_KEY), 'ABC123')
saveStaffStoreCodePreference({ code: 'ABC123', remember: false, storage: storageAdapter })
assert.equal(storage.has(SAVED_STAFF_STORE_CODE_KEY), false)

console.log('staff entry checks passed')
