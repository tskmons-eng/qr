const { createHash, randomBytes, timingSafeEqual } = require('node:crypto')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')
const { commandError } = require('./orderCommandShared')
const { getEmail, isGoogle, isSuper } = require('./orderCommandAuth')

// 店舗登録（2026-10-22 使い始めの流れ 第1回）。運営者は店舗名だけで店を作り、店長には招待リンクを渡す（メール入力なし）。
// 店舗コードの重複確認と、店長の割り当ては、すべてここ（サーバー）で行う。
const STORE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const STORE_CODE_LENGTH = 6
const STORE_CODE_ATTEMPTS = 8
const STORE_NAME_MAX_LENGTH = 40
const INVITE_COLLECTION = 'storeInvites'
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function generateStoreCode() {
  const bytes = randomBytes(STORE_CODE_LENGTH)
  return Array.from(bytes, byte => STORE_CODE_CHARS[byte % STORE_CODE_CHARS.length]).join('')
}

function hashInviteToken(token) {
  return createHash('sha256').update(String(token)).digest('hex')
}

function inviteTokenMatches(token, hash) {
  if (typeof token !== 'string' || !token || typeof hash !== 'string') return false
  const expected = Buffer.from(hash, 'hex')
  const actual = Buffer.from(hashInviteToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function assertSuper(request) {
  if (!request.auth) throw commandError('unauthenticated', 'Sign in before this operation.')
  if (!isSuper(request)) throw commandError('permission-denied', 'Only the operator can do this.')
}

function normalizeStoreNameInput(storeName) {
  const name = String(storeName ?? '').trim().replace(/\s+/g, ' ')
  if (!name || name.length > STORE_NAME_MAX_LENGTH) throw commandError('invalid-argument', 'Store name is required.')
  return name
}

// 招待を作る（前の招待は使えなくする）。秘密の値はハッシュだけを保存し、呼び出し元に一度だけ返す。
// 店舗に書く招待の項目（storeFields）は、呼び出し側が店舗への1回の書き込みにまとめる。
function writeNewInvite(transaction, db, storeId, { previousInviteId = null, createdBy = null } = {}) {
  const inviteRef = db.collection(INVITE_COLLECTION).doc()
  const token = randomBytes(24).toString('base64url')
  const expiresAtMs = Date.now() + INVITE_TTL_MS
  transaction.set(inviteRef, {
    storeId,
    tokenHash: hashInviteToken(token),
    expiresAtMs,
    usedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    createdBy,
  })
  if (previousInviteId) {
    transaction.set(db.collection(INVITE_COLLECTION).doc(previousInviteId), { revokedAt: FieldValue.serverTimestamp() }, { merge: true })
  }
  return {
    invite: { inviteId: inviteRef.id, token, expiresAtMs },
    storeFields: { managerInviteId: inviteRef.id, managerInviteExpiresAtMs: expiresAtMs },
  }
}

async function createStoreCommand({ storeName }, request) {
  assertSuper(request)
  const name = normalizeStoreNameInput(storeName)
  const db = getFirestore()
  const storeRef = db.collection('stores').doc()

  for (let attempt = 0; attempt < STORE_CODE_ATTEMPTS; attempt += 1) {
    const storeCode = generateStoreCode()
    const codeRef = db.collection('storeCodes').doc(storeCode)
    const result = await db.runTransaction(async transaction => {
      const codeSnap = await transaction.get(codeRef)
      if (codeSnap.exists) return null
      const now = FieldValue.serverTimestamp()
      const { invite, storeFields } = writeNewInvite(transaction, db, storeRef.id, { createdBy: getEmail(request) })
      transaction.create(storeRef, {
        storeName: name,
        storeCode,
        ownerEmail: '',
        setupGuideRequired: true,
        ...storeFields,
        createdAt: now,
        updatedAt: now,
        createdBy: getEmail(request),
      })
      transaction.create(codeRef, { storeId: storeRef.id, createdAt: now })
      return invite
    })
    if (result) return { ok: true, storeId: storeRef.id, storeName: name, storeCode, ...result }
  }
  throw commandError('store-code-unavailable', 'Could not allocate a store code.')
}

async function reissueStoreInviteCommand({ storeId }, request) {
  assertSuper(request)
  if (!storeId) throw commandError('invalid-argument', 'Store is required.')
  const db = getFirestore()
  const storeRef = db.collection('stores').doc(storeId)
  const result = await db.runTransaction(async transaction => {
    const storeSnap = await transaction.get(storeRef)
    if (!storeSnap.exists) throw commandError('store-not-found', 'Store was not found.')
    const store = storeSnap.data()
    // 以前の形で店舗コードが無い店は、ここで重ならないコードを決める（取引の中で候補を読んでから書く）。
    let storeCode = store.storeCode ?? ''
    if (!storeCode) {
      const candidates = Array.from({ length: STORE_CODE_ATTEMPTS }, generateStoreCode)
      const snaps = await Promise.all(candidates.map(code => transaction.get(db.collection('storeCodes').doc(code))))
      storeCode = candidates.find((code, index) => !snaps[index].exists) ?? ''
      if (!storeCode) throw commandError('store-code-unavailable', 'Could not allocate a store code.')
      transaction.create(db.collection('storeCodes').doc(storeCode), { storeId, createdAt: FieldValue.serverTimestamp() })
    }
    const { invite, storeFields } = writeNewInvite(transaction, db, storeId, { previousInviteId: store.managerInviteId ?? null, createdBy: getEmail(request) })
    transaction.update(storeRef, { ...storeFields, storeCode, updatedAt: FieldValue.serverTimestamp() })
    return { storeName: store.storeName ?? '', storeCode, ...invite }
  })
  return { ok: true, storeId, ...result }
}

// 招待を受け取る：Google でログインした人を、この店の店長にする（許可メールにも入れる）。招待は1回だけ。
async function claimStoreInviteCommand({ inviteId, token }, request) {
  if (!request.auth) throw commandError('unauthenticated', 'Sign in before this operation.')
  const email = getEmail(request)
  if (!isGoogle(request) || !email) throw commandError('invite-email-required', 'Sign in with Google to accept the invite.')
  if (typeof inviteId !== 'string' || !inviteId) throw commandError('invite-not-found', 'Invite was not found.')
  const db = getFirestore()
  const inviteRef = db.collection(INVITE_COLLECTION).doc(inviteId)
  const assignmentRef = db.collection('storeAdminEmails').doc(email)

  return db.runTransaction(async transaction => {
    const [inviteSnap, assignmentSnap] = await Promise.all([transaction.get(inviteRef), transaction.get(assignmentRef)])
    const invite = inviteSnap.exists ? inviteSnap.data() : null
    if (!invite || !inviteTokenMatches(token, invite.tokenHash)) throw commandError('invite-not-found', 'Invite was not found.')
    if (invite.usedAt || invite.revokedAt) throw commandError('invite-used', 'Invite was already used.')
    if ((invite.expiresAtMs ?? 0) < Date.now()) throw commandError('invite-expired', 'Invite has expired.')
    const assignedStoreId = assignmentSnap.exists ? assignmentSnap.data()?.storeId : null
    if (assignedStoreId && assignedStoreId !== invite.storeId) {
      throw commandError('email-already-assigned', 'This account already manages another store.')
    }
    const storeRef = db.collection('stores').doc(invite.storeId)
    const [storeSnap, ownLegacyStoreSnap] = await Promise.all([
      transaction.get(storeRef),
      transaction.get(db.collection('stores').doc(request.auth.uid)),
    ])
    if (!storeSnap.exists) throw commandError('store-not-found', 'Store was not found.')
    // 以前の形の店（店の ID が自分の uid）のオーナーは、別の店の店長にしない（自分の店が見えなくなるため）。
    if (ownLegacyStoreSnap.exists && request.auth.uid !== invite.storeId) {
      throw commandError('email-already-assigned', 'This account already manages another store.')
    }
    const store = storeSnap.data()

    const now = FieldValue.serverTimestamp()
    transaction.set(assignmentRef, { email, storeId: invite.storeId, role: 'storeAdmin', updatedAt: now, updatedBy: 'invite' }, { merge: true })
    transaction.set(db.collection('allowedEmails').doc(email), { email, addedAt: now, addedBy: 'invite' }, { merge: true })
    transaction.update(inviteRef, { usedAt: now, usedByEmail: email })
    // 店長の表示用メール（ownerEmail）は、運営者が作った店で、まだ店長がいないときだけ書く。
    // 以前の形の店では ownerEmail が元のオーナーの権限に使われているので、書き換えない（2026-10-22 レビュー）。
    const setOwnerEmail = Boolean(store.createdBy) && !store.ownerEmail
    transaction.update(storeRef, {
      ...(setOwnerEmail ? { ownerEmail: email, ownerEmailUpdatedAt: now, ownerEmailUpdatedBy: 'invite' } : {}),
      managerInviteId: FieldValue.delete(),
      managerInviteExpiresAtMs: FieldValue.delete(),
      updatedAt: now,
    })
    return { ok: true, storeId: invite.storeId, storeName: storeSnap.data()?.storeName ?? '' }
  })
}

// 招待を開いたとき、店名と期限だけを見せる（ログイン前でも読める。秘密の値が合うときだけ）。
async function previewStoreInviteCommand({ inviteId, token }) {
  if (typeof inviteId !== 'string' || !inviteId) throw commandError('invite-not-found', 'Invite was not found.')
  const db = getFirestore()
  const inviteSnap = await db.collection(INVITE_COLLECTION).doc(inviteId).get()
  const invite = inviteSnap.exists ? inviteSnap.data() : null
  if (!invite || !inviteTokenMatches(token, invite.tokenHash)) throw commandError('invite-not-found', 'Invite was not found.')
  const storeSnap = await db.collection('stores').doc(invite.storeId).get()
  return {
    ok: true,
    storeName: storeSnap.data()?.storeName ?? '',
    expiresAtMs: invite.expiresAtMs ?? 0,
    status: invite.usedAt || invite.revokedAt ? 'used' : (invite.expiresAtMs ?? 0) < Date.now() ? 'expired' : 'open',
  }
}

// 古い・使用済みの招待を開いたなどは利用者の操作の結果。失敗ログには残さない。
const EXPECTED_INVITE_ERROR_CODES = new Set(['invite-not-found', 'invite-used', 'invite-expired', 'invite-email-required', 'email-already-assigned'])

const STORE_ONBOARDING_ERROR_CODES = [
  ['store-code-unavailable', 'unavailable'],
  ['invite-not-found', 'not-found'],
  ['invite-used', 'failed-precondition'],
  ['invite-expired', 'failed-precondition'],
  ['invite-email-required', 'failed-precondition'],
  ['email-already-assigned', 'failed-precondition'],
]

module.exports = {
  EXPECTED_INVITE_ERROR_CODES,
  INVITE_TTL_MS,
  STORE_CODE_CHARS,
  STORE_CODE_LENGTH,
  STORE_ONBOARDING_ERROR_CODES,
  claimStoreInviteCommand,
  createStoreCommand,
  generateStoreCode,
  hashInviteToken,
  inviteTokenMatches,
  previewStoreInviteCommand,
  reissueStoreInviteCommand,
}
