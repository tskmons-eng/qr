const { commandError } = require('./orderCommandShared')

const SUPER_EMAIL = 'tsk.mons@gmail.com'

function getAuthToken(request) {
  return request.auth?.token ?? null
}

// メールは大文字・小文字を区別しない（L6）。
function getEmail(request) {
  return String(getAuthToken(request)?.email ?? '').trim().toLowerCase()
}

function isGoogle(request) {
  const provider = getAuthToken(request)?.firebase?.sign_in_provider
  return !!request.auth && provider !== 'anonymous'
}

function isAnonymousStaff(request) {
  const provider = getAuthToken(request)?.firebase?.sign_in_provider
  return !!request.auth && provider === 'anonymous'
}

function isSuper(request) {
  return getEmail(request) === SUPER_EMAIL
}

async function isStoreAdminEmail(db, request, storeId) {
  const email = getEmail(request)
  if (!email || !isGoogle(request)) return false
  const emailIds = [...new Set([email, email.toLowerCase()])]
  const snaps = await Promise.all(emailIds.map(id => db.collection('storeAdminEmails').doc(id).get()))
  return snaps.some(snap => snap.exists && snap.data()?.storeId === storeId)
}

async function isOwnerOf(db, request, storeId) {
  if (!isGoogle(request) || request.auth.uid !== storeId) return false
  const storeSnap = await db.collection('stores').doc(storeId).get()
  if (!storeSnap.exists) return true
  const ownerEmail = String(storeSnap.data()?.ownerEmail ?? getEmail(request)).trim().toLowerCase()
  return ownerEmail === getEmail(request)
}

async function isStaffOf(db, request, storeId) {
  if (!isAnonymousStaff(request)) return false
  const sessionSnap = await db.collection('staffSessions').doc(request.auth.uid).get()
  return sessionSnap.exists && sessionSnap.data()?.storeId === storeId
}

// 店舗管理者（スーパー管理者・オーナー・店舗管理者メール）。スタッフ端末は含まない。
async function isStoreManager(db, request, storeId) {
  if (!storeId) return false
  if (isSuper(request)) return true
  return (await isOwnerOf(db, request, storeId)) ||
    (await isStoreAdminEmail(db, request, storeId))
}

// スタッフ端末で選ばれているスタッフ。権限の判定は staffSessions の写しではなく staffMembers を正とする。
async function loadActiveStaffMember(db, request, storeId) {
  if (!isAnonymousStaff(request)) return null
  const sessionSnap = await db.collection('staffSessions').doc(request.auth.uid).get()
  const session = sessionSnap.exists ? sessionSnap.data() : null
  if (!session || session.storeId !== storeId || typeof session.staffMemberId !== 'string' || !session.staffMemberId) return null
  const memberSnap = await db.collection('staffMembers').doc(session.staffMemberId).get()
  if (!memberSnap.exists || memberSnap.data()?.storeId !== storeId) return null
  return { id: memberSnap.id, ...memberSnap.data() }
}

// スタッフの操作をしてよい「誰か」をサーバーで決める（2026-10-22 整理 第4章 K5）。
// 店長・オーナー（Google ログイン）か、スタッフを選んだ端末だけ。店舗コードで入っただけの端末は不可。
// 操作した人の名前は画面の申告ではなく、ここで決めたものを記録に使う。1回の処理の中では結果を使い回す。
const STORE_MANAGER_ACTOR_ID = 'store-manager'
const actorCache = new WeakMap()

async function computeStaffActor(db, request, storeId) {
  if (!storeId) throw commandError('permission-denied', 'Store is required.')
  if (await isStoreManager(db, request, storeId)) {
    const token = getAuthToken(request) ?? {}
    return {
      id: STORE_MANAGER_ACTOR_ID,
      name: String(token.name ?? '').trim() || getEmail(request).split('@')[0] || '管理者',
      isStoreManager: true,
    }
  }
  if (!isAnonymousStaff(request) || !(await isStaffOf(db, request, storeId))) {
    throw commandError('permission-denied', 'You do not have access to this store.')
  }
  const member = await loadActiveStaffMember(db, request, storeId)
  if (!member) throw commandError('staff-not-selected', 'Select a staff member before this operation.')
  return { id: member.id, name: String(member.name ?? '').trim(), isStoreManager: false, member }
}

function resolveStaffActor(db, request, storeId) {
  let byStore = actorCache.get(request)
  if (!byStore) {
    byStore = new Map()
    actorCache.set(request, byStore)
  }
  if (!byStore.has(storeId)) byStore.set(storeId, computeStaffActor(db, request, storeId))
  return byStore.get(storeId)
}

async function assertStoreAccess(db, request, storeId) {
  if (!request.auth) {
    throw commandError('unauthenticated', 'Authentication is required for this order command.')
  }
  return resolveStaffActor(db, request, storeId)
}

async function loadTableForAccess(db, request, tableId) {
  if (!tableId) throw commandError('table-not-found', 'Table was not found.')
  const tableSnap = await db.collection('tables').doc(tableId).get()
  if (!tableSnap.exists) throw commandError('table-not-found', 'Table was not found.')
  const table = { id: tableSnap.id, ...tableSnap.data() }
  await assertStoreAccess(db, request, table.storeId)
  return table
}

async function loadOrderForAccess(db, request, orderId) {
  if (!orderId) throw commandError('order-not-found', 'Order was not found.')
  const orderSnap = await db.collection('orders').doc(orderId).get()
  if (!orderSnap.exists) throw commandError('order-not-found', 'Order was not found.')
  const order = { id: orderSnap.id, ...orderSnap.data() }
  await assertStoreAccess(db, request, order.storeId)
  return order
}

async function loadOrderItemForAccess(db, request, itemId) {
  if (!itemId) throw commandError('item-not-found', 'Order item was not found.')
  const itemSnap = await db.collection('orderItems').doc(itemId).get()
  if (!itemSnap.exists) throw commandError('item-not-found', 'Order item was not found.')
  const item = { id: itemSnap.id, ...itemSnap.data() }
  await assertStoreAccess(db, request, item.storeId)
  return item
}

async function assertOrderItemTargetsAccess(db, request, targets) {
  const itemIds = [...new Set((targets ?? []).map(target => target?.id).filter(Boolean))]
  if (itemIds.length === 0) throw commandError('item-not-found', 'Order item was not found.')
  const snaps = await Promise.all(itemIds.map(id => db.collection('orderItems').doc(id).get()))
  const storeIds = new Set()
  snaps.forEach((snap, index) => {
    if (!snap.exists) throw commandError('item-not-found', 'Order item was not found.')
    const storeId = snap.data()?.storeId
    if (!storeId) throw commandError('item-scope-mismatch', `Order item ${itemIds[index]} has no store.`)
    storeIds.add(storeId)
  })
  await Promise.all([...storeIds].map(storeId => assertStoreAccess(db, request, storeId)))
}

module.exports = {
  STORE_MANAGER_ACTOR_ID,
  assertOrderItemTargetsAccess,
  assertStoreAccess,
  resolveStaffActor,
  getEmail,
  isStoreManager,
  loadActiveStaffMember,
  loadOrderForAccess,
  loadOrderItemForAccess,
  loadTableForAccess,
}
