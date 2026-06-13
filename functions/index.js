const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')
const { FieldValue, getFirestore } = require('firebase-admin/firestore')

initializeApp()

const TABLE_PENDING_AGGREGATE_VERSION = 1

function getPendingAggregateCounts(item) {
  if (!item || item.itemStatus !== 'ordered' || !item.tableId) return null
  return {
    tableId: item.tableId,
    total: 1,
    drink: item.categoryGroup === 'drink' ? 1 : 0,
    food: item.categoryGroup === 'food' ? 1 : 0,
  }
}

function addPendingDelta(deltaMap, entry, direction) {
  if (!entry) return
  const previous = deltaMap.get(entry.tableId) ?? { total: 0, drink: 0, food: 0 }
  deltaMap.set(entry.tableId, {
    total: previous.total + (entry.total * direction),
    drink: previous.drink + (entry.drink * direction),
    food: previous.food + (entry.food * direction),
  })
}

async function applyPendingAggregateDeltas(entries) {
  const deltaMap = new Map()
  entries.forEach(({ entry, direction }) => addPendingDelta(deltaMap, entry, direction))
  if (deltaMap.size === 0) return

  const db = getFirestore()
  const batch = db.batch()
  let hasWrites = false
  for (const [tableId, delta] of deltaMap) {
    if (delta.total === 0 && delta.drink === 0 && delta.food === 0) continue
    batch.set(db.collection('tables').doc(tableId), {
      pendingAggregateVersion: TABLE_PENDING_AGGREGATE_VERSION,
      pendingAggregateCount: FieldValue.increment(delta.total),
      pendingAggregateDrinkCount: FieldValue.increment(delta.drink),
      pendingAggregateFoodCount: FieldValue.increment(delta.food),
      pendingAggregateUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    hasWrites = true
  }
  if (!hasWrites) return
  await batch.commit()
}

exports.syncTablePendingAggregateOnCreate = onDocumentCreated('orderItems/{itemId}', async (event) => {
  await applyPendingAggregateDeltas([
    { entry: getPendingAggregateCounts(event.data.data()), direction: 1 },
  ])
})

exports.syncTablePendingAggregateOnUpdate = onDocumentUpdated('orderItems/{itemId}', async (event) => {
  const before = getPendingAggregateCounts(event.data.before.data())
  const after = getPendingAggregateCounts(event.data.after.data())
  if (
    before?.tableId === after?.tableId &&
    before?.drink === after?.drink &&
    before?.food === after?.food
  ) {
    return
  }

  await applyPendingAggregateDeltas([
    { entry: before, direction: -1 },
    { entry: after, direction: 1 },
  ])
})

exports.syncTablePendingAggregateOnDelete = onDocumentDeleted('orderItems/{itemId}', async (event) => {
  await applyPendingAggregateDeltas([
    { entry: getPendingAggregateCounts(event.data.data()), direction: -1 },
  ])
})

exports.notifyStaff = onDocumentCreated('calls/{callId}', async (event) => {
  const call = event.data.data()
  if (!call) return

  const { storeId, tableName, type } = call
  const isCheckout = type === 'checkout'

  const db = getFirestore()
  const configSnap = await db.collection('storeConfig').doc(storeId).get()
  if (configSnap.exists && configSnap.data()?.notificationsEnabled === false) return

  const tokensSnap = await db.collection('staffTokens')
    .where('storeId', '==', storeId)
    .get()

  if (tokensSnap.empty) return

  const tokens = tokensSnap.docs
    .map(d => d.data())
    .filter(data => data.enabled !== false)
    .map(data => data.token)
    .filter(Boolean)
  if (tokens.length === 0) return

  const title = isCheckout ? `💳 会計希望 — ${tableName}` : `🔔 呼び出し — ${tableName}`
  const body = isCheckout ? 'お会計をお願いします' : 'スタッフを呼んでいます'

  const message = {
    notification: { title, body },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'staff-call',
        renotify: true,
        requireInteraction: true,
      },
      fcmOptions: { link: '/staff' },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
    tokens,
  }

  const response = await getMessaging().sendEachForMulticast(message)

  // 無効なトークンを削除
  const deletes = []
  response.responses.forEach((resp, i) => {
    if (!resp.success) {
      const code = resp.error?.code
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token') {
        deletes.push(db.collection('staffTokens').doc(tokens[i]).delete())
      }
    }
  })
  await Promise.all(deletes)
})
