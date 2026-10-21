// src/lib/staffPermissions.js の STAFF_PERMISSION_PRESETS のうち、サーバーで使う権限だけの写し。
// 食い違いは scripts/check-cancel-passcode.mjs が止める。
const PRESET_PERMISSIONS = {
  manager: { manageMenu: true, manageSettings: true, manageStaff: true },
  operations: { manageMenu: false, manageSettings: false, manageStaff: false },
  menuLead: { manageMenu: true, manageSettings: false, manageStaff: false },
  floor: { manageMenu: false, manageSettings: false, manageStaff: false },
}
const DEFAULT_PRESET = 'operations'

function staffMemberHasPermission(member, key) {
  if (!member) return false
  const preset = member.permissionPreset
  const presetDefault = preset && preset !== 'custom' && preset !== 'legacy'
    ? (PRESET_PERMISSIONS[preset] ?? PRESET_PERMISSIONS[DEFAULT_PRESET])[key]
    : false
  const explicit = member.permissions && typeof member.permissions === 'object' ? member.permissions[key] : undefined
  return (explicit ?? presetDefault ?? false) === true
}

// 店長・オーナー（isStoreManager）か、その権限を持つスタッフか。
function actorHasPermission(actor, key) {
  return Boolean(actor?.isStoreManager) || staffMemberHasPermission(actor?.member, key)
}

module.exports = {
  PRESET_PERMISSIONS,
  actorHasPermission,
  staffMemberHasPermission,
}
