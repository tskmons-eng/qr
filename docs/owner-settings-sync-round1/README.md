# Owner Settings Sync Round 1 - Parallel Work Index

## Purpose

スーパー管理者、店舗オーナー、スタッフ設定の境界を壊さず、店舗名・許可メール・管理者メール名義を同期して扱える状態にする。
同時に、注文パネル上のフード/ドリンク表示は文字ラベルを増やさず、枠色などの省スペースな見分け方へ整理する。

## Current Confirmation

- `/owner` の許可メールは `src/services/ownerAccessService.js` が `allowedEmails` を購読している。
- 管理画面の `管理者・キッチン アクセス許可` は `src/services/settingsService.js` から同じ `allowedEmails` を読み書きしているが、読み込みは一回だけで、保存するドキュメント形状も `/owner` 側と完全にはそろっていない。
- `/owner` の店舗一覧には `src/components/owner/OwnerStoreDashboard.jsx` 経由で管理者メール変更UIがあり、`src/services/ownerDashboardService.js` が `storeAdminEmails/{email}` と `stores/{storeId}.ownerEmail` を更新している。
- `src/contexts/StoreContext.jsx` は新規店舗作成時に `stores/{storeId}.storeName` を作る。`src/lib/ownerDashboard.js` は同じ `storeName` を読んでいる。
- 管理画面の `src/components/admin/StoreCodeCard.jsx` は現在、店舗コードだけを表示している。
- 顧客カテゴリタブ `src/components/order/CustomerCategoryTabs.jsx` は各カテゴリに `ドリンク` / `フード` の文字バッジを表示している。

## User Priorities

- ユーザー様は、追加した機能をすべて表に出すより、無駄のないUIで処理できることを重視している。
- フード/ドリンクの見分け方は、各項目に `ドリンク` / `フード` と文字を付けるのではなく、枠色や控えめな視覚差で処理する。
- 店舗名は店舗コード設定の上に表示し、設定画面内でも管理者・キッチンアクセス許可の近くで管理できるようにする。
- `/owner` では既存データを引き継いだまま、管理者メール名義を変更できる必要がある。

## Parallel MDs

1. [01-owner-allowed-email-sync.md](01-owner-allowed-email-sync.md)
   - `/owner` の許可メールと管理画面の `管理者・キッチン アクセス許可` を同じデータ形状・同期方式へそろえる。
2. [02-order-category-visual-treatment.md](02-order-category-visual-treatment.md)
   - 注文パネルのフード/ドリンク表示を、文字ラベルの重複ではなく省スペースな色・枠で表現する。
3. [03-store-name-settings-sync.md](03-store-name-settings-sync.md)
   - 店舗コード上の店舗名表示と、管理画面/owner側の店舗名設定を同じ `stores/{storeId}.storeName` に同期する。
4. [04-owner-admin-email-transfer.md](04-owner-admin-email-transfer.md)
   - `/owner` で既存データを保持したまま管理者メール名義を変更できることを固定する。
5. [05-integration-release-gate.md](05-integration-release-gate.md)
   - 01〜04の衝突確認、検証、deploy判断をまとめる。

## Coordination Rules

- 01 と 04 はどちらも `/owner` と管理者メール周辺に触る。01は `allowedEmails`、04は `storeAdminEmails` と `stores.ownerEmail` を主担当にする。
- 03 と 04 は `OwnerStoreDashboard` を触る可能性がある。03は店舗名列/編集、04は管理者メール列/名義変更に限定し、同じ行UIの最終調整は05で見る。
- 02 は表示整理だけを担当し、注文送信、注文履歴、会計、カテゴリデータ構造は変えない。
- 各担当MD単体では Firebase deploy をしない。deploy可否は05でまとめて判断する。

## Common Forbidden Changes

- `orders`, `orderItems`, `checks`, `tables`, `products`, `categories`, `staffMembers` の削除、移行、ID変更。
- 店舗の `storeId` をメール変更に合わせて作り直すこと。
- `allowedEmails` と `storeAdminEmails` の責務を混ぜること。
- ブラウザ標準の `alert` / `prompt` を新規UIとして増やすこと。
- 表示目的だけで Firestore rules の権限境界を広げること。

## Common Verification

- `git diff --check`
- `npm run check:owner-access`
- `npm run check:owner-dashboard`
- `npm run check:store-admin-assignment`
- `npm run check:settings`
- `npm run check:customer-cart`
- `npm run check`
- `npm run build`
