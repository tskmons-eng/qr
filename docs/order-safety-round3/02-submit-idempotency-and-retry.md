# 02 Submit Idempotency And Retry

## 目的

お客様が同じ席で複数端末から同時に注文しても、また同じ端末で連打・タイムアウト後再試行しても、注文が消えたり二重登録されたりしない状態にする。

## 想定する実店舗ケース

- 同じ席の2〜5人がそれぞれ自分のスマホで同時に注文する。
- 1人が注文ボタンを連打する。
- 注文送信中に通信が遅く、画面上は失敗に見えるが Functions 側では保存済み。
- ブラウザを戻る、再読み込み、再送する。
- 同じ商品を別端末から同時に注文する。これは重複ではなく別注文として入る必要がある。

## 現状確認

- Functions: `submitCustomerOrderItems()` は `clientRequestId` と index から `orderItems` doc id を作る。
- Client: `src/pages/order/CartPage.jsx` は送信中に `submitRequestIdRef` を保持し、成功まで同じ request id を使う。
- Existing checks: `scripts/check-order-functions-emulator.mjs`, `scripts/check-order-concurrency.mjs`

## 担当範囲

- `scripts/check-order-functions-emulator.mjs`
- `scripts/check-order-concurrency.mjs`
- `src/pages/order/CartPage.jsx`
- `src/services/customerCartService.js`
- `src/services/orderCommandService.js`
- 必要なら `functions/orderCommandHandlers.js`

## 実装方針

1. 同じ `clientRequestId` の同時 submit を 20 回以上投げ、`orderItems` が1回分だけ作成されることを検証する。
2. 別々の `clientRequestId` の同時 submit は、人数分それぞれ注文として入ることを検証する。
3. 送信タイムアウトを模したケースで、同じ `clientRequestId` を再送すると dedupe されることを検証する。
4. 成功後に cart が消え、`OrderCompletePage` が該当 `clientRequestId` の反映を確認できることを検証する。
5. 失敗表示が出る場合、未保存エラーと保存済み/反映待ちを区別できるようにする。

## 合格条件

- 同じ端末の連打・再送で二重注文にならない。
- 別端末の同時注文は正しく複数注文として入る。
- `clientRequestId` が成功前に失われない。
- 保存済みなのに「注文できませんでした」と表示する状態を避ける。

## 検証コマンド

```bash
npm run check:order-functions-emulator
npm run check:order-concurrency
npm run check:customer-cart
npm run check:customer-order-status
npm run check
npm run build
```

## 完了時の報告

- 同一 request id の重複防止結果:
- 別 request id の同時注文結果:
- タイムアウト/再試行の扱い:
- 顧客画面の表示:
- 未解決リスク:

