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
  - 既存実装で、管理画面の `showGuestCountButton` 設定と顧客人数画面の表示条件はつながっていることを確認。
  - ランタイムUIや注文開始 command は変更せず、設定OFF・商品未選択・表示OFFで自動追加文言が出ない条件をチェックで固定した。
  - 人数画面の文言は、選択商品名またはフォールバック名と人数が分かる `...をN名分追加して始める` の形を維持する。
- Checks:
  - `scripts/check-customer-entry.mjs` に `GuestCountPage` / `GuestCountSelector` の表示条件チェックを追加。
  - `scripts/check-settings-config.mjs` に `StoreWorkflowSettings` と `normalizeGuestAutoAdd()` の `showGuestCountButton` チェックを追加。
  - `git diff --check`: passed.
  - `npm run check:customer-entry`: passed.
  - `npm run check:settings`: passed.
  - `npm run check:order-functions-emulator`: failed in existing `runCheckoutSubmitRace` assertion (`actual 3`, expected `checkout-items-stale`). This task did not change Functions or checkout race code.
  - `npm run check`: passed.
  - `npm run build`: passed.
- Remaining risk:
  - 実データ上で `guestAutoAdd.enabled: true` かつ存在しない `productId` が保存されている場合、既存どおり管理画面に警告を出し、顧客人数画面では自動追加文言を出さない。データ修復や商品履歴の変更はこの担当では行わない。
  - `check:order-functions-emulator` の会計競合失敗は5番の表示確認とは別件として残る。
