# 04 Functions And Rules Migration

> Status: Round 1 の準備MD。Callable Functions と opt-in runtime の追加は完了済み。
> Round 2 では [06-functions-mainline.md](06-functions-mainline.md) から [11-integration-release.md](11-integration-release.md) を優先し、Production の注文経路を Functions 本線にする。

## 目的

最終的にブラウザから Firestore へ直接複数 write する構造をやめ、Cloud Functions command 経由へ移す。

Round 1 では deploy と rules 締め込みを禁止していた。これは本番データ保護のためであり、改善完了を意味しない。注文が入らない・反映されない問題を止めるには、Round 2 で Functions command を Production の通常経路にする。

## 現在の前提

- client-side command/transaction は完了。
- Callable Functions command は追加済み。
- 現在の Production 既定経路はまだ client transaction のまま。
- 既存UIと既存データを保ったまま、Round 2 で Functions を本線化する。

## Round 1 移行順

1. Callable/HTTPS Functions に command API を追加する。
2. client-side command と同じ入力/返却形に揃える。
3. UIは同じ wrapper を呼び続け、内部だけ Functions 呼び出しへ差し替える。
4. emulator で同時操作テストを通す。
5. 新旧クライアントが混在しても壊れない期間を置く。
6. 最後に Firestore rules を段階的に締める。

## Round 1 禁止事項

- Functions deploy を勝手に行わない。
- rules を先に締めない。
- `orders create: true` / `orderItems create: true` を現行クライアント対応前に削らない。
- データ migration を同時に混ぜない。

Round 2 では [11-integration-release.md](11-integration-release.md) の統合担当だけが、06〜10 の検証完了後に deploy 順と rollback を確認して実施する。

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

1. [06-functions-mainline.md](06-functions-mainline.md) で Production 注文経路を Functions 本線にする。
2. [07-functions-emulator-concurrency.md](07-functions-emulator-concurrency.md) で callable command の同時操作テストを追加する。
3. [08-rules-lockdown.md](08-rules-lockdown.md) で新旧クライアント混在期間を前提に rules を段階化する。
4. [09-live-observability.md](09-live-observability.md) で Functions 側の失敗観測と調査導線を整える。
5. [10-data-consistency-repair.md](10-data-consistency-repair.md) で監査/修復を dry-run first で準備する。
6. [11-integration-release.md](11-integration-release.md) で deploy と rollback を統合する。
