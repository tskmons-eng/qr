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

## 2026-06-19 実装メモ

追加:

- `scripts/check-order-functions-emulator.mjs`
  - 外側で `firebase emulators:exec --project demo-qr-functions-concurrency --only firestore,functions,auth` を起動。
  - 内側で test-only seed data を emulator Firestore に作成。
  - Firebase client SDK から callable Functions を呼び、Functions handler と Firestore transaction を通した状態を検証。
- `npm run check:order-functions-emulator`
  - 重い integration check のため、通常の `npm run check` には直接入れない。
  - 11 の統合担当が deploy 前ゲートとして明示実行する。
- `functions/orderCommandHandlers.js`
  - product が同一 store でも、参照 category が別 store の場合は `category-scope-mismatch` で reject。
- `functions/orderCommandApi.js`
  - `category-scope-mismatch` を callable error details へ渡す。
- `scripts/check-functions-rules-migration.mjs`
  - emulator check コマンド登録と category scope validation を静的確認。

検証範囲:

1. 同じ席に複数顧客が同時入店しても、`orders` が1件だけになる。
2. 同じ `clientRequestId` の顧客カート送信で `orderItems` が重複しない。
3. 同じ `clientRequestId` のスタッフ注文で `orderItems` と `pendingCount` が重複しない。
4. `ordered -> served` の同時操作で `pendingCount` が二重減算されない。
5. `served -> ordered` の同時操作で `pendingCount` が二重加算されない。
6. `ordered -> cancelled` の同時操作だけ `pendingCount` を減らし、`served -> cancelled` では減らない。
7. checkout 後の遅延 submit が `order-not-open` で reject される。
8. 席移動後に `tables`, `orders.tableId`, `orderItems.tableId`, `pendingCount` が揃う。
9. staff session のない匿名 staff command が `permission-denied` で reject される。
10. product store mismatch と category store mismatch が reject される。

実行コマンド:

```bash
npm run check:order-functions-emulator
```

実行結果:

- 2026-06-19 に `npm run check:order-functions-emulator` 通過。
- 追加確認として `npm run check:functions-rules-migration`, `npm run check:order-concurrency`, `npm run check`, `npm run build` も通過。
- local Firebase emulator は Java 21 以上が必要。スクリプトは Windows で `JAVA_HOME` と代表的な JDK install path を探し、Java 21 以上を優先して emulator の `PATH` に追加する。
- 初回検証時に `functions/node_modules` の一部が OneDrive reparse point になっていて Functions emulator が読めなかったため、`functions` 配下の依存のみ再インストールした。
- 本番 deploy は実行していない。

注意:

- demo project と emulator のみを使う。`.firebaserc` の本番既定プロジェクトには接続しない。
- 初回実行時は `npx firebase-tools` の取得で時間がかかる場合がある。
- 本番 deploy はこの分担では実行しない。
