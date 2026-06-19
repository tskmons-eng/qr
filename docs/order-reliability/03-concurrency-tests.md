# 03 Concurrency Tests

## 目的

混雑時、連打、通信遅延、再送、スタッフ同時操作で注文状態が壊れないことを検証する。

## 優先テスト

1. 同じ席に複数客が同時入店しても孤立 `orders` が増えない。
2. 同じ `clientRequestId` のカート送信が重複 `orderItems` を作らない。
3. スタッフ追加注文の二重押しで重複しない。
4. `ordered -> served` の連打で `pendingCount` が二重減算されない。
5. `served -> ordered` の連打で `pendingCount` が二重加算されない。
6. `ordered -> cancelled` だけ `pendingCount` が減り、既に `served` / `cancelled` の明細では減らない。
7. 会計中の遅延注文が reject されるか、一貫した扱いになる。
8. 席移動で `tables`, `orders.tableId`, `orderItems.tableId` が揃う。

## 作業ルール

- まず emulator / mock の検証を追加する。
- 本番データを使った負荷テストはしない。
- テスト追加だけで本番 deploy しない。

## 次の候補

- Firebase Emulator 用の command integration test を作る。
- 既存 `scripts/check-*` に、軽い静的境界チェックとロジックチェックを追加する。

## 検証

- `npm run check`
- 追加した emulator test
- `npx vite build`
