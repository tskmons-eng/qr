# 10 Data Consistency Repair

## 目的

既存履歴・メニューを消さずに、注文反映ズレを監査し、必要な修復を dry-run first で安全に実行できる状態を作る。

## 守るもの

- `orders`
- `orderItems`
- `checks`
- `staffActions`
- `products`
- `categories`
- `optionTemplates`
- `tagTemplates`
- `reservations`

上記は削除・再作成・一括上書きしない。

## 担当範囲

- `scripts/audit-pending-counts.mjs`
- 必要なら新規 `scripts/repair-pending-counts.mjs`
- 必要なら新規 `scripts/audit-open-order-consistency.mjs`
- `package.json` scripts
- `docs/order-reliability/02-data-preservation.md`

## 実装方針

- 監査は read-only を既定にする。
- 修復 script を作る場合も dry-run を既定にし、`--apply` なしでは write しない。
- `--store <storeId>` 必須など、誤爆しにくい制約を入れる。
- 修復前に対象件数と変更予定を JSON/ログに出す。
- 修復可能な対象は、`orderItems` から再計算できる derived state に限定する。
  - `tables.pendingCount`
  - `tables.pendingAggregateCount`
  - `tables.pendingAggregateDrinkCount`
  - `tables.pendingAggregateFoodCount`
- 孤立 open order など履歴判断が必要なものは、自動削除せず report に留める。

## 完了条件

- live/prod に対しても read-only 監査を安全に実行できる。
- 修復 script がある場合、dry-run と `--apply` の差が明確である。
- 修復対象が derived state に限定されている。
- メニュー、注文履歴、会計履歴を消す処理がないことを確認できる。
- 11 の統合担当へ、deploy 前後に実行する監査コマンドを渡せる。

## 禁止事項

- `orders`, `orderItems`, `checks`, `products`, `categories` の delete。
- store 全体への無条件一括 update。
- 監査なしの repair write。
- 本番データ修復をこの分担単独で実行すること。

## 2026-06-19 実装メモ

- `scripts/lib/pending-count-audit.mjs` に pending count 監査/修復計画の共通ロジックを分離。
- `scripts/audit-pending-counts.mjs` は共通ロジックを使う read-only CLI として維持。
- `scripts/repair-pending-counts.mjs` を追加。
- 修復 script は dry-run が既定で、`--apply` なしでは write しない。
- `npm run repair:pending-counts -- --store <storeId>` は dry-run が既定で、変更予定だけを表示する。
- `npm run repair:pending-counts -- --store <storeId> --json` は dry-run の修復計画を JSON で出す。
- `npm run repair:pending-counts -- --store <storeId> --apply` のときだけ Firestore write を実行する。
- `--store <storeId>` を必須にし、全店舗への無条件 repair を防ぐ。
- repair write は `tables/{tableId}` の derived state だけに限定する。
  - `pendingCount`
  - `pendingAggregateVersion`
  - `pendingAggregateCount`
  - `pendingAggregateDrinkCount`
  - `pendingAggregateFoodCount`
- `orderItems` の欠けた `tableId`、存在しない席参照、店舗不一致などは report-only とし、自動削除・移動・履歴修正はしない。

## 11 統合担当へ渡すコマンド

- deploy 前 read-only 監査:
  - `npm run audit:pending-counts -- --store <storeId>`
  - `npm run audit:pending-counts -- --store <storeId> --json`
- 修復が必要な場合の dry-run:
  - `npm run repair:pending-counts -- --store <storeId>`
  - `npm run repair:pending-counts -- --store <storeId> --json`
- 統合担当が監査結果を確認してから実行する apply:
  - `npm run repair:pending-counts -- --store <storeId> --apply`
