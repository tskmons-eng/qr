# Restaurant UX Round 4 - Parallel Work Index

## Purpose

飲食店の現場で使う頻度が高い画面を、注文データを壊さずに使いやすくする。
今回の対象はキッチン、スタッフ注文/会計、顧客QR、カテゴリー管理、人数分メニュー自動追加、メニューのタップ追加設定。

## User Priorities

- 既存の注文履歴、会計履歴、メニュー、カテゴリー、オプション、QR URL は削除・移行・破壊更新しない。
- 使っている人がいるため、各担当MD単体では本番deployしない。最終deployは `07-integration-release-gate.md` でまとめて判断する。
- ボタンや機能をただ増やさず、現場で押しやすく、後から見た目を直さなくてよい構造にする。
- スタッフ画面は、注文追加や会計確定などの下部操作へ無駄なドラッグなしで到達できることを重視する。
- 顧客画面は、カート、注文履歴、会計依頼の意味が他アプリと同じ感覚で分かる命名にする。
- 誤操作対策は、表示だけ戻すのではなく command 層を通してデータ上も安全に戻す。

## Parallel MDs

1. [01-kitchen-served-undo-density.md](01-kitchen-served-undo-density.md)
   - キッチンの提供済みUndoと表示密度調整。
2. [02-staff-order-checkout-scroll-layout.md](02-staff-order-checkout-scroll-layout.md)
   - スタッフ注文追加と会計画面の内容スクロール/固定操作バー。
3. [03-customer-cart-checkout-history-navigation.md](03-customer-cart-checkout-history-navigation.md)
   - 顧客QRのカート命名、価格表示、注文履歴、会計導線。
4. [04-admin-category-ios-zoom.md](04-admin-category-ios-zoom.md)
   - カテゴリー編集時のiOSズーム抑制。
5. [05-guest-auto-add-entry-visibility.md](05-guest-auto-add-entry-visibility.md)
   - 人数分メニュー自動追加の表示実装確認と不足時の補完。
6. [06-customer-menu-row-tap-add-setting.md](06-customer-menu-row-tap-add-setting.md)
   - 商品行タップで追加、設定でプラスボタン方式へ戻せる切替。
7. [07-integration-release-gate.md](07-integration-release-gate.md)
   - 全担当の統合、衝突確認、検証、deploy判断。

## Coordination Rules

- 01 と 02 はスタッフ/キッチン系CSSが近い。CSSファイルを分けるか、同じCSSを触る場合は最終統合で差分を確認する。
- 03 と 06 は顧客画面だが、03は下部ナビ/カート/注文履歴、06はメニュー商品行/設定を主担当にする。
- 05 は原則確認タスク。すでに実装済みならチェック強化とMD更新だけに留める。
- 07 以外は Firebase deploy をしない。必要な場合もMDに理由を書いて止める。

## Common Forbidden Changes

- `orders`, `orderItems`, `checks`, `products`, `categories`, `optionTemplates`, `tables`, `reservations` の削除や一括移行。
- QR URL を変える変更。
- Firestore rules / indexes / Functions のdeployを担当MD単体で行うこと。
- ブラウザ標準の `alert` / `prompt` を新規UIとして増やすこと。
- 表示だけ整えて実データの整合性を command 層から外すこと。

## Common Verification

- `git diff --check`
- 担当MDに書かれた個別チェック
- 07担当は `npm run check:restaurant-ux-release-gate`
- 影響がUIだけでも、関連する既存チェックを最低1つ実行する
- 実装結果、未解決リスク、deploy未実施であることを担当MDへ追記する
- コミットしてpushする
