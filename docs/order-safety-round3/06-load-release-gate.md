# 06 Load Release Gate

## 目的

01〜05 と 07 の成果を統合し、飲食店の混雑時に本番へ出してよいかを判断する最終ゲートにする。ここを通らない変更は本番 deploy しない。

## ゲート対象

- 同じ席で複数人が同時に注文開始する。
- 同じ席で複数人が同時に注文送信する。
- 同じ端末が連打・再送する。
- 注文送信と会計が競合する。
- 古いQR画面から再送される。
- 通信断/リロード後に保存済み注文を失敗扱いしない。
- キッチンの「提供済み」は押下直後に一度消え、失敗時だけ戻る。
- 失敗が出た場合に原因を追える。

## 統合前条件

- 01〜05 と 07 の担当MDが更新済み。
- 01〜05 と 07 の担当が commit/push 済み。
- `git status --short --branch` が clean。
- `npm run check:order-safety-release-gate` が通る。
- `npm run check` が通る。
- `npm run build` が通る。
- `npm run check:order-functions-emulator` が通る。
- read-only audit で直近の重大な order command failure を確認済み。

## ゲート実行コマンド

担当MD単独で本番 deploy しない。最終判断時は、作業ツリーが clean で、各担当MDのcommit/pushが済んでいる状態から以下を実行する。

```bash
npm run check:order-safety-release-gate
npm run check:order-safety-release-gate -- --final
```

`--final` は以下を順番に確認する。

1. `git status --porcelain` が空であること。
2. `npm run check` が通ること。
3. `npm run check:order-functions-emulator` が通ること。
4. `npm run build` が通ること。
5. `npm run audit:command-failures -- --limit 10` が実行できること。
6. `npm run audit:pending-counts -- --json` が実行できること。

Firestore read credentials がない開発端末では、監査だけを外してローカル構造確認を行う場合に限り `npm run check:order-safety-release-gate -- --final --skip-audits` を使う。ただし、本番deploy判断では `--skip-audits` を合格扱いにしない。

## 本番 deploy 方針

1. Functions / rules 差分があるかを確認する。
   - `git diff --name-status <live-base>..HEAD -- functions firestore.rules firebase.json storage.rules firestore.indexes.json`
2. Functions 差分がある場合:
   - 注文 command Functions だけを明示 deploy する。
   - 既存予約通知や集計 Functions を巻き込む全Functions deployを避ける。
   - 明示deploy対象:

```bash
npx --yes firebase-tools deploy --project qrproduct-3340b --only functions:startCustomerOrderSessionCommand,functions:submitCustomerOrderItemsCommand,functions:submitStaffOrderItemsCommand,functions:seatStaffOrderSessionCommand,functions:completeCheckoutCommand,functions:markOrderItemServedCommand,functions:markOrderItemsServedCommand,functions:markOrderItemOrderedCommand,functions:cancelOrderItemCommand,functions:moveTableOrderCommand,functions:guideReservationToTableCommand --non-interactive
```

3. Firestore rules 差分がある場合:
   - `npm run check:order-rules-lockdown` を通す。
   - legacy client 影響を確認してから deploy する。
4. Hosting 差分だけの場合:
   - `npm run build`
   - `npx --yes firebase-tools deploy --project qrproduct-3340b --only hosting --non-interactive`
5. deploy 後:
   - 本番HTMLが新アセットを返すこと。
   - `/login`, `/admin`, `/staff`, `/staff/kitchen`, `/order/test-token` が 200。
   - Functions logs に注文 command の起動エラーがないこと。
   - `audit:command-failures` と `audit:pending-counts` を確認すること。

## rollback 方針

- Hostingのみ問題:
  - 直前Hostingの正常ビルドへ戻す。
- Functions問題:
  - Functions logs と `orderCommandFailures` を保存し、原因箇所だけ戻す。
- rules問題:
  - lockdown helper を compatibility 側に戻す。
- データ問題:
  - 削除しない。read-only audit と dry-run repair で差分を確認してから限定修復する。

## 合格条件

- お客様の注文が `orderItems` に保存され、スタッフ/キッチンへ反映される。
- 同時注文・再送・会計競合のテストが通る。
- 保存済み注文を顧客画面が失敗扱いにしない。
- キッチン提供済み操作は optimistic hide / rollback で操作感と安全性を両立している。
- 失敗時は `orderCommandFailures` / Functions logs / audit で追跡できる。
- データ履歴、会計履歴、メニュー、QR URL を壊していない。

## 検証コマンド

```bash
npm run check:order-safety-release-gate
npm run check
npm run check:order-functions-emulator
npm run build
npm run audit:command-failures -- --limit 10
npm run audit:pending-counts -- --json
```

## 2026-06-19 実装結果

- 統合した担当MD: 06 のゲート手順と静的チェックを追加。01〜05/07 の完了判定は各担当の commit/push 後に `--final` で確認する。
- deploy対象: 今回はなし。Functions / rules / Hosting / Storage は deploy していない。
- 実行した check:
  - `node --check scripts/check-order-safety-release-gate.mjs` passed.
  - `git diff --check` passed.
  - `npm run check:order-safety-release-gate` passed.
  - `npm run check` passed.
  - `npm run build` passed.
- 本番 smoke: 今回はなし。6番はdeploy前ゲート整備のみ。
- `orderCommandFailures`: `npm run audit:command-failures -- --limit 10` は Firestore read credentials 不在で未完了。
- `audit:pending-counts`: `npm run audit:pending-counts -- --json` は Firestore read credentials 不在で未完了。
- `npm run check:order-functions-emulator`: `127.0.0.1:8080` が既存 Java process、`5001/9099/4400` が既存 Node process で使用中のため未完了。別担当のエミュレータを止めずに保留。
- rollback方法: 今回はdeployしていないため本番rollbackなし。ゲート tooling のみ戻す場合は `package.json` の script wiring、`scripts/check-order-safety-release-gate.mjs`、このMD追記を戻す。
- 監視継続点: 最終deploy判断時は clean worktree、空き emulator ports、Firestore read credentials をそろえて `npm run check:order-safety-release-gate -- --final` を通す。

## 2026-06-20 統合deploy結果

- 統合した担当MD: 01〜05 と 07 の実装済み成果、および 06 の最終ゲート。
- deploy対象:
  - Functions: 注文 command 11本のみを明示deploy。
  - Hosting: Production build を deploy。
  - Firestore rules / Storage: 今回差分なしのため deploy していない。
- 実行した check:
  - `npm run check:order-safety-release-gate -- --final` passed.
  - final gate 内で `npm run check` passed.
  - final gate 内で `npm run check:order-functions-emulator` passed.
  - final gate 内で `npm run build` passed.
  - final gate 内で `npm run audit:command-failures -- --limit 10` passed, rows 0.
  - final gate 内で `npm run audit:pending-counts -- --json` passed.
- deploy結果:
  - `startCustomerOrderSessionCommand`
  - `submitCustomerOrderItemsCommand`
  - `submitStaffOrderItemsCommand`
  - `seatStaffOrderSessionCommand`
  - `completeCheckoutCommand`
  - `markOrderItemServedCommand`
  - `markOrderItemsServedCommand`
  - `markOrderItemOrderedCommand`
  - `cancelOrderItemCommand`
  - `moveTableOrderCommand`
  - `guideReservationToTableCommand`
  の更新が成功。
- 本番 smoke:
  - Production HTML served `assets/index-CJoV9Bg3.js`.
  - `/`, `/login`, `/admin`, `/admin/staff`, `/staff`, `/staff/kitchen`, `/order/test-token` returned HTTP 200.
  - Deployed JS contains admin login fallback, customer submit recovery text, and kitchen served UI strings.
- `orderCommandFailures`:
  - deploy後の `npm run audit:command-failures -- --limit 10` は rows 0。
  - deploy後の Functions log scan で注文 command の error pattern は検出されなかった。
- `audit:pending-counts`:
  - tableCount 19, pendingItemCount 20, driftedTableCount 7, itemIssueCount 0。
  - 既存の集計ズレが残っているため、本番データ削除や自動修復は実施していない。
  - 修復が必要な場合は `repair:pending-counts` の dry-run を確認してから、対象店舗/席を絞って判断する。
- rollback方法:
  - Hosting問題は直前Hostingへ戻す。
  - Functions問題は注文 command 11本の直前ソースへ戻し、`orderCommandFailures` と Functions logs を保存して調査する。
  - rulesは今回触っていないため rules rollback は不要。
- 監視継続点:
  - `orderCommandFailures` rows 0 を維持できるか。
  - `audit:pending-counts` の driftedTableCount 7 を別タスクで dry-run 修復判断するか。
  - Firebase の Node.js 20 runtime deprecation と `firebase-functions` outdated warning は別計画で対応する。

## 完了時の報告

- 統合した担当MD:
- deploy対象:
- 実行した check:
- 本番 smoke:
- `orderCommandFailures`:
- `audit:pending-counts`:
- rollback方法:
- 監視継続点:
