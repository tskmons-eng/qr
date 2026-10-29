// 手元のテスト環境（エミュレーター）に、テスト用の店・スタッフ・メニュー・席を作る。本番には一切つながらない。
// 使い方：npm run dev:local（エミュレーターと画面の起動と一緒に自動で実行される）。単独なら、エミュレーターを起動した状態で node scripts/seed-local-emulator.mjs。
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

export const LOCAL_PROJECT_ID = 'demo-qr-local'

// テスト用の値（このテスト環境の中だけで使う。本番のアカウントやパスワードではない）。
export const LOCAL_TEST_ACCOUNTS = {
  storeId: 'local-test-store',
  storeCode: 'TEST01',
  storeName: 'テスト店',
  owner: { email: 'owner@example.test', password: 'local-test-pass-1' },
  staff: [
    { id: 'local-staff-manager', name: 'テスト店長', code: '1111', permissionPreset: 'manager' },
    { id: 'local-staff-floor', name: 'テストホール', code: '2222', permissionPreset: 'floor' },
  ],
}

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url))

export async function seedLocalEmulator() {
  process.env.GCLOUD_PROJECT = LOCAL_PROJECT_ID
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
  const { initializeApp, getApps } = functionsRequire('firebase-admin/app')
  const { getAuth } = functionsRequire('firebase-admin/auth')
  const { getFirestore, FieldValue } = functionsRequire('firebase-admin/firestore')
  const app = getApps().find(existing => existing.name === 'local-seed') || initializeApp({ projectId: LOCAL_PROJECT_ID }, 'local-seed')
  const db = getFirestore(app)
  const auth = getAuth(app)
  const now = FieldValue.serverTimestamp()
  const { storeId, storeCode, storeName, owner, staff } = LOCAL_TEST_ACCOUNTS

  try {
    await auth.getUserByEmail(owner.email)
  } catch {
    await auth.createUser({ email: owner.email, password: owner.password, emailVerified: true, displayName: 'テスト管理者' })
  }

  const writes = [
    db.collection('stores').doc(storeId).set({ storeName, storeCode, ownerEmail: owner.email, createdAt: now, updatedAt: now }),
    db.collection('storeCodes').doc(storeCode).set({ storeId, createdAt: now }),
    db.collection('storeAdminEmails').doc(owner.email).set({ storeId, email: owner.email, updatedAt: now }),
    db.collection('allowedEmails').doc(owner.email).set({ email: owner.email, addedAt: now }),
    ...staff.map(member => db.collection('staffMembers').doc(member.id).set({
      storeId,
      name: member.name,
      code: member.code,
      permissionPreset: member.permissionPreset,
      createdAt: now,
    })),
    db.collection('categories').doc('local-cat-food').set({ storeId, name: 'フード', group: 'food', isActive: true, sortOrder: 1, createdAt: now, updatedAt: now }),
    db.collection('categories').doc('local-cat-drink').set({ storeId, name: 'ドリンク', group: 'drink', isActive: true, sortOrder: 2, createdAt: now, updatedAt: now }),
    db.collection('products').doc('local-product-otoshi').set({ storeId, name: 'お通し', price: 400, categoryId: 'local-cat-food', isVisible: true, isSoldOut: false, sortOrder: 1, createdAt: now, updatedAt: now }),
    db.collection('products').doc('local-product-karaage').set({ storeId, name: '唐揚げ', price: 680, categoryId: 'local-cat-food', isVisible: true, isSoldOut: false, sortOrder: 2, createdAt: now, updatedAt: now }),
    db.collection('products').doc('local-product-beer').set({ storeId, name: '生ビール', price: 550, categoryId: 'local-cat-drink', isVisible: true, isSoldOut: false, sortOrder: 3, createdAt: now, updatedAt: now }),
    ...[1, 2, 3].map(number => db.collection('tables').doc(`local-table-${number}`).set({
      storeId,
      tableName: `テーブル${number}`,
      qrToken: `local-table-${number}-qr`,
      status: 'vacant',
      currentOrderId: null,
      guestCount: 0,
      pendingCount: 0,
      sortOrder: number,
      createdAt: now,
      updatedAt: now,
    })),
    // QRの入口の記録（2026-10-28 QR 第1章）。お客様はこれを1件だけ読んで席を知る。
    ...[1, 2, 3].map(number => db.collection('tableEntries').doc(`local-table-${number}-qr`).set({
      storeId,
      tableId: `local-table-${number}`,
      createdAt: now,
    })),
  ]
  await Promise.all(writes)
  return LOCAL_TEST_ACCOUNTS
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedLocalEmulator()
  console.log('テスト用の店を作りました（手元のテスト環境だけ）')
}
