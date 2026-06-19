const { commandError } = require('./orderCommandShared')

const SUPER_EMAIL = 'tsk.mons@gmail.com'

function getAuthToken(request) {
  return request.auth?.token ?? null
}

function getEmail(request) {
  return getAuthToken(request)?.email ?? ''
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
  const ownerEmail = storeSnap.data()?.ownerEmail ?? getEmail(request)
  return ownerEmail === getEmail(request)
}

async function isStaffOf(db, request, storeId) {
  if (!isAnonymousStaff(request)) return false
  const sessionSnap = await db.collection('staffSessions').doc(request.auth.uid).get()
  return sessionSnap.exists && sessionSnap.data()?.storeId === storeId
}

async function canAccessStore(db, request, storeId) {
  if (!storeId) return false
  if (isSuper(request)) return true
  return (await isOwnerOf(db, request, storeId)) ||
    (await isStoreAdminEmail(db, request, storeId)) ||
    (await isStaffOf(db, request, storeId))
}

async function assertStoreAccess(db, request, storeId) {
  if (!request.auth) {
    throw commandError('unauthenticated', 'Authentication is required for this order command.')
  }
  if (!await canAccessStore(db, request, storeId)) {
    throw commandError('permission-denied', 'You do not have access to this store.')
  }
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
  assertOrderItemTargetsAccess,
  assertStoreAccess,
  loadOrderForAccess,
  loadOrderItemForAccess,
  loadTableForAccess,
}
