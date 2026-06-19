# 01 Customer Session Race

## 目的

同じ席のQRコードを複数人が同時に開き、ほぼ同時に「注文を始める」を押しても、注文セッションが1つにまとまり、孤立した `orders` や席状態の不整合が出ないことを保証する。

## 想定する実店舗ケース

- 4人席で全員がQRを読み取り、2人以上が同時に人数入力から開始する。
- 先に開いた人の画面が遅く、後から開いた人が先に開始する。
- 一度読み込んだQR画面を開きっぱなしにしたまま、別の人が先に注文を始める。
- 自動追加メニューが有効な店舗で、同時開始により人数分メニューが重複登録される。

## 現状確認

- Functions: `functions/orderCommandHandlers.js` の `startCustomerOrderSession()`
- Client: `src/pages/order/GuestCountPage.jsx`
- Context: `src/pages/order/OrderEntryPage.jsx`, `src/contexts/OrderContext.jsx`
- Existing check: `scripts/check-order-functions-emulator.mjs`

現状は transaction 内で `tables/{tableId}.currentOrderId` を確認し、既にある場合は既存 orderId を返す。ここを実店舗ケースとしてさらに固める。

## 担当範囲

- `scripts/check-order-functions-emulator.mjs`
- 必要なら `functions/orderCommandHandlers.js`
- 必要なら `src/pages/order/GuestCountPage.jsx`
- 必要なら `src/lib/customerEntry.js`

## 実装方針

1. Emulator check に「同じ tableId で 30〜50 端末相当が同時に `startCustomerOrderSessionCommand` を呼ぶ」ケースを追加する。
2. 返却された orderId が全て同じであることを検証する。
3. `orders` の open order が1件だけであることを検証する。
4. `tables.currentOrderId`、`tables.status`、`tables.guestCount` がその1件と一致することを検証する。
5. 自動追加メニュー有効時、auto-add の `orderItems` が1回分だけ作られることを検証する。
6. 既存 orderId を返された2台目以降の画面が、エラーではなくメニューへ進めることをソースチェックまたはコンポーネントテスト相当で確認する。

## 実装内容

- `scripts/check-order-functions-emulator.mjs` の customer start race を 50 並列に拡張した。
- 同時開始ケースは `guestAutoAdd.enabled: true` で実行し、auto-add 明細が1件だけ作られることを検証する。
- 返却 orderId、`orders` 件数、`orders.status`、`tables.currentOrderId`、`tables.status`、`tables.guestCount`、`tables.pendingCount`、auto-add 明細の `quantity` / `clientRequestId` を確認する。
- 初回の50並列 emulator 実行で、Firestore transaction の競合により `ABORTED` / code `10` 相当の失敗が発生した。
- `functions/orderCommandHandlers.js` の `startCustomerOrderSession()` に、同時開始の transaction 競合時だけ既存 `tables.currentOrderId` を読み直して返すリトライを追加した。
- `scripts/check-customer-entry.mjs` に、`GuestCountPage` が返却 orderId を `setOrderId()` して既存の `/menu` 導線へ進むことのソースチェックを追加した。

## 合格条件

- 同時開始で孤立 `orders` が作られない。
- auto-add が人数分を超えて重複しない。
- 競合した端末も既存 `orderId` を受け取り、顧客画面は注文開始済みとして進める。
- `table-not-vacant` を通常の同時開始成功ケースで出さない。

## 検証コマンド

```bash
npm run check:order-functions-emulator
npm run check:customer-entry
npm run check
npm run build
```

## 検証結果

- `node --check functions/orderCommandHandlers.js` passed.
- `npm run check:customer-entry` passed.
- 初回の `npm run check:order-functions-emulator` は、50並列の同時開始で transaction contention が表面化し、`ABORTED` / code `10` 相当の失敗を再現した。
- Functions側へ同時開始リトライを追加後、`npm run check:order-functions-emulator` passed.
- `npm run check` passed.
- `npm run build` passed.
- Firebase deploy は実行していない。

## 完了時の報告

- 追加した同時開始シナリオ: 同一 `tableId` へ 50 並列で `startCustomerOrderSessionCommand` を呼び出す emulator ケースを追加。
- auto-add 重複確認: 有効化した auto-add 明細が1件だけ作られ、数量が `guestCount` と一致することを確認。
- 孤立 `orders` 確認: `orders` は対象 `tableId` で1件のみ、全返却 orderId と `tables.currentOrderId` が一致することを確認。
- UI側の受け止め確認: `GuestCountPage` が返却 orderId を成功として保存し、エラー表示ではなく `../menu` へ進むことをソースチェックで確認。
- 未解決リスク: emulator 起動直後に前回プロセスのポート残りがあると再実行に失敗するため、検証時は残 emulator プロセスを停止してから実行する。
