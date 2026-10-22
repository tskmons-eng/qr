import { STORE_NAME_FALLBACK } from './storeIdentity.js'

// 「はじめの準備」（2026-10-22 店舗登録）。今あるデータの件数から済んだかを決め、新しいデータは作らない。
// 並びはユーザー様の順番：店舗名 → スタッフ → 商品 → 席 → QR。
export function buildStoreSetupSteps({ storeName, staffCount, productCount, tableCount }) {
  const hasName = Boolean(storeName) && storeName !== STORE_NAME_FALLBACK
  const steps = [
    { key: 'name', label: '店舗名', hint: hasName ? storeName : 'お客様の画面に出る名前', done: hasName, path: '/staff/settings', action: hasName ? '直す' : '決める' },
    { key: 'staff', label: 'スタッフを登録', hint: '名前と4桁のパス。ホール・厨房の人を', done: staffCount > 0, path: '/staff/staff-admin', action: '登録する' },
    { key: 'menu', label: '商品を登録', hint: '分類（フード・ドリンク）と商品', done: productCount > 0, path: '/staff/menu-admin', action: '登録する' },
    { key: 'tables', label: '席を作る', hint: '席の名前と並び順', done: tableCount > 0, path: '/staff/tables', action: '作る' },
    // QR は印刷したかを記録できないので、席ができたら押せるようにし、最後に「準備を終える」で閉じる。
    { key: 'qr', label: 'QR を印刷', hint: '席ごとの注文用 QR', done: false, path: '/staff/tables', action: '印刷する', optional: true },
  ]
  const firstOpen = steps.find(step => !step.done)
  return steps.map(step => ({ ...step, current: step === firstOpen }))
}

export function countDoneSetupSteps(steps) {
  return steps.filter(step => step.done).length
}

// 新しく作った店（setupGuideRequired）は「準備を終える」を押すまで出す。
// 前からある店は、必要なもの（店舗名・スタッフ・商品・席）が欠けているときだけ出す。
export function shouldShowStoreSetupGuide({ setupGuideRequired, setupGuideClosed, steps }) {
  if (setupGuideClosed) return false
  if (setupGuideRequired) return true
  return steps.some(step => !step.optional && !step.done)
}
