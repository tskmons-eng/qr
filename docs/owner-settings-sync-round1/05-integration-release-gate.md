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

## Gate Tooling

- 通常確認は `npm run check:owner-settings-sync-release-gate` で行う。
- commit / push 後の最終確認は `npm run check:owner-settings-sync-release-gate -- --final` で行う。
- `--final` は clean git、upstreamへpush済み、下記 Final Verification の実行を強制する。
- `package.json` の `npm run check` に通常ゲートを組み込み、今後の通常チェックでも owner設定同期の統合条件を確認する。

## Final Verification

- `git diff --check`
- `npm run check:owner-settings-sync-release-gate`
- `npm run check:owner-access`
- `npm run check:owner-dashboard`
- `npm run check:store-admin-assignment`
- `npm run check:settings`
- `npm run check:customer-cart`
- `npm run check`
- `npm run build`
- `npm run check:owner-settings-sync-release-gate -- --final`

## Deploy Decision

- 各担当MDでは Firebase deploy をしない。
- project が `qrproduct-3340b` であることを確認してから判断する。
- UIのみの変更なら Hosting deploy を候補にする。
- 今回の統合で Functions 差分がない場合、Functions はdeployしない。
- 今回の統合で Firestore rules / indexes / storage 差分がない場合、Firestore rules / indexes / storage はdeployしない。
- Firestore rules を変えた場合は、差分と検証結果を明記して rules deploy を別途判断する。
- Functions 差分がない限り Functions はdeployしない。
- deploy後は live HTML asset hash、主要ルートHTTP 200、必要なら `functions:list` を確認する。

## Live Verification Targets

- Hosting deploy 後の `/` HTMLが新しい `assets/index-*.js` と `assets/index-*.css` を返すこと。
- `/`, `/login`, `/admin`, `/owner`, `/staff`, `/order/test-token` が主要ルートHTTP 200を返すこと。
- Functions / Firestore rules / indexes / storage をdeployしなかった場合は、その未deploy理由を Completion Notes に明記する。

## Completion Notes

- Final gate status: passed after commit/push. `npm run check:owner-settings-sync-release-gate -- --final` confirmed clean git, pushed commits, owner-settings integration wiring, and local verification commands.
- Checks: `git diff --check`, `npm run check:owner-settings-sync-release-gate`, `npm run check:owner-access`, `npm run check:owner-dashboard`, `npm run check:store-admin-assignment`, `npm run check:settings`, `npm run check:customer-cart`, `npm run check`, and `npm run build` passed.
- Firebase deploy: Hosting only was deployed to `qrproduct-3340b`. Functions / Firestore rules / indexes / storage were not deployed because this round had no such diffs.
- Live verification: live HTML references `assets/index-DD8bA5mZ.js` and `assets/index-B9Fvv4Sa.css`. `/`, `/login`, `/admin`, `/owner`, `/staff`, and `/order/test-token` returned HTTP 200.
- Remaining risk: no production data write audit was run; this gate verified source, build, Hosting release, and route availability only.
