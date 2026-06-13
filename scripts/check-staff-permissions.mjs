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

assert.deepEqual(STAFF_PERMISSION_KEYS, [
  'useKitchen',
  'closeRegister',
  'manageMenu',
  'manageTables',
  'manageReservations',
  'viewHistory',
  'manageSettings',
  'manageStaff',
])

assert.deepEqual(normalizeStaffPermissions(null), {
  useKitchen: true,
  closeRegister: false,
  manageMenu: false,
  manageTables: false,
  manageReservations: false,
  viewHistory: false,
  manageSettings: false,
  manageStaff: false,
})

assert.equal(hasStaffPermission({ permissions: null }, 'useKitchen'), true)
assert.equal(hasStaffPermission({ permissions: null }, 'manageMenu'), false)
assert.equal(hasStaffPermission({ permissions: null }, 'manageTables'), false)
assert.equal(hasStaffPermission({ permissions: null }, 'manageReservations'), false)
assert.equal(hasStaffPermission({ permissions: null }, 'manageStaff'), false)

assert.deepEqual(buildStaffPermissionsFromPreset('manager'), {
  useKitchen: true,
  closeRegister: true,
  manageMenu: true,
  manageTables: true,
  manageReservations: true,
  viewHistory: true,
  manageSettings: true,
  manageStaff: true,
})

assert.deepEqual(buildStaffPermissionsFromPreset('operations'), {
  useKitchen: true,
  closeRegister: true,
  manageMenu: false,
  manageTables: true,
  manageReservations: true,
  viewHistory: false,
  manageSettings: false,
  manageStaff: false,
})
assert.equal(getStaffPermissionPreset('unknown').key, 'operations')

assert.equal(
  normalizeStaffMemberPermissions({
    permissionPreset: 'manager',
    permissions: { useKitchen: true, closeRegister: true, manageMenu: true },
  }).manageStaff,
  true,
)
assert.equal(
  normalizeStaffMemberPermissions({
    permissionPreset: 'manager',
    permissions: { useKitchen: true, closeRegister: true, manageMenu: true },
  }).manageTables,
  true,
)

assert.equal(getStaffPresetKeyFromPermissions(buildStaffPermissionsFromPreset('operations')), 'operations')
assert.equal(getStaffPermissionSummary(buildStaffPermissionsFromPreset('menuLead')), 'キッチン / メニュー管理')
assert.equal(getStaffPermissionSummary(buildStaffPermissionsFromPreset('operations')), 'キッチン / レジ締め / 席管理 / 予約管理')

const customPermissions = setStaffPermissionValue(buildStaffPermissionsFromPreset('floor'), 'closeRegister', true)
assert.equal(customPermissions.closeRegister, true)
assert.equal(getStaffPresetKeyFromPermissions(customPermissions), 'custom')
assert.equal(setStaffPermissionValue(customPermissions, 'unknown', true).closeRegister, true)

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const staffLayout = readFileSync(new URL('../src/pages/staff/StaffLayout.jsx', import.meta.url), 'utf8')
const staffShellHeader = readFileSync(new URL('../src/components/staff/StaffShellHeader.jsx', import.meta.url), 'utf8')

assert.match(rules, /function staffPermission\(storeId, permission, legacyDefault\)/)
assert.match(rules, /function canManageMenu\(storeId\)/)
assert.match(rules, /function canCloseRegister\(storeId\)/)
assert.match(rules, /function canManageStaff\(storeId\)/)
assert.match(rules, /function staffIsManager\(storeId\)/)
assert.match(rules, /function staffIsOperations\(storeId\)/)
assert.match(rules, /function canManageTables\(storeId\)/)
assert.match(rules, /function canManageReservations\(storeId\)/)
assert.match(rules, /function canViewHistory\(storeId\)/)
assert.match(rules, /function canManageSettings\(storeId\)/)
assert.match(rules, /staffIsOperations\(storeId\)/)
assert.match(rules, /staffIsManager\(storeId\)/)
assert.match(rules, /match \/products\/\{productId\}[\s\S]*allow create: if canManageMenu\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/tables\/\{tableId\}[\s\S]*allow create: if canManageTables\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/tableGroups\/\{groupId\}[\s\S]*allow create: if canManageTables\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/cashClosings\/\{closingId\}[\s\S]*allow create: if canCloseRegister\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/reservations\/\{reservationId\}[\s\S]*allow create: if canManageReservations\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/storeConfig\/\{configId\}[\s\S]*allow write: if canManageSettings\(configId\);/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow create: if canManageStaff\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow update: if canManageStaff\(resource\.data\.storeId\)[\s\S]*request\.resource\.data\.storeId == resource\.data\.storeId;/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow delete: if canManageStaff\(resource\.data\.storeId\);/)
assert.match(staffLayout, /const canManageStaff = hasStaffPermission\(activeStaff, 'manageStaff'/)
assert.match(staffLayout, /const canManageTables = hasStaffPermission\(activeStaff, 'manageTables'/)
assert.match(staffLayout, /const canManageReservations = hasStaffPermission\(activeStaff, 'manageReservations'/)
assert.match(staffLayout, /const canViewHistory = hasStaffPermission\(activeStaff, 'viewHistory'/)
assert.match(staffLayout, /const canManageSettings = hasStaffPermission\(activeStaff, 'manageSettings'/)
assert.match(staffLayout, /path="staff-admin"/)
assert.match(staffLayout, /path="tables"/)
assert.match(staffLayout, /path="reservations"/)
assert.match(staffLayout, /path="history"/)
assert.match(staffLayout, /path="settings"/)
assert.match(staffShellHeader, /canManageStaff/)
assert.match(staffShellHeader, /canManageTables/)
assert.match(staffShellHeader, /canManageReservations/)
assert.match(staffShellHeader, /canViewHistory/)
assert.match(staffShellHeader, /canManageSettings/)
assert.match(staffShellHeader, /onOpenOrders/)
assert.match(staffShellHeader, />\s*注文\s*</)
assert.match(staffShellHeader, /onOpenStaffAdmin/)
assert.match(staffShellHeader, /onOpenTables/)
assert.match(staffShellHeader, /onOpenReservations/)
assert.match(staffShellHeader, /onOpenHistory/)
assert.match(staffShellHeader, /onOpenSettings/)

console.log('staff permission checks passed')
