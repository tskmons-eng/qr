const { randomBytes, scryptSync, timingSafeEqual } = require('node:crypto')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { commandError } = require('./orderCommandShared')
const {
  assertStoreAccess,
  resolveStaffActor,
} = require('./orderCommandAuth')

// 取消パスコードは店の端末から読めない storeSecrets/{storeId} にハッシュで置き、照合はここだけで行う。
// 設定済みかどうかの表示用には stores/{storeId}.cancelPasscodeStatus を使う（パスコードそのものは書かない）。
const SECRET_COLLECTION = 'storeSecrets'
const CANCEL_PASSCODE_PATTERN = /^\d{4,8}$/
const HASH_BYTES = 32
const MAX_FAILED_ATTEMPTS = 5
const LOCK_MS = 10 * 60 * 1000

// src/lib/staffPermissions.js の STAFF_PERMISSION_PRESETS のうち、ここで使う権限だけの写し。
// 食い違いは scripts/check-cancel-passcode.mjs が止める。
const PRESET_PERMISSIONS = {
  manager: { manageMenu: true, manageSettings: true },
  operations: { manageMenu: false, manageSettings: false },
  menuLead: { manageMenu: true, manageSettings: false },
  floor: { manageMenu: false, manageSettings: false },
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

function hashCancelPasscode(passcode, salt) {
  return scryptSync(String(passcode), salt, HASH_BYTES).toString('hex')
}

function cancelPasscodeMatches(passcode, secret) {
  if (!secret?.cancelPasscodeHash || !secret?.cancelPasscodeSalt) return false
  if (typeof passcode !== 'string' || !CANCEL_PASSCODE_PATTERN.test(passcode)) return false
  const expected = Buffer.from(secret.cancelPasscodeHash, 'hex')
  const actual = Buffer.from(hashCancelPasscode(passcode, secret.cancelPasscodeSalt), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// 取消してよいか。店舗管理者とメニュー管理の権限があるスタッフはパスコード不要、それ以外は店の共通パスコードが要る。
async function assertCancelAllowed(db, request, storeId, passcode) {
  const actor = await resolveStaffActor(db, request, storeId)
  if (actor.isStoreManager || staffMemberHasPermission(actor.member, 'manageMenu')) return

  // 4桁は総当たりされやすいので、続けて間違えたら一定時間ロックする。
  const secretRef = db.collection(SECRET_COLLECTION).doc(storeId)
  const failure = await db.runTransaction(async transaction => {
    const secretSnap = await transaction.get(secretRef)
    const secret = secretSnap.exists ? secretSnap.data() : null
    if (!secret?.cancelPasscodeHash) return 'cancel-passcode-not-set'
    const nowMs = Date.now()
    if ((secret.lockedUntilMs ?? 0) > nowMs) return 'cancel-passcode-locked'
    if (cancelPasscodeMatches(passcode, secret)) {
      if (secret.failedAttempts) transaction.update(secretRef, { failedAttempts: 0, lockedUntilMs: 0 })
      return null
    }
    const failedAttempts = (secret.failedAttempts ?? 0) + 1
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      transaction.update(secretRef, { failedAttempts: 0, lockedUntilMs: nowMs + LOCK_MS })
      return 'cancel-passcode-locked'
    }
    transaction.update(secretRef, { failedAttempts })
    return 'invalid-cancel-passcode'
  })
  if (failure) throw commandError(failure, 'Cancel passcode was rejected.')
}

async function setCancelPasscodeCommand({ storeId, passcode }, request) {
  if (!storeId) throw commandError('invalid-argument', 'Store is required.')
  if (typeof passcode !== 'string' || !CANCEL_PASSCODE_PATTERN.test(passcode)) {
    throw commandError('invalid-cancel-passcode-format', 'Cancel passcode must be 4 to 8 digits.')
  }
  const db = getFirestore()
  const actor = await assertStoreAccess(db, request, storeId)
  if (!actor.isStoreManager && !staffMemberHasPermission(actor.member, 'manageSettings')) {
    throw commandError('permission-denied', 'You cannot change the cancel passcode.')
  }

  const storeRef = db.collection('stores').doc(storeId)
  const storeSnap = await storeRef.get()
  if (!storeSnap.exists) throw commandError('store-not-found', 'Store was not found.')

  const salt = randomBytes(16).toString('hex')
  const now = FieldValue.serverTimestamp()
  const updatedByName = actor.name || '管理者'
  const batch = db.batch()
  batch.set(db.collection(SECRET_COLLECTION).doc(storeId), {
    storeId,
    cancelPasscodeHash: hashCancelPasscode(passcode, salt),
    cancelPasscodeSalt: salt,
    failedAttempts: 0,
    lockedUntilMs: 0,
    updatedAt: now,
    updatedByUid: request.auth?.uid ?? null,
  }, { merge: true })
  batch.update(storeRef, {
    cancelPasscodeStatus: { isSet: true, updatedAt: now, updatedByName },
  })
  await batch.commit()
  return { ok: true }
}

// 打ち間違いやロックは利用者の操作の結果で、システムの失敗ではない。失敗ログ（orderCommandFailures）には残さない。
const EXPECTED_PASSCODE_ERROR_CODES = new Set([
  'invalid-cancel-passcode',
  'invalid-cancel-passcode-format',
  'cancel-passcode-locked',
])

module.exports = {
  CANCEL_PASSCODE_PATTERN,
  EXPECTED_PASSCODE_ERROR_CODES,
  MAX_FAILED_ATTEMPTS,
  PRESET_PERMISSIONS,
  assertCancelAllowed,
  cancelPasscodeMatches,
  hashCancelPasscode,
  setCancelPasscodeCommand,
  staffMemberHasPermission,
}
