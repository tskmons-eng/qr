# 02 Data Preservation

## 目的

利用中店舗の履歴・注文・会計・メニューを消さずに、注文処理だけを安全に改善する。

## 保護対象

削除・一括移行・一括上書き禁止:

- `orders`
- `orderItems`
- `checks`
- `staffActions`
- `products`
- `categories`
- `optionTemplates`
- `tagTemplates`
- `tables`
- `reservations`

## 許可される変更

- 新しい code path を追加する。
- 新規フィールドを additive に追加する。
- 既存 collection を残したまま command 層に委譲する。
- 手動確認用・監査用の読み取りスクリプトを追加する。

## 禁止される変更

- 既存 Firestore データの削除。
- 勝手な migration 実行。
- 履歴 collection の掃除。
- メニュー collection の削除や再作成。
- 本番データへの一括 update。
- rules を急に締めて現行クライアントを壊す。

## 次の候補

- `orderItems` から `tables.pendingCount` / `pendingAggregate*` を監査する読み取り専用スクリプトを追加する。
- 監査結果だけを出し、修復 write は別指示があるまで実行しない。

## 実装済み

- `scripts/audit-pending-counts.mjs` を追加。
- `npm run audit:pending-counts` で `.firebaserc` の既定プロジェクトを対象に、読み取り専用で監査する。
- `npm run audit:pending-counts -- --store <storeId>` で店舗を絞り込める。
- `npm run audit:pending-counts -- --json` で機械確認用の JSON を出力できる。
- 監査は `orderItems` の `itemStatus == 'ordered'` を席ごとに再集計し、`pendingCount` と `pendingAggregate*` との差分、欠けた席参照、店舗不一致、空席に残った未提供明細を報告する。
- 本番 Firestore を読む場合は `GOOGLE_APPLICATION_CREDENTIALS` または gcloud の Application Default Credentials が必要。Emulator は `FIRESTORE_EMULATOR_HOST` を使う。
- 修復 write は含めない。データ修正が必要な場合は、監査結果を確認してから別タスクで扱う。

## 検証

- `git diff` に削除・migration・deploy が含まれていないこと。
- `rg -n "deleteDoc|batch.delete|deploy|migration" src scripts functions` を確認する。
- `npm run check`
- `npm run build`
