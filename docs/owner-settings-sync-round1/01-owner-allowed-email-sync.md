# 01 Owner Allowed Email Sync

## Purpose

`/owner` の許可メール一覧と、管理画面の `管理者・キッチン アクセス許可` が同じ状態として見えるようにする。
スーパー管理者がどちらの画面で追加・削除しても、同じ `allowedEmails` を壊さず同期する。

## Current Confirmation

- `/owner` は `src/services/ownerAccessService.js` の `subscribeOwnerAllowedEmails()` で `allowedEmails` をリアルタイム購読している。
- 管理画面は `src/pages/admin/SettingsPage.jsx` から `loadAllowedEmails()`, `addAllowedEmail()`, `removeAllowedEmail()` を呼ぶ。
- `settingsService.addAllowedEmail()` は `{ addedAt }` だけを書き込むため、`ownerAccessService.addOwnerAllowedEmail()` の `{ email, addedAt, addedBy }` と形がそろっていない。
- Firestore rules の `allowedEmails/{email}` は `isSuper()` のみ書き込み可能で、通常の店舗管理者権限とは分離されている。

## Change Plan

- `allowedEmails` の読み書きは共通ヘルパーに寄せ、`/owner` と管理画面で同じドキュメント形状を使う。
- 管理画面側も `/owner` と同じように更新が反映される読み方にする。最低でも保存後の再読み込み、可能なら購読にそろえる。
- 既存の `allowedEmails/{email}` ドキュメントIDは変えない。メール正規化、重複判定、表示順は `src/lib/ownerAccess.js` の既存ルールを使う。
- `allowedEmails` は「Googleログイン許可リスト」、`storeAdminEmails` は「店舗に紐づく管理者メール」として責務を分けたままにする。

## Impact Scope

- `src/services/ownerAccessService.js`
- `src/services/settingsService.js`
- `src/pages/admin/SettingsPage.jsx`
- `src/components/admin/AllowedEmailSettings.jsx`
- `src/lib/ownerAccess.js`
- `src/lib/settingsConfig.js`
- `scripts/check-owner-access.mjs`
- `scripts/check-settings-config.mjs`
- `scripts/check-settings.mjs`
- this MD

## Forbidden Changes

- `storeAdminEmails` を許可メールリストの代わりに使わない。
- 通常の店舗管理者やスタッフに `allowedEmails` の書き込み権限を渡さない。
- 既存の許可メールを一括削除・作り直ししない。

## Verification

- `npm run check:owner-access`
- `npm run check:settings`
- `npm run check:settings-config`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result:
- Checks:
- Remaining risk:
