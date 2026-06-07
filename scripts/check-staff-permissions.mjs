import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildStaffPermissionsFromPreset,
  getStaffPermissionSummary,
  getStaffPresetKeyFromPermissions,
  hasStaffPermission,
  normalizeStaffPermissions,
} from '../src/lib/staffPermissions.js'

assert.deepEqual(normalizeStaffPermissions(null), {
  useKitchen: true,
  closeRegister: false,
  manageMenu: false,
})
assert.equal(hasStaffPermission({ permissions: null }, 'useKitchen'), true)
assert.equal(hasStaffPermission({ permissions: null }, 'manageMenu'), false)
assert.deepEqual(buildStaffPermissionsFromPreset('manager'), {
  useKitchen: true,
  closeRegister: true,
  manageMenu: true,
})
assert.equal(getStaffPresetKeyFromPermissions(buildStaffPermissionsFromPreset('operations')), 'operations')
assert.equal(getStaffPermissionSummary(buildStaffPermissionsFromPreset('menuLead')), 'キッチン / メニュー管理')

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
assert.match(rules, /function staffPermission\(storeId, permission, legacyDefault\)/)
assert.match(rules, /function canManageMenu\(storeId\)/)
assert.match(rules, /function canCloseRegister\(storeId\)/)
assert.match(rules, /match \/products\/\{productId\}[\s\S]*allow create: if canManageMenu\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/cashClosings\/\{closingId\}[\s\S]*allow create: if canCloseRegister\(request\.resource\.data\.storeId\);/)

console.log('staff permission checks passed')
