# 07 Functions Emulator Concurrency

## 目的

Cloud Functions callable command を Firebase Emulator 上で同時実行検証する。  
in-memory mock だけではなく、Functions handler、Firestore transaction、idempotency、権限検証を通したテストを追加する。

## 担当範囲

- `scripts/check-order-concurrency.mjs`
- 新規 emulator integration script
- `package.json` check script
- `functions/orderCommandHandlers.js`
- `functions/orderCommandAuth.js`
- 必要な emulator seed / fixture

## 優先テスト

1. 同じ席に複数顧客が同時入店しても、孤立 `orders` が増えない。
2. 同じ `clientRequestId` の顧客カート送信が重複 `orderItems` を作らない。
3. スタッフ追加注文の二重送信が重複 `orderItems` と二重 `pendingCount` を作らない。
4. `ordered -> served` の連打で `pendingCount` が二重減算されない。
5. `served -> ordered` の連打で `pendingCount` が二重加算されない。
6. `ordered -> cancelled` のみ `pendingCount` が減り、`served` / `cancelled` では減らない。
7. 会計中または会計後の遅延注文が一貫して reject される。
8. 席移動で `tables`, `orders.tableId`, `orderItems.tableId` が揃う。
9. 権限のない staff command が Functions 内で reject される。
10. product/category の store 不一致が reject される。

## 実装方針

- 本番 Firestore には接続しない。
- `firebase emulators:exec` か同等の local emulator 実行で完結させる。
- seed data は test 専用にし、既存 production data を必要としない。
- エラー時はどの command / requestId / tableId で失敗したか分かる出力にする。
- 既存 `npm run check` に重すぎる場合は、通常 check と別に `npm run check:order-functions-emulator` を追加し、11 の統合担当が必ず実行する。

## 完了条件

- Emulator 上で callable Functions を呼ぶテストが追加される。
- 上記の優先テストが自動で確認される。
- `npm run check:order-concurrency` は既存 mock のまま通る。
- 新規 emulator check の実行コマンドと所要時間をこのMDまたは `plan.MD` に追記する。

## 禁止事項

- 本番データで負荷テストしない。
- 本番 deploy しない。
- テストのために production の `orders`, `orderItems`, `tables`, `products`, `categories` を書き換えない。
