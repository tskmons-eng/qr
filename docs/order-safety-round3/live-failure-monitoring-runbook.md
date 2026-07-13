# Live Failure Monitoring Runbook

## 目的

「注文が入らなかった」と言われた時に、本番データを壊さずに原因を切り分ける。最初は read-only で確認し、pending count の修復も dry-run を先に出す。

## 手動ヘルス監視

通常のread-only監視は次の1コマンドで実行する。

```bash
npm run monitor:health
```

Windows PowerShellでnpm launcherの実行エラーが出る場合は、同じ処理を`npm.cmd run monitor:health`で実行する。

- ローカル: Git状態、`npm run check`、production build、初期bundle性能予算。
- 本番: 主要URL/asset疎通、直近60分の注文command失敗、pending count整合性。
- `PASS` は異常なし、`KNOWN` は登録済みbaselineと同一、`WARN` は単発失敗やbaseline改善、`FAIL` は恒常エラー・権限エラー・新規不整合を表す。
- JSONが必要な場合は `npm run monitor:health -- --minutes 15 --json` のように実行する。

注文Functionsの同時実行まで含める場合は、営業外に次を使う。

```bash
npm run monitor:health:deep
```

監視自身はbaselineを更新しない。`repair:pending-counts`、ファイル編集、commit/push、Firebase deployは実行しない。秘密値と店舗・席・注文・request IDを出力しない。baseline変更は、read-only監査結果をユーザー様が確認した後の明示的なコード変更として扱う。

## 先に集める情報

- 発生時刻: JSTで何時何分か。
- 店舗: `storeId` または店舗名。
- 席: `tableId` または席名。
- 画面: お客様画面、スタッフ画面、キッチン画面のどこで異常に見えたか。
- 追跡ID: 画面やログに `clientRequestId`、`orderId`、`errorCode` があれば控える。

## 1. 直近15分を見る

```bash
npm run audit:command-failures -- --minutes 15 --limit 20
```

店舗が分かっている場合:

```bash
npm run audit:command-failures -- --minutes 15 --store <storeId> --limit 20
```

追跡IDがある場合:

```bash
npm run audit:command-failures -- --client-request-id <clientRequestId> --json
npm run audit:command-failures -- --table <tableId> --minutes 15 --json
npm run audit:command-failures -- --order <orderId> --json
```

出力では `storeId`, `tableId`, `orderId`, `clientRequestId`, `errorCode`, `commandType`, `diagnosisSignals` を見る。

## 2. 直近60分を見る

15分で出ない、または一時的な波が疑わしい場合:

```bash
npm run audit:command-failures -- --minutes 60 --store <storeId> --limit 50
```

`functions_constant_error_possible:<errorCode>` や同じ `commandType` の集中があれば、端末単独ではなく Functions command 側の恒常エラーとして扱う。

## 3. Functions logs を見る

全体:

```bash
npx --yes firebase-tools functions:log --project qrproduct-3340b --lines 100
```

注文command中心:

```bash
npx --yes firebase-tools functions:log --project qrproduct-3340b --only startCustomerOrderSessionCommand,submitCustomerOrderItemsCommand,submitStaffOrderItemsCommand,completeCheckoutCommand --lines 100
```

キッチンや席移動も疑う場合:

```bash
npx --yes firebase-tools functions:log --project qrproduct-3340b --only markOrderItemServedCommand,markOrderItemsServedCommand,moveTableOrderCommand --lines 100
```

Functions logs では、audit の `errorCode`, `commandType`, `clientRequestId`, 発生時刻に近い例外を突き合わせる。

## 4. pending count のズレを見る

読み取り専用:

```bash
npm run audit:pending-counts -- --store <storeId> --json
```

店舗が特定できない初動では全体を読むこともできるが、営業中は店舗を絞る。

```bash
npm run audit:pending-counts -- --json
```

`driftedTableCount` と `itemIssueCount` が0なら、少なくとも未提供数の集計ズレは出ていない。

## 5. 修復はdry-runから

修復計画だけ出す:

```bash
npm run repair:pending-counts -- --store <storeId>
npm run repair:pending-counts -- --store <storeId> --json
```

`--apply` は、dry-run の対象席、before/after、`itemIssues` を確認してから使う。営業中は責任者確認なしに実行しない。

```bash
npm run repair:pending-counts -- --store <storeId> --apply
```

修復対象は `tables` の派生フィールドだけに限定する。

- `pendingCount`
- `pendingAggregateVersion`
- `pendingAggregateCount`
- `pendingAggregateDrinkCount`
- `pendingAggregateFoodCount`

`orders`, `orderItems`, `checks`, `products`, `categories`, `optionTemplates`, `tagTemplates`, `reservations` は削除・再作成・一括上書きしない。

## 判断基準

### 顧客端末/通信だけの問題

- 15分/60分の `orderCommandFailures` に該当ログがない。
- Functions logs に同時刻の例外がない。
- `audit:pending-counts` で `driftedTableCount` と `itemIssueCount` が0。
- 同じ店舗の複数席では再現せず、1端末または1通信環境に偏っている。

この場合は、注文が保存済みか `orderId` と `orderItems` を確認し、未保存ならお客様画面の再試行導線を優先する。

### Functions側の恒常エラー

- 15分または60分で同じ `errorCode` が3件以上ある。
- 同じ `commandType` が複数店舗または複数席で集中している。
- audit の `diagnosisSignals` に `functions_constant_error_possible:<errorCode>` または `command_cluster:<commandType>` が出る。
- Functions logs に同じ例外が繰り返し出ている。

この場合は、pending repair では直らない。直近デプロイ、Functions設定、Firestore rules、該当commandの入力検証を確認する。

### rules/権限エラー

- `errorCode` が `permission-denied`, `unauthenticated`, `failed-precondition` のいずれか。
- 特定の店舗、席、スタッフ権限、匿名セッションに偏っている。
- audit の `diagnosisSignals` に `rules_or_permission_error_seen` が出る。

この場合は、Firestore rules、スタッフ権限、匿名顧客セッション、店舗コード導線を確認する。データ修復を先に実行しない。

### データ不整合

- `orderCommandFailures` は少ない、または端末/Functionsの恒常エラーではない。
- `audit:pending-counts` で `driftedTableCount` または `itemIssueCount` が出る。
- スタッフ画面の未提供数と実際の `orderItems` が合わない。

この場合は `repair:pending-counts` の dry-run を出す。`itemIssues` は report-only とし、自動で注文履歴や明細を削除・移動しない。

## 報告テンプレート

- 発生時刻:
- 店舗/席:
- 直近15分 audit:
- 直近60分 audit:
- Functions logs:
- pending audit:
- dry-run repair plan:
- 判断:
- 次の対応:
