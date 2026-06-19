# 05 Live Failure Monitoring And Repair

## 目的

「注文が入らなかった」と言われた時に、原因を即座に追える状態にする。失敗ログ、Functions logs、pending count 監査、修復手順を売上事故対応の道具として整える。

## 想定する実店舗ケース

- お客様から「注文できませんでした」と言われる。
- キッチンには出ていないが、お客様画面には送信済みのように見える。
- スタッフ画面の未提供数と実際の `orderItems` がずれる。
- 一時的な Functions エラーが発生し、後から原因を追いたい。
- 営業中なのでデータ削除や大規模修復はできない。

## 現状確認

- Server-side failure: `functions/orderCommandFailures.js`
- Client-side failure: `src/services/orderCommandFailureService.js`
- Audit: `scripts/audit-order-command-failures.mjs`
- Pending audit/repair: `scripts/audit-pending-counts.mjs`, `scripts/repair-pending-counts.mjs`
- Plan notes: `docs/order-reliability/09-live-observability.md`, `docs/order-reliability/10-data-consistency-repair.md`

## 担当範囲

- `scripts/audit-order-command-failures.mjs`
- `scripts/audit-pending-counts.mjs`
- `scripts/repair-pending-counts.mjs`
- `functions/orderCommandFailures.js`
- `src/services/orderCommandFailureService.js`
- 新規 runbook MD

## 実装方針

1. 直近15分/60分の注文失敗を絞り込める read-only audit オプションを追加する。
2. `storeId`, `tableId`, `orderId`, `clientRequestId`, `errorCode` で追跡できる出力を整える。
3. `pendingCount` / `pendingAggregate*` のズレを read-only で確認し、修復は dry-run を既定にする。
4. 本番で安全に実行できる監視手順を runbook 化する。
5. Functions logs の確認コマンドを runbook に固定する。
6. 注文失敗が増えた時の判断基準を定義する:
   - 顧客端末/通信だけの問題
   - Functions側の恒常エラー
   - rules/権限エラー
   - データ不整合

## 合格条件

- 注文失敗を `clientRequestId` 単位で追える。
- 店舗/席単位で直近の失敗を確認できる。
- 修復系コマンドは既定で dry-run。
- 既存履歴やメニューを消さずに、ズレだけを確認・必要時修復できる。

## 検証コマンド

```bash
npm run check:live-observability
npm run check:data-consistency-repair
npm run audit:command-failures -- --limit 10
npm run audit:pending-counts -- --json
npm run check
```

## 完了時の報告

- 追加した audit オプション:
  - `--minutes <number>`: 直近15分/60分などの時間窓で `orderCommandFailures` を絞る。
  - `--table <tableId>`: `tableId` / `targetTableId` で絞る。
  - `--order <orderId>`: `orderId` で絞る。
  - `--client-request-id <clientRequestId>` / `--request`: 再送・冪等IDで絞る。
  - 出力に `summary.byErrorCode`, `summary.byCommandType`, `summary.byStoreId`, `summary.byActorType`, `summary.diagnosisSignals` を追加。
- 本番 read-only 確認結果:
  - `npm run audit:command-failures -- --limit 10` は、現環境に Firestore read credentials がなく未実行。
  - `npm run audit:pending-counts -- --json` も同じ理由で未実行。
  - Emulator 読み取りは `FIRESTORE_EMULATOR_HOST`、本番読み取りは `GOOGLE_APPLICATION_CREDENTIALS` または gcloud Application Default Credentials が必要。
- dry-run 修復手順:
  - `npm run repair:pending-counts -- --store <storeId>`
  - `npm run repair:pending-counts -- --store <storeId> --json`
  - `--apply` なしでは write しない。修復対象は `tables` の pending 派生フィールドのみ。
- 障害時 runbook:
  - `docs/order-safety-round3/live-failure-monitoring-runbook.md`
  - 直近15分/60分 audit、Functions logs、pending audit、dry-run repair、判断基準を記載。
- 未解決リスク:
  - 本番Firestoreの読み取り認証がない状態では、実データのread-only監査結果は確認できない。
  - 本担当では deploy しない。deploy は `06-load-release-gate.md` の最終ゲート後に判断する。
