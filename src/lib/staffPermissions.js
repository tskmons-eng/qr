export const STAFF_PERMISSION_KEYS = [
  'useKitchen',
  'closeRegister',
  'manageMenu',
  'manageTables',
  'manageReservations',
  'viewHistory',
  'manageSettings',
  'manageStaff',
]

export const STAFF_PERMISSION_DEFINITIONS = [
  {
    key: 'useKitchen',
    label: 'キッチン',
    description: 'キッチンパネルを開き、提供済み処理やキッチン通知の確認ができます。',
  },
  {
    key: 'closeRegister',
    label: 'レジ締め',
    description: '売上・レジ締め画面を開き、日次締めと売上履歴の確認ができます。',
  },
  {
    key: 'manageMenu',
    label: 'メニュー管理',
    description: '商品、カテゴリ、割引、期間限定メニューの追加と編集ができます。',
  },
  {
    key: 'manageTables',
    label: '席管理',
    description: '席の追加、席名変更、QR再発行、席グループの作成や割り当てができます。',
  },
  {
    key: 'manageReservations',
    label: '予約管理',
    description: '予約の確認、追加、来店済みやキャンセルなどの状態変更ができます。',
  },
  {
    key: 'viewHistory',
    label: '履歴閲覧',
    description: '会計やスタッフ操作の履歴確認とCSV出力ができます。',
  },
  {
    key: 'manageSettings',
    label: '店舗設定',
    description: 'お客様画面、店舗運用、税率など店舗単位の設定を変更できます。許可メール管理はオーナー専用です。',
  },
  {
    key: 'manageStaff',
    label: 'スタッフ権限管理',
    description: 'スタッフ追加、パス変更、スタッフごとの権限変更ができます。店舗管理者レベルの人だけに付ける権限です。',
  },
]

export const LEGACY_STAFF_PERMISSIONS = {
  useKitchen: true,
  closeRegister: false,
  manageMenu: false,
  manageTables: false,
  manageReservations: false,
  viewHistory: false,
  manageSettings: false,
  manageStaff: false,
}

export const STAFF_PERMISSION_PRESETS = [
  {
    key: 'manager',
    label: '店舗管理者レベル',
    description: 'キッチン、レジ締め、席、予約、メニュー、店舗設定、履歴、スタッフ権限管理まで任せる権限です。',
    permissions: {
      useKitchen: true,
      closeRegister: true,
      manageMenu: true,
      manageTables: true,
      manageReservations: true,
      viewHistory: true,
      manageSettings: true,
      manageStaff: true,
    },
  },
  {
    key: 'operations',
    label: '現場責任者',
    description: 'キッチン、レジ締め、席管理、予約管理まで任せ、メニュー編集、店舗設定、スタッフ権限管理はできない権限です。',
    permissions: {
      useKitchen: true,
      closeRegister: true,
      manageMenu: false,
      manageTables: true,
      manageReservations: true,
      viewHistory: false,
      manageSettings: false,
      manageStaff: false,
    },
  },
  {
    key: 'menuLead',
    label: 'メニュー担当',
    description: 'キッチンと期間限定メニューなどの商品編集を任せる権限です。レジ締めとスタッフ権限管理はできません。',
    permissions: {
      useKitchen: true,
      closeRegister: false,
      manageMenu: true,
      manageTables: false,
      manageReservations: false,
      viewHistory: false,
      manageSettings: false,
      manageStaff: false,
    },
  },
  {
    key: 'floor',
    label: '通常スタッフ',
    description: '席対応と注文対応を中心に行い、レジ締め、メニュー編集、スタッフ権限管理はできない権限です。',
    permissions: {
      useKitchen: true,
      closeRegister: false,
      manageMenu: false,
      manageTables: false,
      manageReservations: false,
      viewHistory: false,
      manageSettings: false,
      manageStaff: false,
    },
  },
]

export const DEFAULT_STAFF_PERMISSION_PRESET = 'operations'

export function getStaffPermissionPreset(key) {
  return STAFF_PERMISSION_PRESETS.find(preset => preset.key === key)
    ?? STAFF_PERMISSION_PRESETS.find(preset => preset.key === DEFAULT_STAFF_PERMISSION_PRESET)
    ?? STAFF_PERMISSION_PRESETS[0]
}

export function normalizeStaffPermissions(permissions, legacyDefaults = LEGACY_STAFF_PERMISSIONS) {
  const source = permissions && typeof permissions === 'object' ? permissions : null
  return STAFF_PERMISSION_KEYS.reduce((normalized, key) => ({
    ...normalized,
    [key]: source?.[key] ?? legacyDefaults[key] ?? false,
  }), {})
}

export function normalizeStaffMemberPermissions(staff, legacyDefaults = LEGACY_STAFF_PERMISSIONS) {
  if (!staff) return normalizeStaffPermissions(null, legacyDefaults)
  const presetDefaults = staff.permissionPreset && staff.permissionPreset !== 'custom' && staff.permissionPreset !== 'legacy'
    ? getStaffPermissionPreset(staff.permissionPreset).permissions
    : legacyDefaults
  return normalizeStaffPermissions(staff.permissions, presetDefaults)
}

export function hasStaffPermission(staff, key, legacyDefaults = LEGACY_STAFF_PERMISSIONS) {
  return normalizeStaffMemberPermissions(staff, legacyDefaults)[key] === true
}

export function buildStaffPermissionsFromPreset(presetKey) {
  return normalizeStaffPermissions(getStaffPermissionPreset(presetKey).permissions, {})
}

export function getStaffPresetKeyFromPermissions(permissions) {
  if (!permissions) return 'legacy'
  const normalized = normalizeStaffPermissions(permissions, {})
  return STAFF_PERMISSION_PRESETS.find(preset => (
    STAFF_PERMISSION_KEYS.every(key => preset.permissions[key] === normalized[key])
  ))?.key ?? 'custom'
}

export function getStaffPermissionSummary(permissions) {
  if (!permissions) return '既存スタッフ'
  const normalized = normalizeStaffPermissions(permissions, {})
  const labels = STAFF_PERMISSION_DEFINITIONS
    .filter(definition => normalized[definition.key])
    .map(definition => definition.label)
  return labels.length ? labels.join(' / ') : '通常スタッフ'
}

export function setStaffPermissionValue(permissions, key, enabled) {
  const normalized = normalizeStaffPermissions(permissions, {})
  if (!STAFF_PERMISSION_KEYS.includes(key)) return normalized
  return {
    ...normalized,
    [key]: enabled === true,
  }
}
