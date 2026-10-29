import { signInAnonymously } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { callAsiaOrderCommandFunction } from './orderFunctionCommandService'

// お客様の端末の見えないログイン（2026-10-29 QR 第2章）。名前もパスも要らない。
// 注文の品を読めるのは、店の人と「この端末はこの注文」と記録されたお客様だけ（firestore.rules）。
// 記録はサーバーが着席・注文・この端末を加える（join）ときに書く。
const JOIN_STORAGE_PREFIX = 'qr.customerJoin.v1'

function joinKey(uid, orderId) {
  return `${JOIN_STORAGE_PREFIX}.${uid}.${orderId}`
}

function readJoined(key) {
  try {
    return globalThis.sessionStorage?.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeJoined(key) {
  try {
    globalThis.sessionStorage?.setItem(key, '1')
  } catch {
    // 控えられなくても、次に開いたときにもう一度加えるだけ。
  }
}

export async function ensureCustomerSignedIn() {
  await auth.authStateReady?.()
  if (!auth.currentUser) await signInAnonymously(auth)
  return auth.currentUser.uid
}

// 着席・注文の前に呼ぶ。ログインできなくても止めない（注文が送れないことの方が店の損害が大きい）。
export async function trySignInCustomer() {
  try {
    return await ensureCustomerSignedIn()
  } catch {
    return null
  }
}

// 読めなかったとき（同じ端末で別の席を開いて記録が上書きされた等）に、加わり済みの印を消して加わり直せるようにする。
export function forgetCustomerJoined(orderId) {
  const uid = auth.currentUser?.uid
  if (!uid || !orderId) return
  try {
    globalThis.sessionStorage?.removeItem(joinKey(uid, orderId))
  } catch {
    // 消せなくても次の読み込み直しで加わり直す。
  }
}

// すでに加わった印があるときだけ true（加わる処理は呼ばない）。
export function isCustomerJoined(orderId) {
  const uid = auth.currentUser?.uid
  return Boolean(uid && orderId && readJoined(joinKey(uid, orderId)))
}

// 着席した端末はサーバーが記録済みなので、加える処理を省くために印を付ける。
export function markCustomerJoined(orderId) {
  const uid = auth.currentUser?.uid
  if (uid && orderId) writeJoined(joinKey(uid, orderId))
}

// この端末を席の今の注文に加える（2台目のスマホ・読み込み直し）。同じ端末・同じ注文では1回だけ。
export async function ensureCustomerOrderAccess({ storeId, tableId, orderId, qrToken }) {
  const uid = await ensureCustomerSignedIn()
  const key = joinKey(uid, orderId)
  if (readJoined(key)) return
  await callAsiaOrderCommandFunction('joinCustomerOrderCommand', { storeId, tableId, orderId, qrToken })
  writeJoined(key)
}
