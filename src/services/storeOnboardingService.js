import { callOrderCommandFunction } from './orderFunctionCommandService'

// 店舗登録（2026-10-22）。店舗・店舗コード・店長の招待は Functions だけが作る。画面は呼ぶだけ。

export function createStore({ storeName }) {
  return callOrderCommandFunction('createStoreCommand', { storeName })
}

export function reissueStoreInvite({ storeId }) {
  return callOrderCommandFunction('reissueStoreInviteCommand', { storeId })
}

export function previewStoreInvite({ inviteId, token }) {
  return callOrderCommandFunction('previewStoreInviteCommand', { inviteId, token })
}

export function claimStoreInvite({ inviteId, token }) {
  return callOrderCommandFunction('claimStoreInviteCommand', { inviteId, token })
}

export function buildStoreInviteUrl({ inviteId, token }, origin = window.location.origin) {
  return `${origin}/invite/${encodeURIComponent(inviteId)}/${encodeURIComponent(token)}`
}
