# 07 Integration Release Gate

## Purpose

01〜06 の結果を統合し、競合、UI崩れ、注文/会計の安全性を確認してから本番deployするか判断する。

## Preconditions

- 各担当MDの `Completion Notes` が更新されている。
- 各担当のコミットがpush済み。
- `git status --short --branch` で統合対象外の変更がない。
- 既存利用者がいるため、deploy対象を明示できる状態になっている。

## Integration Checklist

- キッチン:
  - 提供済みを押すと即時に消える。
  - Undoで直近提供済みが `ordered` に戻る。
  - Undo失敗時に表示が破綻せず、エラーが出る。
  - 表示密度が上がっても文字が潰れない。
- スタッフ注文/会計:
  - 注文追加の送信バーが長いスクロールで見失われない。
  - 会計明細が多い場合も確定操作に到達しやすい。
  - 下部ナビや固定バーが重ならない。
- 顧客QR:
  - カート、注文履歴/注文状況、会計確認の意味が分かる。
  - カート周辺に不要な金額表示が出ない。
  - 会計依頼前に注文済み内容と合計が見える。
  - 商品行タップ追加がON/OFFで切り替わる。
- 管理:
  - カテゴリー編集でiOSズームが起きにくい。
  - 人数分メニュー自動追加の表示設定が管理画面と人数画面で一致している。

## Required Checks

- `git diff --check`
- `npm run check:restaurant-ux-release-gate`
- `npm run check:kitchen-display`
- `npm run check:staff-menu`
- `npm run check:staff-table-detail`
- `npm run check:checkout`
- `npm run check:customer-cart`
- `npm run check:customer-order-status`
- `npm run check:customer-entry`
- `npm run check:settings`
- `npm run check:admin-category`
- `npm run check:option-modal`
- `npm run check:order-command-ui`
- `npm run check:order-functions-emulator`
- `npm run check`
- `npm run build`

## Final Gate Command

- 通常配線確認: `npm run check:restaurant-ux-release-gate`
- 本番deploy判断直前: `npm run check:restaurant-ux-release-gate -- --final`
- 01〜06 の `Completion Notes` が未記入、またはローカルコミット未pushの場合、`--final` は失敗させる。

## Deploy Policy

- rules / indexes / storage は差分がある場合だけdeploy対象にする。
- Functions 差分がある場合は対象Functionsを明示する。
- UIだけなら Hosting のみ。
- deploy前に `.firebaserc` の project が `qrproduct-3340b` であることを確認する。
- deploy後は live HTML asset hash と主要ルートHTTP 200を確認する。
- 注文 command に触れた場合は `functions:log` と `audit:command-failures` を確認する。

## Rollback Notes

- Hosting UI問題は直前Hostingへ戻す。
- Functions問題は対象Functionsだけ直前ソースへ戻す。
- 本タスクではデータ削除・履歴削除をしていない前提のため、データrollbackは原則不要。

## Completion Notes

- Integrated commits: 7d406e0 admin category iOS zoom, 90d8099 guest auto-add visibility, e7a0566 staff order/checkout scroll layout, 7ead6a1 customer cart/checkout history navigation, plus current 01 kitchen undo/density, 06 menu row tap setting, and 07 release gate changes.
- Checks: `git diff --check`, `npm run check:restaurant-ux-release-gate`, `npm run check`, `npm run build`, `npm run check:order-functions-emulator`, and `npm run check:restaurant-ux-release-gate -- --final` passed after 07 fixed `complete_checkout` transaction contention error normalization.
- Deploy target: deployed Hosting and `functions:completeCheckoutCommand` to `qrproduct-3340b`. rules / indexes / storage were not deployed.
- Production result: deploy completed. Live HTML references `assets/index-DIJYZ4C0.js` and `assets/index-BA3KaryF.css`; `/`, `/login`, `/admin`, `/staff`, `/staff/kitchen`, and `/order/test-token` returned HTTP 200. `functions:list` shows `completeCheckoutCommand` active in `us-central1`, and `functions:log --only completeCheckoutCommand --lines 20` returned recent rollout/invocation logs without a new error line. `npm run audit:command-failures -- --limit 10` could not read production Firestore because local ADC/service-account credentials were unavailable.
- Remaining risk: iPhone実機のカテゴリー編集ズーム、顧客メニューの実機タップ感、キッチンUndoの現場操作感は自動チェックでは確認できない。Production Firestoreのcommand failure監査は認証設定後に再実行する。
