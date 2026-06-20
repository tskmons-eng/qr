# 04 Owner Admin Email Transfer

## Purpose

`/owner` で、既存店舗のデータを引き継いだまま管理者メール名義を変更できる状態を固定する。
メール変更で新しい店舗を作ったり、注文・会計・商品データを移動したりしない。

## Current Confirmation

- `src/components/owner/OwnerStoreDashboard.jsx` には店舗ごとの `管理者メール` 入力と保存ボタンがある。
- `src/services/ownerDashboardService.js` の `updateStoreAdminEmail()` は `storeAdminEmails/{email}` と `stores/{storeId}.ownerEmail` を batch で更新している。
- 既存メールがある場合、別メールへ変更すると古い `storeAdminEmails/{currentEmail}` を削除する。
- 同じメールが別店舗に割り当て済みなら `このメールアドレスは別の店舗に割り当て済みです` で止める。
- `src/contexts/StoreContext.jsx` は Googleログイン時に `storeAdminEmails/{normalizedEmail}` を見て既存 `storeId` に入る。
- Firestore rules は `storeAdminEmails` を `isSuper()` 書き込みに限定し、`isStoreAdminEmail(storeId)` で既存店舗へのアクセスを許可している。

## Change Plan

- 既存実装を前提に、UI文言を `管理者メール` からデータ引き継ぎが分かる `名義メール` / `管理者メール` 表現へ整える。
- メール変更時も `storeId` はそのまま、`stores/{storeId}` 配下の注文・会計・商品・席・スタッフは一切移動しないことをチェックで固定する。
- 保存前後で旧メール割当の削除、新メール割当の作成、`stores.ownerEmail` 更新が同じ batch で行われることを検査する。
- `/owner` の店舗一覧で、保存中、エラー、保存後の再読み込みが分かる状態を維持する。
- 店舗名編集担当の03と同じ行UIを触る場合は、列幅・モバイル表示・保存ボタンの並びを05で統合確認する。

## Impact Scope

- `src/components/owner/OwnerStoreDashboard.jsx`
- `src/services/ownerDashboardService.js`
- `src/lib/ownerDashboard.js`
- `src/contexts/StoreContext.jsx`
- `src/services/authSessionService.js`
- `firestore.rules`
- `scripts/check-store-admin-assignment.mjs`
- `scripts/check-owner-dashboard.mjs`
- this MD

## Forbidden Changes

- メール変更に合わせて `storeId` を新メールのUIDへ変えない。
- `orders`, `orderItems`, `checks`, `tables`, `products`, `categories`, `staffMembers` をコピー・削除・移行しない。
- 通常の店舗管理者自身に `/owner` の全店舗名義変更権限を渡さない。
- `allowedEmails` と `storeAdminEmails` の用途を混ぜない。

## Verification

- `npm run check:store-admin-assignment`
- `npm run check:owner-dashboard`
- `npm run check:owner-access`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result: `/owner` 店舗一覧の管理者メール列を、既存店舗データを引き継ぐ `名義メール` 表現へ整理した。保存処理は既存の `storeId` を維持し、`storeAdminEmails/{email}` と `stores/{storeId}.ownerEmail` の batch 更新を使う前提をチェックで固定した。
- Checks: `git diff --check`, `npm run check:store-admin-assignment`, `npm run check:owner-dashboard`, `npm run check:owner-access`, `npm run check`, and `npm run build` passed.
- Remaining risk: 01〜03との最終UI衝突確認と Production deploy 判断は `05-integration-release-gate.md` で行う。
