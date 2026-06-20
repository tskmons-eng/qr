# 03 Store Name Settings Sync

## Purpose

店舗コード設定の上に店舗名を表示し、管理画面と `/owner` 側の店舗名設定を同じ `stores/{storeId}.storeName` に同期する。

## Current Confirmation

- `src/contexts/StoreContext.jsx` は新規店舗作成時に `storeName: '店舗名未設定'` を `stores/{storeId}` に保存している。
- `src/lib/ownerDashboard.js` は `store.storeName || '店舗名未設定'` を `/owner` の店舗一覧へ渡している。
- `src/components/admin/StoreCodeCard.jsx` は店舗コードだけを表示し、店舗名は受け取っていない。
- `src/pages/admin/SettingsPage.jsx` は `loadStoreCode(storeId)` を呼ぶが、店舗名の読み込み・保存は持っていない。
- Firestore rules の `stores/{storeId}` update は `canManageStore(storeId)` に限定されている。

## Change Plan

- `settingsService` に店舗表示情報の読み込み/保存を追加し、`storeName` と `storeCode` を同じ `stores/{storeId}` から扱う。
- 店舗コードカードの上部に店舗名を表示する。未設定時は `店舗名未設定` を出す。
- 管理画面では、店舗名設定を `管理者・キッチン アクセス許可` の近くに置く。スーパー管理者だけでなく、その店舗を管理できるオーナー/割当管理者が自然に変更できる導線にする。
- `/owner` 側で店舗名編集を追加する場合も、同じ `stores/{storeId}.storeName` を更新し、`storeId` や注文データは変えない。
- 保存時は空白だけの店舗名を拒否または `店舗名未設定` 相当に正規化する。文字数上限を設け、長い店舗名でテーブルやカードが崩れないようにする。

## UI Requirements

- 店舗名は店舗コードより上に置き、店を識別してからコードを確認できる順序にする。
- 入力、保存、保存中、保存済み、エラー状態を用意する。
- 設定パネルを増やしすぎず、店舗名とアクセス許可は近い領域に整理する。
- 長い店舗名でもボタンや表の列を押し出さない。

## Impact Scope

- `src/pages/admin/SettingsPage.jsx`
- `src/components/admin/StoreCodeCard.jsx`
- new or existing admin store name component
- `src/services/settingsService.js`
- `src/components/owner/OwnerStoreDashboard.jsx` if `/owner` editing is added
- `src/services/ownerDashboardService.js` if `/owner` editing is added
- `src/lib/ownerDashboard.js`
- `src/styles/admin-settings-core.css`
- `src/styles/owner-dashboard.css`
- `scripts/check-settings.mjs`
- `scripts/check-owner-dashboard.mjs`
- this MD

## Forbidden Changes

- 店舗名変更で `stores/{storeId}` のIDを変えない。
- `storeConfig` を店舗名の主データにしない。
- QR URL、店舗コード、既存注文、商品、スタッフデータを変更しない。

## Verification

- `npm run check:settings`
- `npm run check:owner-dashboard`
- `npm run check:store-admin-assignment`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result: 管理画面の店舗情報カードで `stores/{storeId}.storeName` を編集・保存できるようにし、店舗名を店舗コードより上へ表示した。`/owner` の店舗一覧にも同じ `storeName` の編集導線を追加した。店舗コード、QR URL、注文、商品、スタッフデータは変更しない。
- Checks: `git diff --check`, `npm run check:settings`, `npm run check:owner-dashboard`, `npm run check:store-admin-assignment`, `npm run check`, and `npm run build` passed.
- Remaining risk: 05統合ゲートで 01/04 と `/owner` 行UIの横幅・保存導線が衝突していないか最終確認する。
