import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildStaffAutoLoginKey,
  canAutoLoginStaff,
  clearStaffAutoLoginPreference,
  getStaffAutoLoginPreference,
  getStaffUpdatedAtSeconds,
  normalizeStaffCode,
  saveStaffAutoLoginPreference,
  validateStaffMemberForm,
} from '../src/lib/staffMember.js'

assert.equal(normalizeStaffCode('12ab345'), '1234')
assert.equal(normalizeStaffCode('９９９９'), '')

const storage = new Map()
const mockStorage = {
  getItem: key => storage.get(key) ?? null,
  removeItem: key => storage.delete(key),
  setItem: (key, value) => storage.set(key, value),
}

const staff = { id: 'staff-1', name: 'Staff', updatedAt: { seconds: 123 } }
assert.equal(buildStaffAutoLoginKey('store-1'), 'staffAutoLogin:store-1')
assert.equal(getStaffUpdatedAtSeconds(staff), 123)
assert.equal(getStaffUpdatedAtSeconds({ updatedAt: { toMillis: () => 456000 } }), 456)
assert.equal(getStaffUpdatedAtSeconds({}), null)

saveStaffAutoLoginPreference({ storeId: 'store-1', staff, storage: mockStorage })
const savedPreference = getStaffAutoLoginPreference('store-1', mockStorage)
assert.deepEqual(savedPreference, { staffId: 'staff-1', updatedAtSeconds: 123 })
assert.equal(canAutoLoginStaff(staff, savedPreference), true)
assert.equal(canAutoLoginStaff({ ...staff, updatedAt: { seconds: 124 } }, savedPreference), false)
assert.equal(canAutoLoginStaff({ ...staff, id: 'staff-2' }, savedPreference), false)
clearStaffAutoLoginPreference('store-1', mockStorage)
assert.equal(getStaffAutoLoginPreference('store-1', mockStorage), null)

assert.equal(validateStaffMemberForm({ name: '', code: '1234' }), '名前を入力してください')
assert.equal(validateStaffMemberForm({ name: 'Staff', code: '12' }), 'コードは4桁の数字にしてください')
assert.equal(validateStaffMemberForm({ name: 'Staff', code: '1234' }), '')

const staffPage = readFileSync(new URL('../src/pages/admin/StaffPage.jsx', import.meta.url), 'utf8')
const staffMemberList = readFileSync(new URL('../src/components/admin/StaffMemberList.jsx', import.meta.url), 'utf8')
const staffPermissionCss = readFileSync(new URL('../src/styles/admin-staff-permissions.css', import.meta.url), 'utf8')

assert.match(staffPage, /resetCurrentCode/)
assert.match(staffPage, /current !== existing/)
assert.match(staffPage, /updateStaffMemberCode\(\{ memberId: member\.id, code: next \}\)/)
assert.match(staffMemberList, /onResetCurrentCodeChange/)
assert.match(staffMemberList, /placeholder="旧パス"/)
assert.doesNotMatch(staffPermissionCss, /\.admin-staff__help-panel\s*\{[\s\S]*position:\s*absolute/)
assert.match(staffPermissionCss, /\.admin-staff__help\.is-open/)

console.log('staff member checks passed')
