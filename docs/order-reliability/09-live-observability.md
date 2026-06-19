# 09 Live Observability

## 目的

「注文が入らない」「反映されない」が起きたとき、原因が見えない状態を終わらせる。  
Functions command の成功/失敗、UI の再試行、Firestore の反映状態を後から追えるようにする。

## 担当範囲

- `functions/orderCommandApi.js`
- `functions/orderCommandHandlers.js`
- `src/services/orderCommandFailureService.js`
- `src/lib/orderCommandFailures.js`
- `src/lib/orderCommandErrors.js`
- `src/components/OrderCommandErrorNotice.jsx`
- `scripts/audit-pending-counts.mjs`
- 必要なら新規 live check / log check script

## 実装方針

- Functions 側で command failure を記録する。client best-effort だけに依存しない。
- 記録する情報は調査に必要な最小限にする。
  - command type
  - command version
  - actor type
  - storeId
  - tableId
  - orderId
  - itemId
  - clientRequestId
  - error code/name/message
  - createdAt
- メニュー内容、個人情報、秘密情報、決済に不要な詳細はログへ広げない。
- UI は既存導線の中で短いエラーと再試行を出す。
- 調査用 script で直近の command failure と pending-count drift を確認できるようにする。

## 完了条件

- Functions command failure が server-side に残る。
- UI 側でも無言失敗にならず、顧客/スタッフが同じ操作から再試行できる。
- 直近エラーを確認する手順が README またはこのMDに残る。
- `npm run audit:pending-counts -- --json` と組み合わせて、反映ズレの有無を確認できる。
- `npm run check:order-command-ui` と関連 check が通る。

## 実装済み

- `functions/orderCommandFailures.js` を追加し、Functions command 失敗時に server-side の `orderCommandFailures` へ best-effort で記録する。
- `functions/orderCommandApi.js` の callable wrapper で、元の command error を `HttpsError` に変換する前に失敗記録を試行する。
- logging failure は `console.warn` に留め、元の注文 command の成功/失敗結果を変えない。
- `functions/index.js` で各 callable command に `commandType` / `actorType` を付与する。
- `scripts/audit-order-command-failures.mjs` を追加し、直近の `orderCommandFailures` を読み取り専用で確認できるようにする。
- `scripts/check-live-observability.mjs` を追加し、server-side failure log、監査スクリプト、手順ドキュメントの接続を静的に確認する。

## 直近エラー確認手順

1. Functions command failure を確認する。
   - `npm run audit:command-failures`
   - 直近15分を見る場合: `npm run audit:command-failures -- --minutes 15 --limit 20`
   - 直近60分を店舗で絞る場合: `npm run audit:command-failures -- --minutes 60 --store <storeId> --limit 50`
   - 店舗を絞る場合: `npm run audit:command-failures -- --store <storeId>`
   - 席を絞る場合: `npm run audit:command-failures -- --table <tableId>`
   - 注文を絞る場合: `npm run audit:command-failures -- --order <orderId>`
   - 再送/冪等IDを絞る場合: `npm run audit:command-failures -- --client-request-id <clientRequestId>`
   - JSONで残す場合: `npm run audit:command-failures -- --json`
2. pending-count / aggregate の反映ズレを確認する。
   - `npm run audit:pending-counts -- --json`
   - 店舗を絞る場合: `npm run audit:pending-counts -- --store <storeId> --json`
3. エラーとズレを突き合わせる。
   - `clientRequestId`, `orderId`, `tableId`, `errorCode` を優先して見る。
   - `orderCommandFailures` に失敗があり、pending-count drift がなければ、注文作成前または権限/整合性チェックで止まった可能性が高い。
   - failure がなく drift だけある場合は、Cloud Functions aggregate 反映や既存 client write の混在を疑う。

本番 Firestore を読む場合は `GOOGLE_APPLICATION_CREDENTIALS` または gcloud の Application Default Credentials が必要。Emulator は `FIRESTORE_EMULATOR_HOST` を使う。

営業中の障害対応では、Round 3 runbook の [live-failure-monitoring-runbook.md](../order-safety-round3/live-failure-monitoring-runbook.md) を使い、Functions logs、直近15分/60分の failure audit、pending-count audit、dry-run repair の順に確認する。

## 禁止事項

- ログのために注文処理の成功/失敗結果を変えない。
- logging failure で元の注文エラーを上書きしない。
- 秘密情報や `.env.local` の値を出力しない。
- 本番 deploy は 11 の統合担当に任せる。
