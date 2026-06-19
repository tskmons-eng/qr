# 06 Customer Menu Row Tap Add Setting

## Purpose

顧客メニューで、プラスボタンだけでなく商品行をタップしても追加できるようにする。
オプションがある商品は、従来どおりオプション選択画面を開く。
うまく実装できる場合はこれをデフォルトにし、設定で「プラスボタンのみ」に戻せるようにする。

## Current Confirmation

- 顧客商品行は `src/components/order/CustomerMenuProductList.jsx`。
- オプションあり商品は `onAddProduct(product)` から `OptionModal` を開く。
- オプションなし商品は `onSetSimpleProductQuantity(product, next)` で数量を増減する。
- 店舗設定は `src/lib/settingsConfig.js`、管理画面は `src/pages/admin/SettingsPage.jsx` と関連設定コンポーネントで管理される。

## Change Plan

- `STORE_CONFIG_DEFAULTS` に顧客メニュー操作設定を追加する。候補キー: `customerMenuTapToAddEnabled: true`。
- 管理画面の適切な場所に「商品行タップで追加」トグルを追加する。
- `OrderEntryPage` から読み込んだ `storeConfig` を `MenuPage` で参照し、商品リストへ渡す。
- 設定ONの場合:
  - 売り切れでない商品行をタップ可能にする。
  - オプションなしは数量を1増やす。
  - オプションありはオプション選択画面を開く。
- 設定OFFの場合:
  - 既存のプラス/選択ボタン操作のみ。
- 行タップとプラスボタンのイベントが二重発火しないよう、ボタン側で `stopPropagation` する。
- アクセシビリティとして、行に `button` 相当の意図が分かる aria を付けるか、buttonを広げる構造を検討する。

## Forbidden Changes

- オプション選択の数量UIは変えない。
- カートID、`clientRequestId`、注文送信処理を変えない。
- 売り切れ商品をタップで追加できるようにしない。
- 店舗設定の既存キーをリネームしない。

## Impact Scope

- `src/components/order/CustomerMenuProductList.jsx`
- `src/pages/order/MenuPage.jsx`
- `src/lib/settingsConfig.js`
- `src/pages/admin/SettingsPage.jsx`
- related settings component if needed
- `src/styles/customer-menu.css`
- `scripts/check-customer-cart.mjs`
- `scripts/check-customer-entry.mjs`
- `scripts/check-settings-config.mjs`
- this MD

## Verification

- `npm run check:customer-cart`
- `npm run check:customer-entry`
- `npm run check:settings`
- `npm run check:option-modal`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result: `customerMenuTapToAddEnabled` を店舗設定に追加し、既定ONで顧客メニューの商品名/価格/画像エリアをタップ追加できるようにした。設定OFF時は従来どおりプラス/選択ボタンのみ。売り切れ商品はタップ追加不可。
- Checks:
  - `npm run check:customer-cart` passed.
  - `npm run check:customer-entry` passed.
  - `npm run check:settings` passed.
  - `npm run check:option-modal` passed.
  - `git diff --check` passed with CRLF warnings only.
  - `npm run check` passed.
  - `npm run build` passed.
- Remaining risk: 最終deploy前に `07-integration-release-gate.md` で統合状態と実機タップ感を確認する。

