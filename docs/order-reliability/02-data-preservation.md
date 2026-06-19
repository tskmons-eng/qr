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

## 検証

- `git diff` に削除・migration・deploy が含まれていないこと。
- `rg -n "deleteDoc|batch.delete|deploy|migration" src scripts functions` を確認する。
- `npm run check`
