const { onDocumentCreated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp()

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
