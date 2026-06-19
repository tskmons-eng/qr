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

## 2026-06-20 実装結果

- 担当: Codex
- 状態: 実装済み
- 変更対象:
  - `src/pages/order/CartPage.jsx`
  - `scripts/check-customer-cart.mjs`
  - `scripts/check-order-concurrency.mjs`
  - `scripts/check-order-functions-emulator.mjs`

### 同一 request id の重複防止結果

- Mock concurrency check で、同じ `clientRequestId` の顧客注文再送を20回投げても、作成される `orderItems` は1回分だけになることを検証。
- Functions emulator check にも、同じ `clientRequestId` の顧客注文submitを20回同時実行し、同じ request id のまま `deduped` retry が返り、`orderItems` が1回分だけになるassertionを追加。

### 別 request id の同時注文結果

- 同じ席・同じ `orderId` でも、5つの別 `clientRequestId` は別注文として扱い、それぞれ `orderItems` を作成するassertionを追加。
- 同じ商品を別端末から同時に注文するケースは、重複排除せず人数分の注文として残す。

### タイムアウト/再試行の扱い

- 同じ `clientRequestId` で再送した場合、Functions側は既存の先頭item docを見て `deduped: true` を返し、追加の明細を作らない。
- `CartPage` は成功前に `submitRequestIdRef` を破棄せず、retryable error では同じ内容の再送が二重登録にならないことをお客様向けに表示する。
- failure log metadata に `clientRequestId` と `retryable` を含め、保存済み/再送確認が必要な失敗を追跡しやすくした。

### 検証結果

- `npm run check:customer-cart` passed.
- `npm run check:order-concurrency` passed.
- `npm run check:customer-order-status` passed.
- `npm run check` passed in the active worktree.
- `npm run build` passed in the active worktree.
- `npm run check:order-functions-emulator` は、追加した顧客submit冪等性assertionを通過した後、既存の `guideReservationToTableCommand` 付近で Functions emulator timeout になり、コマンド全体は未完了。

### 未解決リスク

- Functions emulator の全体コマンドは、注文submitではなく後続の予約案内テストでtimeoutすることがあるため、`06-load-release-gate` 側でemulator安定性を再確認する。
- 本番deployはこの担当では実行しない。
