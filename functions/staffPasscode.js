const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { commandError } = require('./orderCommandShared')
const { assertStoreAccess } = require('./orderCommandAuth')
const {
  createPasscodeHash,
  evaluatePasscodeAttempt,
  passcodeMatches,
} = require('./passcodeLock')
const { actorHasPermission } = require('./staffPermission')

// スタッフの4桁パスは staffSecrets/{staffMemberId} にハッシュで置き、照合はここだけで行う（2026-10-22 整理 第4章 4-B）。
// 端末の記録（staffSessions）にスタッフを書けるのもここだけ。照合済みの印として verifiedStaffMemberId を一緒に書く。
const STAFF_SECRET_COLLECTION = 'staffSecrets'
const STAFF_CODE_PATTERN = /^\d{4}$/
const STAFF_NAME_MAX_LENGTH = 40
const STAFF_PERMISSION_KEYS = [
  'useKitchen',
  'closeRegister',
  'manageMenu',
  'manageTables',
  'manageReservations',
  'viewHistory',
  'manageSettings',
  'manageStaff',
]
const STAFF_PRESET_KEYS = new Set(['manager', 'operations', 'menuLead', 'floor', 'custom'])

function getMemberUpdatedAtMs(member) {
  const updatedAt = member?.updatedAt
  return typeof updatedAt?.toMillis === 'function' ? updatedAt.toMillis() : 0
}

function assertStaffCodeFormat(code, errorCode = 'invalid-staff-code-format') {
  if (typeof code !== 'string' || !STAFF_CODE_PATTERN.test(code)) {
    throw commandError(errorCode, 'Staff code must be 4 digits.')
  }
}

function assertStaffDevice(request) {
  if (!request.auth) throw commandError('unauthenticated', 'Sign in before this operation.')
  if (request.auth.token?.firebase?.sign_in_provider !== 'anonymous') {
    throw commandError('permission-denied', 'Store managers do not select a staff member.')
  }
}

// 秘密の記録が無く、まだ staffMembers にパスが残っているスタッフ（移し替え前）は、ここで一度だけ移す。
function resolveStaffSecret(secret, member) {
  if (secret?.codeHash) return { secret, legacyCode: null }
  const legacyCode = typeof member?.code === 'string' && STAFF_CODE_PATTERN.test(member.code) ? member.code : null
  if (!legacyCode) return { secret: null, legacyCode: null }
  const { hash, salt } = createPasscodeHash(legacyCode)
  return { secret: { codeHash: hash, codeSalt: salt, failedAttempts: 0, lockedUntilMs: 0 }, legacyCode }
}

function buildSecretWrite(storeId, secret, updates) {
  return {
    storeId,
    codeHash: secret.codeHash,
    codeSalt: secret.codeSalt,
    failedAttempts: secret.failedAttempts ?? 0,
    lockedUntilMs: secret.lockedUntilMs ?? 0,
    ...updates,
    updatedAt: FieldValue.serverTimestamp(),
  }
}

// パスを照合する。書き込みはせず、失敗の理由と、秘密の記録へ書く内容（無ければ null）を返す。
// 書き込みは呼び出し側がトランザクションで1件1回にまとめる。
function checkStaffCode({ secretSnap, member, storeId, code }) {
  const { secret, legacyCode } = resolveStaffSecret(secretSnap.exists ? secretSnap.data() : null, member)
  if (!secret) return { failure: 'staff-code-not-set', secretWrite: null, removeLegacyCode: false }
  const attempt = evaluatePasscodeAttempt(secret, passcodeMatches(code, secret.codeHash, secret.codeSalt, STAFF_CODE_PATTERN))
  const failure = attempt.failure === 'locked' ? 'staff-code-locked' : attempt.failure === 'invalid' ? 'invalid-staff-code' : null
  if (legacyCode) {
    return { failure, secretWrite: buildSecretWrite(storeId, secret, attempt.updates ?? {}), removeLegacyCode: true }
  }
  return { failure, secretWrite: attempt.updates ? { ...attempt.updates, updatedAt: FieldValue.serverTimestamp() } : null, removeLegacyCode: false }
}

function applyStaffCodeCheck(transaction, { secretRef, memberRef }, check) {
  if (check.secretWrite) transaction.set(secretRef, check.secretWrite, { merge: true })
  if (check.removeLegacyCode) transaction.update(memberRef, { code: FieldValue.delete() })
}

async function loadStoreMemberInTransaction(transaction, memberRef, storeId) {
  const memberSnap = await transaction.get(memberRef)
  if (!memberSnap.exists || memberSnap.data()?.storeId !== storeId) {
    throw commandError('staff-member-not-found', 'Staff member was not found.')
  }
  return memberSnap.data()
}

// スタッフを選んで入る。code があれば照合する。code が無いときは、同じ端末で照合済みのスタッフに戻るときだけ通す
// （権限やパスが変わっていたら、もう一度パスが要る）。
async function activateStaffSessionCommand({ storeId, staffMemberId, code }, request) {
  if (!storeId || typeof staffMemberId !== 'string' || !staffMemberId) {
    throw commandError('invalid-argument', 'Store and staff member are required.')
  }
  if (code !== undefined && code !== null) assertStaffCodeFormat(code, 'invalid-staff-code')
  assertStaffDevice(request)
  const db = getFirestore()
  const sessionRef = db.collection('staffSessions').doc(request.auth.uid)
  const memberRef = db.collection('staffMembers').doc(staffMemberId)
  const secretRef = db.collection(STAFF_SECRET_COLLECTION).doc(staffMemberId)

  const result = await db.runTransaction(async transaction => {
    const [sessionSnap, secretSnap] = await Promise.all([transaction.get(sessionRef), transaction.get(secretRef)])
    const session = sessionSnap.exists ? sessionSnap.data() : null
    if (session?.storeId !== storeId) throw commandError('permission-denied', 'Enter the store code first.')
    const member = await loadStoreMemberInTransaction(transaction, memberRef, storeId)
    const memberUpdatedAtMs = getMemberUpdatedAtMs(member)

    if (code === undefined || code === null) {
      const canResume = session.verifiedStaffMemberId === staffMemberId &&
        session.staffMemberId === staffMemberId &&
        session.memberUpdatedAtMs === memberUpdatedAtMs
      if (!canResume) throw commandError('staff-code-required', 'Enter the staff code.')
      return { failure: null, name: member.name }
    }

    const check = checkStaffCode({ secretSnap, member, storeId, code })
    applyStaffCodeCheck(transaction, { secretRef, memberRef }, check)
    if (check.failure) return { failure: check.failure }
    transaction.set(sessionRef, {
      staffMemberId,
      verifiedStaffMemberId: staffMemberId,
      staffName: String(member.name ?? ''),
      memberUpdatedAtMs,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    return { failure: null, name: member.name }
  })
  // 間違えた回数はトランザクションで記録済み。ここで初めて失敗として返す。
  if (result.failure) throw commandError(result.failure, 'Staff code was rejected.')
  return { ok: true, staffMemberId, name: result.name }
}

function normalizeNewStaffPermissions(permissions) {
  const source = permissions && typeof permissions === 'object' ? permissions : {}
  return Object.fromEntries(STAFF_PERMISSION_KEYS.map(key => [key, source[key] === true]))
}

async function assertCanManageStaff(db, request, storeId) {
  if (!storeId) throw commandError('invalid-argument', 'Store is required.')
  const actor = await assertStoreAccess(db, request, storeId)
  if (!actorHasPermission(actor, 'manageStaff')) {
    throw commandError('permission-denied', 'You cannot manage staff members.')
  }
  return actor
}

// スタッフを追加する。名前・権限とパスを一度に書き、パスの無いスタッフを作らない。
async function createStaffMemberCommand({ storeId, name, code, permissionPreset, permissions }, request) {
  const trimmedName = String(name ?? '').trim()
  if (!trimmedName || trimmedName.length > STAFF_NAME_MAX_LENGTH) {
    throw commandError('invalid-argument', 'Staff name is required.')
  }
  if (!STAFF_PRESET_KEYS.has(permissionPreset)) throw commandError('invalid-argument', 'Unknown permission preset.')
  assertStaffCodeFormat(code)
  const db = getFirestore()
  await assertCanManageStaff(db, request, storeId)

  const memberRef = db.collection('staffMembers').doc()
  const { hash, salt } = createPasscodeHash(code)
  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  batch.set(memberRef, {
    storeId,
    name: trimmedName,
    permissionPreset,
    permissions: normalizeNewStaffPermissions(permissions),
    createdAt: now,
  })
  batch.set(db.collection(STAFF_SECRET_COLLECTION).doc(memberRef.id), {
    storeId,
    codeHash: hash,
    codeSalt: salt,
    failedAttempts: 0,
    lockedUntilMs: 0,
    updatedAt: now,
  })
  await batch.commit()
  return { ok: true, staffMemberId: memberRef.id }
}

// パスを変える。スタッフ管理の権限を持つスタッフは今のパスの確認が要る（間違いは入るときと同じ回数で数え、ロックも共通）。
// 店長・オーナー（Google ログイン）は、パスを忘れたスタッフのために今のパスなしで決め直せる（ロックも解ける。ユーザー様 2026-10-22）。
async function setStaffCodeCommand({ storeId, staffMemberId, currentCode, nextCode }, request) {
  if (typeof staffMemberId !== 'string' || !staffMemberId) throw commandError('invalid-argument', 'Staff member is required.')
  assertStaffCodeFormat(nextCode)
  const db = getFirestore()
  const actor = await assertCanManageStaff(db, request, storeId)
  const requiresCurrentCode = !actor.isStoreManager
  const memberRef = db.collection('staffMembers').doc(staffMemberId)
  const secretRef = db.collection(STAFF_SECRET_COLLECTION).doc(staffMemberId)

  const failure = await db.runTransaction(async transaction => {
    const secretSnap = await transaction.get(secretRef)
    const member = await loadStoreMemberInTransaction(transaction, memberRef, storeId)
    const hasCode = Boolean(secretSnap.data()?.codeHash) || Boolean(resolveStaffSecret(null, member).secret)
    if (hasCode && requiresCurrentCode) {
      if (currentCode === nextCode) return 'staff-code-unchanged'
      const check = checkStaffCode({ secretSnap, member, storeId, code: currentCode })
      if (check.failure) {
        applyStaffCodeCheck(transaction, { secretRef, memberRef }, check)
        return check.failure
      }
    }
    const { hash, salt } = createPasscodeHash(nextCode)
    transaction.set(secretRef, {
      storeId,
      codeHash: hash,
      codeSalt: salt,
      failedAttempts: 0,
      lockedUntilMs: 0,
      updatedAt: FieldValue.serverTimestamp(),
    })
    // パスが変わったら、そのスタッフの端末ではもう一度パスが要る（自動で入れない）。移し替え前のパスもここで消す。
    transaction.update(memberRef, { code: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() })
    return null
  })
  if (failure) throw commandError(failure, 'Staff code was not changed.')
  return { ok: true }
}

// 打ち間違いやロックは利用者の操作の結果で、システムの失敗ではない。失敗ログには残さない。
const EXPECTED_STAFF_CODE_ERROR_CODES = new Set([
  'invalid-staff-code',
  'invalid-staff-code-format',
  'staff-code-locked',
  'staff-code-required',
  'staff-code-unchanged',
])

module.exports = {
  EXPECTED_STAFF_CODE_ERROR_CODES,
  STAFF_CODE_PATTERN,
  STAFF_SECRET_COLLECTION,
  activateStaffSessionCommand,
  createStaffMemberCommand,
  setStaffCodeCommand,
}
