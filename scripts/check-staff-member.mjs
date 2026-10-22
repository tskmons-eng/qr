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
const staffDetailSheet = readFileSync(new URL('../src/components/admin/StaffDetailSheet.jsx', import.meta.url), 'utf8')
const staffAddSheet = readFileSync(new URL('../src/components/admin/StaffAddSheet.jsx', import.meta.url), 'utf8')

// 2026-10-23 スタッフ管理の作り直し：1人1行、押すと詳細のシート。削除の確認はシートの中（ブラウザの確認窓を使わない）。
assert.match(staffPage, /updateStaffMemberCode\(\{ storeId, memberId: member\.id, currentCode: requireCurrentCode \? currentCode : undefined, nextCode \}\)/)
assert.match(staffPage, /const requireCurrentCode = !activeStaff\?\.isStoreManager/)
assert.match(staffPage, /isSelf=\{openMember\.id === activeStaff\?\.id\}/)
assert.doesNotMatch(staffPage, /confirm\(|member\.code/)
assert.match(staffDetailSheet, /\{requireCurrentCode && \(/)
assert.match(staffDetailSheet, /view === 'delete'/)
// 新しいスタッフの最初の役割は通常スタッフ（ユーザー様の選択）。
assert.match(staffAddSheet, /useState\(NEW_STAFF_PERMISSION_PRESET\)/)

// 役割の表示：役割だけ持つスタッフはその役割、項目も役割も無いスタッフは「以前の設定」。
const roles = await import('../src/lib/staffPermissions.js')
assert.equal(roles.getStaffRoleDisplay({ permissionPreset: 'manager' }).label, '店舗管理者')
assert.equal(roles.getStaffRoleDisplay({}).key, 'legacy')
assert.notEqual(roles.getStaffRoleDisplay({ permissionPreset: 'unknown' }).key, 'legacy', 'unknown preset follows the actual permissions')
assert.equal(roles.getStaffRoleDisplay({ permissionPreset: 'floor', permissions: { useKitchen: true, closeRegister: true } }).key, 'custom')

// 二次元コードで店舗コードが入る（/join/<店舗コード>）。
const { buildStaffJoinUrl } = await import('../src/lib/staffEntry.js')
assert.equal(buildStaffJoinUrl('K7MPQ2', 'https://example.test'), 'https://example.test/join/K7MPQ2')
const app = readFileSync(new URL('../src/AuthenticatedApp.jsx', import.meta.url), 'utf8')
assert.match(app, /path="\/join\/:code" element=\{<StoreJoinPage \/>\}/)
const storeCodeEntry = readFileSync(new URL('../src/hooks/useStoreCodeEntry.js', import.meta.url), 'utf8')
assert.match(storeCodeEntry, /enterStaffStoreByCode\(normalized, \{ forceAnonymous: true \}\)/, 'QR entry still signs in as an anonymous staff device')

console.log('staff member checks passed')
