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

## 2026-06-20 Post-completion Verification Addendum

- Finding: final re-check after all担当完了で `npm run check:restaurant-ux-release-gate -- --final` を再実行したところ、`check:order-functions-emulator` の `same-table customer start race` が 50 concurrent requests すべて timeout/internal で失敗した。
- Cause: 同じ席の注文開始を50件同時に `tables/{tableId}` transaction へ集中させると、Functions emulator では60秒timeoutまで待たされるケースがあった。
- Fix: `startCustomerOrderSessionCommand` に `orderStartLocks/{tableId}` の短い開始ロックを追加。勝者だけが注文作成transactionを実行し、他リクエストは `tables/{tableId}.currentOrderId` が入るのを待って同じ注文IDを返す。ロックが残っている間は、ロックなしで注文作成transactionへ入らない。
- Additional finding: lock fix後の再実行で、席移動と顧客追加注文が同時に走る `move vs submit race` が Firestore `Transaction lock timeout` により `internal` で失敗するケースを検出した。
- Additional fix: 顧客追加注文と席移動のtransactionに、Firestoreの一時的なロック/期限切れだけを再試行する薄いリトライを追加。席移動が既に完了していた再試行では同じ注文IDが移動先にある場合だけ成功扱いにする。
- Verification: `node --check functions/orderCommandHandlers.js` passed. `npm run check:order-functions-emulator` passed after the lock fix.
- Deploy target: `functions:startCustomerOrderSessionCommand`, `functions:submitCustomerOrderItemsCommand`, `functions:moveTableOrderCommand` only. Hosting / rules / indexes / storage は追加deployしない。
- Final verification: commit `9d3561d` pushed to `origin/codex/staff-entry-session-recovery`. `npm run check:restaurant-ux-release-gate -- --final` passed after push; this included clean/pushed git status, `git diff --check`, restaurant UX checks, `npm run check:order-functions-emulator`, `npm run check`, and `npm run build`.
- Production deploy result: deployed only `functions:startCustomerOrderSessionCommand`, `functions:submitCustomerOrderItemsCommand`, and `functions:moveTableOrderCommand` to `qrproduct-3340b`. Firebase CLI reported successful update for all three. Hosting / Firestore rules / indexes / storage were not deployed.
- Production verification: `functions:list` showed all three as `v2 callable` in `us-central1` on `nodejs20`. `/`, `/login`, `/admin`, `/staff`, `/staff/kitchen`, and `/order/test-token` returned HTTP 200. `functions:log` runtime error scan for the three functions returned no `ERROR`, exception, timeout, or deadline line after deploy.
- Remaining verification gap: `npm run audit:command-failures -- --limit 10` could not read Production Firestore because local ADC/service-account credentials were unavailable. Runtime deploy/log checks succeeded, but command failure collection audit still needs credentials.

## 2026-06-20 Live UI Feedback Correction

- Finding: After deployment, user feedback reported that staff/checkout scroll behavior still felt unchanged, customer menu row tap ordering did not work, and the previous kitchen panel layout was preferred.
- Fix set: Revert the Round4 kitchen undo/density UI while preserving served optimistic hide/rollback; move customer row tap handling to the root product row; strengthen staff table detail and checkout internal scroll containers.
- Deploy target: Hosting only. Functions, Firestore rules, indexes, storage, menu data, order history, and QR URLs must remain untouched.
- Required verification: targeted checks for customer cart, kitchen display, staff table detail, checkout, staff menu, order-command UI, `git diff --check`, `npm run check`, `npm run build`, `npm run check:restaurant-ux-release-gate -- --final`, then Hosting deploy and live asset hash/route HTTP verification.
