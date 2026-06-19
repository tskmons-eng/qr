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

## 禁止事項

- ログのために注文処理の成功/失敗結果を変えない。
- logging failure で元の注文エラーを上書きしない。
- 秘密情報や `.env.local` の値を出力しない。
- 本番 deploy は 11 の統合担当に任せる。
