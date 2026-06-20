# 05 Integration Release Gate

## Purpose

01〜04の変更を統合し、許可メール、店舗名、管理者メール名義、フード/ドリンク表示の衝突を確認してからdeploy可否を判断する。

## Gate Inputs

- [01-owner-allowed-email-sync.md](01-owner-allowed-email-sync.md) の Completion Notes
- [02-order-category-visual-treatment.md](02-order-category-visual-treatment.md) の Completion Notes
- [03-store-name-settings-sync.md](03-store-name-settings-sync.md) の Completion Notes
- [04-owner-admin-email-transfer.md](04-owner-admin-email-transfer.md) の Completion Notes
- `plan.MD` の該当セクション

## Integration Checks

- `allowedEmails` と `storeAdminEmails` の責務が分かれたままになっていること。
- `/owner` と管理画面の許可メール表示が同じ状態を見ていること。
- 店舗名変更が `stores/{storeId}.storeName` に集約され、店舗コードや `storeId` を変えていないこと。
- 管理者メール名義変更が既存データを保持し、旧メール割当削除と新メール割当作成を同じ保存単位で行うこと。
- フード/ドリンク表示が文字ラベルの重複ではなく、枠色などの省スペースな視覚差になっていること。
- 03と04が同じ `/owner` 店舗テーブルを触った場合、列幅・入力幅・保存ボタン・モバイル横スクロールが破綻していないこと。

## Final Verification

- `git diff --check`
- `npm run check:owner-access`
- `npm run check:owner-dashboard`
- `npm run check:store-admin-assignment`
- `npm run check:settings`
- `npm run check:customer-cart`
- `npm run check`
- `npm run build`

## Deploy Decision

- 各担当MDでは Firebase deploy をしない。
- UIのみの変更なら Hosting deploy を候補にする。
- Firestore rules を変えた場合は、差分と検証結果を明記して rules deploy を別途判断する。
- Functions 差分がない限り Functions はdeployしない。
- deploy後は Hosting asset hash、主要ルートHTTP 200、必要なら `functions:list` を確認する。

## Completion Notes

- Final gate status:
- Checks:
- Firebase deploy:
- Live verification:
- Remaining risk:
