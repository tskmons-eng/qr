# 03 Customer Cart Checkout History Navigation

## Purpose

顧客QR画面の下部導線と命名を整理する。
現在の「注文確認追加」は実態としてカートなので、分かりやすい名前にする。
注文履歴は注文直後だけでなく、会計導線からいつでも確認できるようにする。
カート/注文前確認では料金を目立たせず、会計確認時に注文済み内容と金額を表示する。

## Current Confirmation

- 下部ナビは `src/components/CustomerBottomNav.jsx`。
- カート画面は `src/pages/order/CartPage.jsx`、カートヘッダーは `src/components/order/CartHeader.jsx`、明細は `CartItemList.jsx`。
- 注文履歴/状態表示は `src/pages/order/OrderCompletePage.jsx` と `src/components/order/OrderStatus*`。
- 顧客注文履歴の設定は `src/lib/customerOrderStatus.js` と `src/lib/settingsConfig.js` にある。

## Change Plan

- 下部ナビの「注文確認追加」は「カート」または同等に分かりやすい名前へ変更する。
- カートボタンのサブ表示から金額を外し、点数中心の表示にする。
- カート画面は「注文する前のカート」であることが分かるタイトルにする。
- カート内の料金表示は必要最小限にする。ユーザー様の要望どおり、注文前の追加ボタン周辺では料金を見せなくてよい。
- 会計ボタンを押した後の確認UIで、注文済み履歴と合計金額を表示し、そこから本当の会計依頼を送る二段階にする。
- 既存の `OrderCompletePage` / 注文状態UIを再利用し、新しい重複履歴画面を作らない。

## Naming Direction

- 追加中のもの: `カート`
- 注文済みのもの: `注文履歴` または `注文状況`
- 会計依頼前の確認: `会計確認`
- 本当にスタッフへ送る操作: `会計を依頼する`

## Forbidden Changes

- 顧客注文送信 command、`clientRequestId`、リロード復旧の挙動を変えない。
- 注文履歴や会計履歴を削除しない。
- QR URL や `/order/:token/menu|cart|complete` の既存ルートを壊さない。
- 設定 `showItemPrice` の意味を勝手に変えない。注文履歴/会計確認との表示責務を明確に分ける。

## Impact Scope

- `src/components/CustomerBottomNav.jsx`
- `src/pages/order/CartPage.jsx`
- `src/components/order/CartHeader.jsx`
- `src/components/order/CartItemList.jsx`
- `src/pages/order/OrderCompletePage.jsx`
- `src/components/order/OrderStatusHeader.jsx`
- `src/components/order/OrderStatusList.jsx`
- `src/components/order/OrderTotalPanel.jsx`
- `src/lib/customerOrderStatus.js`
- `scripts/check-customer-cart.mjs`
- `scripts/check-customer-order-status.mjs`
- this MD

## Verification

- `npm run check:customer-cart`
- `npm run check:customer-order-status`
- `npm run check:customer-entry`
- `npm run check:order-command-ui`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result:
- Checks:
- Remaining risk:

