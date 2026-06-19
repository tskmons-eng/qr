# 04 Functions And Rules Migration

## 目的

最終的にブラウザから Firestore へ直接複数 write する構造をやめ、Cloud Functions command 経由へ移す。

## 現在の前提

- いまは client-side command/transaction まで完了。
- 既存 Firestore rules はすぐ締めない。
- 既存UIと既存データを保ったまま、次段階で Functions 化する。

## 移行順

1. Callable/HTTPS Functions に command API を追加する。
2. client-side command と同じ入力/返却形に揃える。
3. UIは同じ wrapper を呼び続け、内部だけ Functions 呼び出しへ差し替える。
4. emulator で同時操作テストを通す。
5. 新旧クライアントが混在しても壊れない期間を置く。
6. 最後に Firestore rules を段階的に締める。

## 禁止事項

- Functions deploy を勝手に行わない。
- rules を先に締めない。
- `orders create: true` / `orderItems create: true` を現行クライアント対応前に削らない。
- データ migration を同時に混ぜない。

## 検証

- Emulator Functions test
- Firestore rules test
- `npm run check`
- `npx vite build`
- 明示許可後の staging / production deploy 確認

## 2026-06-19 実装メモ

追加済み:

- `functions/orderCommandHandlers.js`
  - 既存 client-side command と同じ単位の callable handler を追加。
  - `startCustomerOrderSessionCommand`
  - `submitCustomerOrderItemsCommand`
  - `submitStaffOrderItemsCommand`
  - `seatStaffOrderSessionCommand`
  - `completeCheckoutCommand`
  - `markOrderItemServedCommand`
  - `markOrderItemsServedCommand`
  - `markOrderItemOrderedCommand`
  - `cancelOrderItemCommand`
  - `moveTableOrderCommand`
- `functions/orderCommandAuth.js`
  - Admin SDK が rules を迂回するため、スタッフ系 command の `canAccess(storeId)` 相当を Functions 内に追加。
- `functions/orderCommandApi.js`
  - command error code を callable error details に載せる。
- `src/services/orderFunctionCommandService.js`
  - `VITE_ORDER_COMMAND_RUNTIME=functions` のときだけ callable を使う opt-in 切替。
  - 未設定または `client` では従来の client transaction command を使う。
- `functions/package.json` / `functions/package-lock.json`
  - `firebase.json` の `nodejs20` と一致するよう Node engine を `20` に変更。
- `scripts/check-functions-rules-migration.mjs`
  - callable export、opt-in runtime、rules 互換、Functions runtime 整合を静的確認。

未実施:

- Functions deploy。
- Firestore rules 締め込み。
- 既存 Firestore データの migration / delete / repair write。

次にやること:

1. Emulator で callable command の同時操作テストを追加する。
2. staging で `VITE_ORDER_COMMAND_RUNTIME=functions` を明示して UI wrapper 経由の動作を確認する。
3. 新旧クライアント混在期間を置く。
4. `orders` / `orderItems` の公開 create rule を段階的に締める。
