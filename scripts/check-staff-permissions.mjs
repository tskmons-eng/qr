import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  STAFF_PERMISSION_KEYS,
  buildStaffPermissionsFromPreset,
  getStaffPermissionPreset,
  getStaffPermissionSummary,
  getStaffPresetKeyFromPermissions,
  hasStaffPermission,
  normalizeStaffMemberPermissions,
  normalizeStaffPermissions,
  setStaffPermissionValue,
} from '../src/lib/staffPermissions.js'

assert.deepEqual(STAFF_PERMISSION_KEYS, ['useKitchen', 'closeRegister', 'manageMenu', 'manageStaff'])

assert.deepEqual(normalizeStaffPermissions(null), {
  useKitchen: true,
  closeRegister: false,
  manageMenu: false,
  manageStaff: false,
})

assert.equal(hasStaffPermission({ permissions: null }, 'useKitchen'), true)
assert.equal(hasStaffPermission({ permissions: null }, 'manageMenu'), false)
assert.equal(hasStaffPermission({ permissions: null }, 'manageStaff'), false)

assert.deepEqual(buildStaffPermissionsFromPreset('manager'), {
  useKitchen: true,
  closeRegister: true,
  manageMenu: true,
  manageStaff: true,
})
assert.equal(getStaffPermissionPreset('unknown').key, 'operations')

assert.equal(
  normalizeStaffMemberPermissions({
    permissionPreset: 'manager',
    permissions: { useKitchen: true, closeRegister: true, manageMenu: true },
  }).manageStaff,
  true,
)

assert.equal(getStaffPresetKeyFromPermissions(buildStaffPermissionsFromPreset('operations')), 'operations')
assert.equal(getStaffPermissionSummary(buildStaffPermissionsFromPreset('menuLead')), 'キッチン / メニュー管理')

const customPermissions = setStaffPermissionValue(buildStaffPermissionsFromPreset('floor'), 'closeRegister', true)
assert.equal(customPermissions.closeRegister, true)
assert.equal(getStaffPresetKeyFromPermissions(customPermissions), 'operations')
assert.equal(setStaffPermissionValue(customPermissions, 'unknown', true).closeRegister, true)

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const staffLayout = readFileSync(new URL('../src/pages/staff/StaffLayout.jsx', import.meta.url), 'utf8')
const staffShellHeader = readFileSync(new URL('../src/components/staff/StaffShellHeader.jsx', import.meta.url), 'utf8')

assert.match(rules, /function staffPermission\(storeId, permission, legacyDefault\)/)
assert.match(rules, /function canManageMenu\(storeId\)/)
assert.match(rules, /function canCloseRegister\(storeId\)/)
assert.match(rules, /function canManageStaff\(storeId\)/)
assert.match(rules, /match \/products\/\{productId\}[\s\S]*allow create: if canManageMenu\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/cashClosings\/\{closingId\}[\s\S]*allow create: if canCloseRegister\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow create: if canManageStaff\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow update: if canManageStaff\(resource\.data\.storeId\)[\s\S]*request\.resource\.data\.storeId == resource\.data\.storeId;/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow delete: if canManageStaff\(resource\.data\.storeId\);/)
assert.match(staffLayout, /const canManageStaff = hasStaffPermission\(activeStaff, 'manageStaff'/)
assert.match(staffLayout, /path="staff-admin"/)
assert.match(staffShellHeader, /canManageStaff/)
assert.match(staffShellHeader, /onOpenStaffAdmin/)

console.log('staff permission checks passed')
