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
const salesAssigneeManagementPage = readFileSync(new URL('../src/pages/staff/SalesAssigneeManagementPage.jsx', import.meta.url), 'utf8')
const staffPullRefreshIndicator = readFileSync(new URL('../src/components/staff/StaffPullRefreshIndicator.jsx', import.meta.url), 'utf8')
const pullToRefreshHook = readFileSync(new URL('../src/hooks/usePullToRefresh.js', import.meta.url), 'utf8')
const bottomNavStyles = readFileSync(new URL('../src/styles/bottom-nav.css', import.meta.url), 'utf8')
const staffShellStyles = readFileSync(new URL('../src/styles/staff-shell.css', import.meta.url), 'utf8')

assert.match(rules, /function staffPermission\(storeId, permission, legacyDefault\)/)
assert.match(rules, /function canonicalStaffMemberExists\(storeId\)/)
assert.match(rules, /function canonicalStaffPermission\(memberData, permission, legacyDefault\)/)
assert.match(rules, /function validStaffSessionEntry\(data\)/)
// スタッフの選択は Functions（activateStaffSessionCommand）だけが書く。照合済みの印が無い記録は信じない。
assert.doesNotMatch(rules, /validActivatedStaffSession/)
assert.match(rules, /get\('verifiedStaffMemberId', null\) == currentStaffSessionData\(\)\.staffMemberId/)
assert.match(rules, /function canManageMenu\(storeId\)/)
assert.match(rules, /function canCloseRegister\(storeId\)/)
assert.match(rules, /function canManageStaff\(storeId\)/)
assert.match(rules, /function canManageTables\(storeId\)/)
assert.match(rules, /function canManageReservations\(storeId\)/)
assert.match(rules, /function canViewHistory\(storeId\)/)
assert.match(rules, /function canManageSettings\(storeId\)/)
// 2026-10-22 整理 第4章 L5：権限の型（店長・現場責任者）で個別の OFF を上書きしない。画面と同じ判定にする。
assert.doesNotMatch(rules, /staffIsManager|staffIsOperations/)
for (const name of ['canManageTables', 'canManageReservations', 'canViewHistory', 'canManageSettings']) {
  const permission = { canManageTables: 'manageTables', canManageReservations: 'manageReservations', canViewHistory: 'viewHistory', canManageSettings: 'manageSettings' }[name]
  assert.match(rules, new RegExp(`function ${name}\(storeId\) \{\s*return canManageStore\(storeId\) \|\| staffPermission\(storeId, '${permission}', false\);\s*\}`), `${name} should respect per-staff OFF`)
}
assert.match(rules, /match \/products\/\{productId\}[\s\S]*allow create: if canManageMenu\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/tables\/\{tableId\}[\s\S]*allow create: if canManageTables\(request\.resource\.data\.storeId\);/)
assert.doesNotMatch(rules, /match \/tableGroups\//, '席グループは無くした（2026-10-23 席設計）')
assert.match(rules, /allow delete: if canManageTables\(resource\.data\.storeId\)\s*&& resource\.data\.get\('status', 'vacant'\) == 'vacant'/, '空き席だけ消せる')
// 締めの記録は Functions（closeRegisterCommand）だけが書く。読みはレジ締めの権限（2026-10-30 締め 第2章）。
assert.match(rules, /match \/cashClosings\/\{closingId\} \{\s*allow read: if canCloseRegister\(resource\.data\.storeId\);[\s\S]*?allow create, update, delete: if false;/)
assert.match(rules, /match \/reservations\/\{reservationId\}[\s\S]*allow create: if canManageReservations\(request\.resource\.data\.storeId\);/)
assert.match(rules, /match \/storeConfig\/\{configId\}[\s\S]*allow write: if canManageSettings\(configId\);/)
// 追加はパスと一緒に Functions（createStaffMemberCommand）で。パス（code）は画面から書けない（2026-10-22 第4章 4-B）。
assert.match(rules, /match \/staffMembers\/\{memberId\} \{[\s\S]*?allow create: if false;/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow update: if canManageStaff\(resource\.data\.storeId\)[\s\S]*request\.resource\.data\.storeId == resource\.data\.storeId[\s\S]*affectedKeys\(\)\.hasAny\(\['code'\]\);/)
assert.match(rules, /match \/staffSecrets\/\{memberId\} \{\s*allow read, write: if false;/)
assert.match(rules, /match \/staffMembers\/\{memberId\}[\s\S]*allow delete: if canManageStaff\(resource\.data\.storeId\);/)
assert.match(staffLayout, /const canManageStaff = hasStaffPermission\(activeStaff, 'manageStaff'/)
assert.match(staffLayout, /const canManageTables = hasStaffPermission\(activeStaff, 'manageTables'/)
assert.match(staffLayout, /const canManageReservations = hasStaffPermission\(activeStaff, 'manageReservations'/)
assert.match(staffLayout, /const canViewHistory = hasStaffPermission\(activeStaff, 'viewHistory'/)
assert.match(staffLayout, /const canManageSettings = hasStaffPermission\(activeStaff, 'manageSettings'/)
assert.match(staffLayout, /path="staff-admin"/)
assert.match(staffLayout, /path="sales-assignees"[\s\S]*permission="manageStaff"/)
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
assert.doesNotMatch(staffShellHeader, /onRefresh/)
assert.doesNotMatch(staffShellHeader, />\s*更新\s*</)
assert.match(staffLayout, /window\.location\.reload/)
assert.match(staffLayout, /usePullToRefresh/)
assert.match(staffLayout, /StaffPullRefreshIndicator/)
assert.match(staffPullRefreshIndicator, /staff-shell__pull-refresh/)
assert.match(staffPullRefreshIndicator, /staff-shell__pull-refresh-ring/)
assert.match(pullToRefreshHook, /PULL_REFRESH_THRESHOLD/)
assert.match(pullToRefreshHook, /touchmove/)
assert.match(pullToRefreshHook, /離すと更新/)
assert.match(pullToRefreshHook, /findScrollableAncestor/)
assert.match(pullToRefreshHook, /getBoundingClientRect/)
assert.match(pullToRefreshHook, /scrollableAncestor\.scrollTop > 1/)
assert.match(staffShellStyles, /staff-shell__pull-refresh/)
assert.match(staffShellStyles, /overscroll-behavior-y: contain/)
assert.doesNotMatch(staffShellHeader, /onToggleSoundSettings/)
assert.doesNotMatch(staffShellHeader, /⚙/)
// 2026-10-22 整理 第3章：管理の画面は「店舗管理」シートに一本化し、「管理画面」への入口は無くした。
// 店舗管理は共通の下から出るシート（BottomSheet）で出す。
assert.match(staffShellHeader, /<BottomSheet[\s\S]*title="店舗管理"/)
assert.doesNotMatch(staffShellHeader, /管理画面|onOpenAdmin/)
assert.match(staffShellHeader, />\s*店舗管理\s*</)
assert.match(staffShellHeader, /label: 'レジ締め'/)
assert.match(staffShellHeader, /label: '席'/)
assert.match(staffShellHeader, /label: 'メニュー'/)
assert.match(staffShellHeader, /label: '操作ログ'/)
assert.match(staffShellHeader, /!canCloseRegister && canManageStaff[\s\S]*label: '売上担当'/)
assert.match(salesAssigneeManagementPage, /loadSalesAssignees/)
assert.match(salesAssigneeManagementPage, /SalesAssigneeManagerModal/)
assert.match(staffShellHeader, /onOpenStaffAdmin/)
assert.match(staffShellHeader, /onOpenTables/)
assert.match(staffShellHeader, /onOpenReservations/)
assert.match(staffShellHeader, /onOpenHistory/)
assert.match(staffShellHeader, /onOpenSettings/)
assert.match(bottomNavStyles, /calc\(env\(safe-area-inset-bottom\) \+ 8px\)/)

console.log('staff permission checks passed')
