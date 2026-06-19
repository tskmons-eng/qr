# 08 Rules Lockdown

## 目的

注文 write を Functions command へ寄せた後、Firestore rules を段階的に締めて、ブラウザから任意の `orders` / `orderItems` を直接作れる状態を終わらせる。

## 前提

- 06 で Production の注文経路が Functions 本線になっていること。
- 07 で callable command の emulator 同時実行テストが通っていること。
- 11 の統合担当が Hosting / Functions / rules の deploy 順を管理すること。

## 担当範囲

- `firestore.rules`
- `scripts/check-functions-rules-migration.mjs`
- 必要なら新規 `scripts/check-order-rules-lockdown.mjs`
- `docs/order-reliability/11-integration-release.md` への rules deploy 注意点追記

## 段階方針

1. Compatibility stage
   - 既存公開クライアントが即死しない rules を維持する。
   - `orderCommandFailures` など観測用 collection の rules を整える。
   - Hosting を Functions runtime へ切り替える前に、rules だけ先に締めない。
   - `firestore.rules` の `legacyPublicOrderWritesAllowed()` と `legacyPublicTableOccupyAllowed()` は `true` のままにする。

2. Mainline stage
   - Functions command 経由の注文が Production で動いていることを確認する。
   - live logs と `orderCommandFailures` を確認し、旧 client write が残っていないか見る。
   - `orders` / `orderItems` への公開 create と、`tables` の公開 vacant-to-occupied update が不要になったことを確認する。

3. Lockdown stage
   - 新旧クライアント混在期間を置いた後、公開 `orders` / `orderItems` create/update を段階的に禁止する。
   - Staff/admin の必要な read 権限は壊さない。
   - Admin SDK 経由の Functions write は rules に依存しないため、Functions 内の権限チェックを前提にする。
   - `legacyPublicOrderWritesAllowed()` を `false` にして、公開 `orders` / `orderItems` create を閉じる。
   - `legacyPublicTableOccupyAllowed()` を `false` にして、旧QRクライアントの公開テーブル着席 update を閉じる。

## 2026-06-19 実装メモ

- 現行 deploy target の `firestore.rules` は Compatibility stage のまま維持。
- 公開注文 write の締め込み点を以下の helper に集約した。
  - `legacyPublicOrderWritesAllowed()`
  - `legacyPublicTableOccupyAllowed()`
  - `legacyPublicTableOccupyRequest()`
- 現在は `legacyPublicOrderWritesAllowed()` と `legacyPublicTableOccupyAllowed()` が `false`。
- Functions mainline、emulator concurrency、live monitoring を確認したため、この2つを `false` にする Lockdown stage へ進めた。
- `orders` / `orderItems` の `allow read: if true` は維持し、顧客・スタッフ・キッチン・会計表示の既存readを壊さない。
- `orders` / `orderItems` の staff/admin update/delete は `canAccess(resource.data.storeId)` のまま維持する。
- `checks`, `staffActions`, `orderCommandFailures` の read/create rules は既存の運用・観測に必要なため削らない。
- `scripts/check-order-rules-lockdown.mjs` を追加し、互換stageの維持、lockdown flip point、read権限維持、11のdeploy注意点を静的確認する。
- 本番 deploy は未実行。

## 2026-06-19 予約案内の残経路

- Lockdown 前の追加確認で、スタッフの予約待ち案内 `guideReservationToTable` がブラウザ側 transaction で `orders` を作る可能性を確認。
- `guideReservationToTableCommand` を追加し、Production では Functions command 経由にする。
- 既存UIの返却形 `{ ok, reason, orderId, wasOccupied }` は維持する。
- これにより公開 `orders` create を閉じても、予約待ちから空席へ案内する経路を維持できる。

## 11 統合担当への引き継ぎ

1. Functions deploy と Hosting deploy を先に完了する。
2. `orderCommandFailures`、Functions logs、`audit:pending-counts` を監視し、旧 client write が残っていないことを確認する。
3. Compatibility rules deploy では `legacyPublicOrderWritesAllowed()` / `legacyPublicTableOccupyAllowed()` を `true` のままにする。
4. Lockdown rules deploy でのみ両 helper を `false` にする。
5. 旧client影響が出た場合は helper を `true` に戻す rules rollback を行い、必要なら Hosting を `VITE_ORDER_COMMAND_RUNTIME=client` build に戻す。

## 完了条件

- rules の締め込み案が stage 別に分かれている。
- 旧 client が残る間に壊れる rules 変更が混ざっていない。
- rules 締め後に必要な customer/staff/admin read が残る。
- `npm run check:functions-rules-migration` と `npm run check:order-rules-lockdown` が通る。

## 禁止事項

- Hosting を Functions runtime に切り替える前に、公開注文 write を先に閉じない。
- read 権限を不用意に削って、スタッフ画面・キッチン・会計履歴を壊さない。
- データ削除や migration を rules 変更と同時に行わない。
- この分担単独で本番 deploy しない。

## 検証

- `npm run check:order-rules-lockdown`
- `npm run check:functions-rules-migration`
- `npm run check`
- `npm run build`

## 2026-06-19 検証結果

- `npm run check:order-rules-lockdown` passed.
- `npm run check:functions-rules-migration` passed.
- `npm run check:order-functions-mainline` passed.
- `npm run check` passed.
- `npm run build` passed.
- 現行 `firestore.rules` は Lockdown stage。
- 予約待ち案内を `guideReservationToTableCommand` へ移した後に適用する。
