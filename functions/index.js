const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore')
const { createOrderCommandCallable } = require('./orderCommandApi')
const orderCommandHandlers = require('./orderCommandHandlers')

initializeApp()

const ASIA_NORTHEAST_FUNCTION_REGION = 'asia-northeast1'
const US_CENTRAL_FUNCTION_REGION = 'us-central1'
const EVENT_TRIGGER_MAX_INSTANCES = 20
const TABLE_PENDING_AGGREGATE_VERSION = 1
const RESERVATION_ARRIVAL_BATCH_SIZE = 100

exports.startCustomerOrderSessionCommand = createOrderCommandCallable(orderCommandHandlers.startCustomerOrderSession, {
  commandType: 'start_customer_order_session',
  actorType: 'customer',
})
exports.submitCustomerOrderItemsCommand = createOrderCommandCallable(orderCommandHandlers.submitCustomerOrderItems, {
  commandType: 'customer_submit_items',
  actorType: 'customer',
})
exports.submitCustomerOrderItemsCommandAsia = createOrderCommandCallable(orderCommandHandlers.submitCustomerOrderItems, {
  commandType: 'customer_submit_items',
  actorType: 'customer',
}, { region: ASIA_NORTHEAST_FUNCTION_REGION })
exports.submitStaffOrderItemsCommand = createOrderCommandCallable(orderCommandHandlers.submitStaffOrderItems, {
  commandType: 'staff_submit_items',
  actorType: 'staff',
})
exports.submitStaffOrderItemsCommandAsia = createOrderCommandCallable(orderCommandHandlers.submitStaffOrderItems, {
  commandType: 'staff_submit_items',
  actorType: 'staff',
}, { region: ASIA_NORTHEAST_FUNCTION_REGION })
exports.seatStaffOrderSessionCommand = createOrderCommandCallable(orderCommandHandlers.seatStaffOrderSession, {
  commandType: 'seat_staff_order_session',
  actorType: 'staff',
})
exports.completeCheckoutCommand = createOrderCommandCallable(orderCommandHandlers.completeCheckoutCommand, {
  commandType: 'complete_checkout',
  actorType: 'staff',
})
exports.markOrderItemServedCommand = createOrderCommandCallable(orderCommandHandlers.markOrderItemServedCommand, {
  commandType: 'mark_order_item_served',
  actorType: 'staff',
})
exports.markOrderItemsServedCommand = createOrderCommandCallable(orderCommandHandlers.markOrderItemsServedCommand, {
  commandType: 'mark_order_items_served',
  actorType: 'staff',
})
exports.markOrderItemOrderedCommand = createOrderCommandCallable(orderCommandHandlers.markOrderItemOrderedCommand, {
  commandType: 'mark_order_item_ordered',
  actorType: 'staff',
})
exports.cancelOrderItemCommand = createOrderCommandCallable(orderCommandHandlers.cancelOrderItemCommand, {
  commandType: 'cancel_order_item',
  actorType: 'staff',
})
exports.moveTableOrderCommand = createOrderCommandCallable(orderCommandHandlers.moveTableOrderCommand, {
  commandType: 'move_table_order',
  actorType: 'staff',
})
exports.guideReservationToTableCommand = createOrderCommandCallable(orderCommandHandlers.guideReservationToTableCommand, {
  commandType: 'guide_reservation_to_table',
  actorType: 'staff',
})

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

function normalizeGuestCount(value) {
  const count = Number(value)
  if (!Number.isFinite(count)) return 1
  return Math.max(1, Math.round(count))
}

function formatReservationGuest(reservation) {
  return `${reservation.time ?? ''} ${reservation.name ?? '予約'}様 ${normalizeGuestCount(reservation.guestCount)}名`
}

function getReservationTableLabel(reservation, table) {
  return table?.tableName ?? reservation.tableNameSnapshot ?? '席未指定'
}

async function sendStaffNotification({ storeId, title, body, link = '/staff', tag = 'staff-notice' }) {
  if (!storeId) return { sent: false, reason: 'missing-store' }

  const db = getFirestore()
  const configSnap = await db.collection('storeConfig').doc(storeId).get()
  if (configSnap.exists && configSnap.data()?.notificationsEnabled === false) {
    return { sent: false, reason: 'disabled' }
  }

  const tokensSnap = await db.collection('staffTokens')
    .where('storeId', '==', storeId)
    .get()

  if (tokensSnap.empty) return { sent: false, reason: 'no-tokens' }

  const tokens = tokensSnap.docs
    .map(d => d.data())
    .filter(data => data.enabled !== false)
    .map(data => data.token)
    .filter(Boolean)
  if (tokens.length === 0) return { sent: false, reason: 'no-enabled-tokens' }

  const message = {
    notification: { title, body },
    data: { tag, link },
    webpush: {
      notification: {
        title,
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag,
        renotify: true,
        requireInteraction: true,
      },
      fcmOptions: { link },
    },
    apns: {
      payload: { aps: { sound: 'default', badge: 1 } },
    },
    tokens,
  }

  const response = await getMessaging().sendEachForMulticast(message)

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

  return { sent: response.successCount > 0, successCount: response.successCount }
}

exports.syncTablePendingAggregateOnCreate = onDocumentCreated({
  document: 'orderItems/{itemId}',
  region: ASIA_NORTHEAST_FUNCTION_REGION,
  maxInstances: EVENT_TRIGGER_MAX_INSTANCES,
}, async (event) => {
  await applyPendingAggregateDeltas([
    { entry: getPendingAggregateCounts(event.data.data()), direction: 1 },
  ])
})

exports.syncTablePendingAggregateOnUpdate = onDocumentUpdated({
  document: 'orderItems/{itemId}',
  region: ASIA_NORTHEAST_FUNCTION_REGION,
  maxInstances: EVENT_TRIGGER_MAX_INSTANCES,
}, async (event) => {
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

exports.syncTablePendingAggregateOnDelete = onDocumentDeleted({
  document: 'orderItems/{itemId}',
  region: ASIA_NORTHEAST_FUNCTION_REGION,
  maxInstances: EVENT_TRIGGER_MAX_INSTANCES,
}, async (event) => {
  await applyPendingAggregateDeltas([
    { entry: getPendingAggregateCounts(event.data.data()), direction: -1 },
  ])
})

exports.notifyStaff = onDocumentCreated({
  document: 'calls/{callId}',
  region: US_CENTRAL_FUNCTION_REGION,
  maxInstances: EVENT_TRIGGER_MAX_INSTANCES,
}, async (event) => {
  const call = event.data.data()
  if (!call) return

  const { storeId, tableName, type } = call
  const isCheckout = type === 'checkout'

  const title = isCheckout ? `💳 会計希望 — ${tableName}` : `🔔 呼び出し — ${tableName}`
  const body = isCheckout ? 'お会計をお願いします' : 'スタッフを呼んでいます'

  await sendStaffNotification({
    storeId,
    title,
    body,
    link: '/staff',
    tag: 'staff-call',
  })
})

exports.notifyReservationCreated = onDocumentCreated({
  document: 'reservations/{reservationId}',
  region: ASIA_NORTHEAST_FUNCTION_REGION,
  maxInstances: EVENT_TRIGGER_MAX_INSTANCES,
}, async (event) => {
  const reservation = event.data.data()
  if (!reservation || reservation.status !== 'confirmed') return

  await sendStaffNotification({
    storeId: reservation.storeId,
    title: '予約が入りました',
    body: formatReservationGuest(reservation),
    link: '/staff/reservations',
    tag: 'reservation-created',
  })

  await event.data.ref.set({
    createdNoticeSentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })
})

async function processReservationArrival(reservationDoc) {
  const db = getFirestore()
  let notification = null

  await db.runTransaction(async transaction => {
    const reservationRef = reservationDoc.ref
    const latestReservationSnap = await transaction.get(reservationRef)
    if (!latestReservationSnap.exists) return

    const reservation = latestReservationSnap.data()
    if (reservation.status !== 'confirmed' || reservation.arrivalNoticeStatus !== 'pending') return

    const now = FieldValue.serverTimestamp()
    const guestCount = normalizeGuestCount(reservation.guestCount)
    let tableSnap = null
    let table = null
    let waitingReason = 'table_unassigned'

    if (reservation.tableId) {
      const tableRef = db.collection('tables').doc(reservation.tableId)
      tableSnap = await transaction.get(tableRef)
      table = tableSnap.exists ? tableSnap.data() : null
      if (!table || table.storeId !== reservation.storeId) {
        waitingReason = 'table_missing'
      } else if (table.status !== 'vacant' || table.currentOrderId) {
        waitingReason = 'table_occupied'
      } else {
        const orderRef = db.collection('orders').doc()
        transaction.set(orderRef, {
          storeId: reservation.storeId,
          tableId: reservation.tableId,
          guestCount,
          status: 'open',
          openedAt: now,
          checkedOutAt: null,
          createdBy: 'reservation',
          reservationId: reservationDoc.id,
          updatedAt: now,
        })
        transaction.update(tableRef, {
          status: 'occupied',
          guestCount,
          currentOrderId: orderRef.id,
          startedAt: now,
          pendingCount: 0,
          pendingAggregateVersion: TABLE_PENDING_AGGREGATE_VERSION,
          pendingAggregateCount: 0,
          pendingAggregateDrinkCount: 0,
          pendingAggregateFoodCount: 0,
          updatedAt: now,
        })
        transaction.update(reservationRef, {
          status: 'seated',
          arrivalNoticeStatus: 'sent',
          arrivalNoticeSentAt: now,
          waitingStatus: 'handled',
          waitingReason: null,
          seatedTableId: reservation.tableId,
          seatedOrderId: orderRef.id,
          handledByStaffId: null,
          handledByStaffName: '自動案内',
          updatedAt: now,
        })
        transaction.set(db.collection('staffActions').doc(), {
          storeId: reservation.storeId,
          actionType: 'auto_seat_reservation',
          targetType: 'reservation',
          targetId: reservationDoc.id,
          actorType: 'system',
          note: `${reservation.name ?? '予約'} ${guestCount}名を${table.tableName ?? ''}へ自動案内`,
          createdAt: now,
        })
        notification = {
          storeId: reservation.storeId,
          title: '予約のお客様を席へ案内しました',
          body: `${formatReservationGuest(reservation)} / ${getReservationTableLabel(reservation, table)}`,
          link: `/staff/table/${reservation.tableId}`,
          tag: 'reservation-arrival',
        }
        return
      }
    }

    transaction.update(reservationRef, {
      arrivalNoticeStatus: 'sent',
      arrivalNoticeSentAt: now,
      waitingStatus: 'pending',
      waitingReason,
      updatedAt: now,
    })
    notification = {
      storeId: reservation.storeId,
      title: '予約のお客様が待っています',
      body: `${formatReservationGuest(reservation)} / ${getReservationTableLabel(reservation, table)}`,
      link: '/staff',
      tag: 'reservation-arrival',
    }
  })

  if (notification) await sendStaffNotification(notification)
}

exports.processReservationArrivals = onSchedule({
  schedule: 'every 1 minutes',
  timeZone: 'Asia/Tokyo',
  region: US_CENTRAL_FUNCTION_REGION,
  maxInstances: EVENT_TRIGGER_MAX_INSTANCES,
}, async () => {
  const db = getFirestore()
  const snap = await db.collection('reservations')
    .where('status', '==', 'confirmed')
    .where('arrivalNoticeStatus', '==', 'pending')
    .where('arrivalNoticeAt', '<=', Timestamp.now())
    .orderBy('arrivalNoticeAt', 'asc')
    .limit(RESERVATION_ARRIVAL_BATCH_SIZE)
    .get()

  await Promise.all(snap.docs.map(processReservationArrival))
})
