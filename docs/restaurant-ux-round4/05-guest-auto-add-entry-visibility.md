# 05 Guest Auto Add Entry Visibility

## Purpose

「人数分メニュー自動追加」で、人数設定画面に追加内容のボタン表示を出す設定が本当に実装されているか確認する。
未実装または不十分なら、既存設計を壊さず補完する。

## Current Confirmation

- 設定の既定値は `src/lib/settingsConfig.js` の `GUEST_AUTO_ADD_DEFAULTS.showGuestCountButton`。
- 管理画面は `src/components/admin/StoreWorkflowSettings.jsx` に「人数設定画面に追加内容のボタン表示を出す」がある。
- 顧客人数画面は `src/pages/order/GuestCountPage.jsx` で `guestAutoAdd.showGuestCountButton !== false` を見ている。
- 注文開始 command は `guestAutoAdd` と `guestCount` を受け取り、人数分の自動追加を処理する。

## Change Plan

- まず実装済みかをソースとチェックで確認する。
- 実装済みなら、`scripts/check-customer-entry.mjs` または `scripts/check-settings-config.mjs` に表示条件のチェックを追加して完了にする。
- 不足があれば、以下の条件で補完する。
  - 設定OFFなら人数画面の追加内容ボタン/文言を出さない。
  - 設定ONでも `guestAutoAdd.enabled` と `productId` が無効なら出さない。
  - 表示文言は選択商品名と人数が分かるものにする。
  - 実際の注文開始処理は既存 command に任せる。

## Forbidden Changes

- 自動追加の商品や注文履歴を修正/削除しない。
- 人数選択からメニュー画面へ進むルートを変えない。
- storeConfig の既存キーをリネームしない。

## Impact Scope

- `src/pages/order/GuestCountPage.jsx`
- `src/components/order/GuestCountSelector.jsx`
- `src/components/admin/StoreWorkflowSettings.jsx`
- `src/lib/settingsConfig.js`
- `scripts/check-customer-entry.mjs`
- `scripts/check-settings-config.mjs`
- this MD

## Verification

- `npm run check:customer-entry`
- `npm run check:settings`
- `npm run check:order-functions-emulator`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result:
- Checks:
- Remaining risk:

