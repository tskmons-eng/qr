const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { commandError } = require('./orderCommandShared')
const {
  assertStoreAccess,
  resolveStaffActor,
} = require('./orderCommandAuth')
const {
  MAX_FAILED_ATTEMPTS,
  createPasscodeHash,
  evaluatePasscodeAttempt,
  hashPasscode,
  passcodeMatches,
} = require('./passcodeLock')
const { actorHasPermission } = require('./staffPermission')

// 取消パスコードは店の端末から読めない storeSecrets/{storeId} にハッシュで置き、照合はここだけで行う。
// 設定済みかどうかの表示用には stores/{storeId}.cancelPasscodeStatus を使う（パスコードそのものは書かない）。
const SECRET_COLLECTION = 'storeSecrets'
const CANCEL_PASSCODE_PATTERN = /^\d{4,8}$/

const hashCancelPasscode = hashPasscode

function cancelPasscodeMatches(passcode, secret) {
  return passcodeMatches(passcode, secret?.cancelPasscodeHash, secret?.cancelPasscodeSalt, CANCEL_PASSCODE_PATTERN)
}

// 取消してよいか。店舗管理者とメニュー管理の権限があるスタッフはパスコード不要、それ以外は店の共通パスコードが要る。
async function assertCancelAllowed(db, request, storeId, passcode) {
  const actor = await resolveStaffActor(db, request, storeId)
  if (actorHasPermission(actor, 'manageMenu')) return

  // 4桁は総当たりされやすいので、続けて間違えたら一定時間ロックする。
  const secretRef = db.collection(SECRET_COLLECTION).doc(storeId)
  const failure = await db.runTransaction(async transaction => {
    const secretSnap = await transaction.get(secretRef)
    const secret = secretSnap.exists ? secretSnap.data() : null
    if (!secret?.cancelPasscodeHash) return 'cancel-passcode-not-set'
    const attempt = evaluatePasscodeAttempt(secret, cancelPasscodeMatches(passcode, secret))
    if (attempt.updates) transaction.update(secretRef, attempt.updates)
    if (attempt.failure === 'locked') return 'cancel-passcode-locked'
    if (attempt.failure === 'invalid') return 'invalid-cancel-passcode'
    return null
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
  if (!actorHasPermission(actor, 'manageSettings')) {
    throw commandError('permission-denied', 'You cannot change the cancel passcode.')
  }

  const storeRef = db.collection('stores').doc(storeId)
  const storeSnap = await storeRef.get()
  if (!storeSnap.exists) throw commandError('store-not-found', 'Store was not found.')

  const { hash, salt } = createPasscodeHash(passcode)
  const now = FieldValue.serverTimestamp()
  const updatedByName = actor.name || '管理者'
  const batch = db.batch()
  batch.set(db.collection(SECRET_COLLECTION).doc(storeId), {
    storeId,
    cancelPasscodeHash: hash,
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
  assertCancelAllowed,
  cancelPasscodeMatches,
  hashCancelPasscode,
  setCancelPasscodeCommand,
}
