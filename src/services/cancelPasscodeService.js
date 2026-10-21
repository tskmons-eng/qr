import { doc, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { callOrderCommandFunction } from './orderFunctionCommandService'

export const CANCEL_PASSCODE_PATTERN = /^\d{4,8}$/

// 設定済みかどうかだけを stores/{storeId} から読む。パスコードそのものは画面からは読めない（storeSecrets）。
export function normalizeCancelPasscodeStatus(status) {
  return {
    isSet: status?.isSet === true,
    updatedAt: status?.updatedAt ?? null,
    updatedByName: typeof status?.updatedByName === 'string' ? status.updatedByName : '',
  }
}

export async function loadCancelPasscodeStatus(storeId) {
  if (!storeId) return normalizeCancelPasscodeStatus(null)
  const snap = await getDoc(doc(db, 'stores', storeId))
  return normalizeCancelPasscodeStatus(snap.exists() ? snap.data()?.cancelPasscodeStatus : null)
}

// ハッシュにして保存するのはサーバー（setCancelPasscodeCommand）。
export function saveCancelPasscode({ storeId, passcode }) {
  return callOrderCommandFunction('setCancelPasscodeCommand', { storeId, passcode })
}
