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
