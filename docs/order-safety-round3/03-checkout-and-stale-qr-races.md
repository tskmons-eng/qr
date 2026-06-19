# 03 Checkout And Stale QR Races

## 目的

会計、席リセット、古いQR画面、会計直後の遅延注文が重なっても、売上・履歴・席状態が壊れないようにする。

## 想定する実店舗ケース

- スタッフが会計を確定した直後に、お客様の古いカート画面から注文送信が遅れて届く。
- 会計済みの席を次のお客様が使い始める前に、前のお客様のスマホが古い画面で再送する。
- 会計中にスタッフが提供済み/キャンセル操作を行う。
- 会計ボタンをスタッフが二重クリックする。
- 席移動中にお客様が注文する。

## 現状確認

- Functions: `completeCheckoutCommand()`, `submitCustomerOrderItems()`, `moveTableOrderCommand()`
- Customer route guard: `src/pages/order/OrderEntryPage.jsx`
- Checkout UI: `src/pages/staff/CheckoutPage.jsx`
- Existing check: `scripts/check-order-functions-emulator.mjs` has late submit after checkout coverage.

## 担当範囲

- `scripts/check-order-functions-emulator.mjs`
- `scripts/check-order-concurrency.mjs`
- `src/pages/order/OrderEntryPage.jsx`
- `src/pages/order/CartPage.jsx`
- `src/pages/staff/CheckoutPage.jsx`
- 必要なら `functions/orderCommandHandlers.js`

## 実装方針

1. 会計確定と顧客 submit を `Promise.allSettled` で競合させる emulator check を追加する。
2. 合格パターンを明確にする:
   - submit が先に入った場合は、会計の集計対象になる。
   - checkout が先に閉じた場合は、submit は `order-not-open` 等で拒否され、古い注文として保存されない。
3. 会計二重実行は既存 check id を返すか、同一結果として扱う。
4. 会計後の古い `/menu` / `/cart` / `/complete` は `/guests` へ戻す既存ガードを再検証する。
5. 席移動と顧客 submit の競合で、order/table の不一致が破壊的に保存されないことを検証する。

## 合格条件

- 会計後の遅延注文が次のお客様の注文に混ざらない。
- 会計済み履歴が削除・上書きされない。
- 二重会計で `checks` が重複しない。
- 古いQR画面は、注文保存済みでない限り新しい注文開始へ誘導される。

## 検証コマンド

```bash
npm run check:order-functions-emulator
npm run check:customer-entry
npm run check:customer-cart
npm run check:checkout
npm run check
npm run build
```

## 完了時の報告

- 会計 vs 遅延 submit の結果: Functions の `completeCheckoutCommand()` が `orderItemsRevision`、非キャンセル明細ID、小計を検証するようにし、checkout が先なら late submit は `order-not-open`、submit が先なら stale checkout は `checkout-items-stale` で止まることを emulator で確認。
- 二重会計の結果: `check_{orderId}` に収束し、同一 order の二重 checkout 呼び出しは同じ check id を返して `checks` を重複作成しないことを emulator で確認。
- 古いQR画面の遷移: `OrderEntryPage` の `/menu` / `/cart` / `/complete` route guard が active order 不在時に `/guests` へ戻す構造を `check:order-concurrency` で固定。
- 席移動競合の扱い: Functions の `moveTableOrderCommand()` が transaction 内で対象 `orderItems` を読み直し、submit が先なら新規明細も移動先へ、move が先なら古い tableId submit を `order-scope-mismatch` で保存しないことを emulator で確認。
- 未解決リスク: 今回は Round3 の担当3対応のみ。担当MD単独の本番 deploy はしていない。

## 検証結果（2026-06-19）

```bash
npm run check:order-concurrency
npm run check:customer-entry
npm run check:customer-cart
npm run check:checkout
npm run check:order-functions-emulator
npm run check
npm run build
```
