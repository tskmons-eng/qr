# 13 Cloud Functions Node.js 22 / SDK更新

## 目的

Node.js 20のdecommission前に、全FunctionsをFirebase正式対応のNode.js 22へ安全に移行する。注文・権限・集計・通知の仕様変更ではなく、runtimeと既存SDKの保守更新だけを行う。

## 採用バージョン

- Firebase runtime: `nodejs22`
- `firebase-functions 7.2.5`
- `firebase-admin 13.10.0`
- deploy確認済みFirebase CLI: `15.23.0`

`firebase-admin 14.1.0`はNode.js 22に対応するが、安定版`firebase-functions 7.2.5`のpeer範囲外である。Admin 14対応のFunctionsは調査時点で`7.3.0-rc.0`だけのため、productionではRCを使わず、互換が明示されたAdmin 13.10.0を固定する。

## 互換性確認

- triggerは`firebase-functions/v2/*`の明示importを維持する。v6で変更されたpackage既定entrypointには依存しない。
- v7で削除された`functions.config()`は使っていない。
- Admin SDKは`firebase-admin/app`、`firebase-admin/firestore`、`firebase-admin/messaging`のmodular importを使う。
- Admin 13で削除された`sendAll()`、`sendMulticast()`、`sendToDevice*()`などは使わず、現行の`sendEachForMulticast()`を維持する。
- CommonJS、function名、region、memory、CPU、concurrency、Firestore transactionを変更しない。scale上限は下記のsource固定方針にそろえる。

## 本番設定のsource固定

更新前の`functions:list`では19本すべてがNode.js 20 / ACTIVE、asia-northeast1が6本、us-central1が13本だった。全注文Callable 13本、pending集計trigger 3本、`notifyStaff`は`maxInstances: 20`、`notifyReservationCreated`と`processReservationArrivals`は上限未設定である。

SDK更新時に外部設定を失わないよう、全Functionsに`maxInstances: 20`を明示する。Functions SDK v7は未指定のreset可能optionをplatform既定値へ戻し、`maxInstances: 0`もFirebase deployでは20へ正規化された。従って上限未設定だった2本も、concurrency 80との組合せで最大1,600並列を確保できる安全上限20へ統一する。`minInstances`は全関数で設定せず、scale to zeroを維持する。`preserveExternalChanges`は使わずsourceを正とする。

## 検証

```powershell
npm.cmd run check:functions-runtime-upgrade
npm.cmd run check:functions-rules-migration
npm.cmd run check:order-functions-mainline
npm.cmd run check
npm.cmd run build
```

常設Node.jsが22以外のPCでは、`node@22`の実体でclean install、runtime check、source load、Emulatorを実行する。`QR_EXPECT_NODE_MAJOR=22`を指定し、外側とEmulator内のtest processがNode.js 22であることをassertする。

```powershell
$node22 = (& npx.cmd --yes --package=node@22 node -p "process.execPath").Trim()
$env:QR_EXPECT_NODE_MAJOR = '22'
& $node22 scripts/check-functions-runtime-upgrade.mjs
& $node22 -e "require('./functions/index.js')"
$env:QR_ORDER_FUNCTIONS_EMULATOR_INSIDE = '1'
npx.cmd --yes --package=node@22 --package=firebase-tools@15.23.0 -- firebase `
  --project demo-qr-functions-concurrency `
  emulators:exec --only firestore,functions,auth `
  "node --version && node scripts/check-order-functions-emulator.mjs"
Remove-Item Env:QR_ORDER_FUNCTIONS_EMULATOR_INSIDE
Remove-Item Env:QR_EXPECT_NODE_MAJOR
```

Functions dependencyは`functions`ディレクトリで`npm.cmd audit --omit=dev`も実行する。安全なaudit fix後もFirestore / Storage経由の`uuid`を根にmoderateが8件残る。現行Admin 13の依存範囲内では強制解消せず、互換性を無視してAdmin 10へdowngradeする`npm audit fix --force`は禁止する。Functions安定版がAdmin 14を正式対応後に再評価する。

## 段階公開

1. fallback可能な`submitCustomerOrderItemsCommandAsia`をcanaryとしてNode.js 22へ更新する。
2. runtime、region、`minInstances`未設定、`maxInstances: 20`、ERRORログを確認する。
3. `submitStaffOrderItemsCommandAsia`、米国fallback、低頻度注文Callable、会計、通知、Firestore trigger、scheduleの順に、対象名を明示して更新する。
4. 各group後に`functions:list`、Cloud Run設定、注文失敗監査、pending-count監査、ERRORログを確認する。

Functions全体deployは禁止する。Hosting、Firestore Rules / indexes、Storage Rules、本番データは変更しない。本番ダミー注文・通知も作らない。

## rollback

- runtime更新前に本番scale上限をsourceへ固定したNode.js 20 commitをrollback基準として残す。
- 問題のあるfunctionだけをそのrollback基準から明示deployする。上限未反映の`93e13e5`をそのまま使わない。
- 東京注文Callableの一時障害は、同じ`clientRequestId`を使う既存米国Callable fallbackで重複なしに退避する。
- HostingとRulesはruntime rollback対象に含めない。

## 検証・公開結果

- Node.js 20 rollback基準: `aa996d6`。`93e13e5`を直接rollback元にはしない。
- Node.js 22.23.1でclean `npm ci`、全Functions JavaScriptのsyntax check、Functions source load、runtime / migration / latency routing checkが成功した。
- Firebase CLI 15.23.0をNode.js 22で直接起動し、Functions Emulatorの`Using node@22 from host`、test process `v22.23.1`、全19定義の読込を確認した。注文、会計、席移動、予約案内、pending集計trigger、予約通知triggerを含むEmulator検証は成功した。
- `npm.cmd run check`、`npm.cmd run build`、`git diff --check`は成功した。
- production dependency監査はcritical 0 / high 0 / moderate 8 / low 0。更新前のhigh 4 / moderate 13 / low 1から減少し、残る間接advisoryは既知注意点として維持する。
- scheduleはPub/Sub Emulatorを起動していないためローカル実行対象外。`processReservationArrivals`を最後に単独deployし、schedule / timezoneと本番成功ログを確認する。
- `notifyReservationCreated`の初回更新で、SDK v7のplatform resetにより上限未設定が`maxInstances: 20`へ変わった。`maxInstances: 0`で再deployしても20へ正規化されたため、外部手動設定へ依存せず、通知・scheduleも明示的に20へ統一する。
- branch `codex/functions-runtime-node22`をpushし、Firebase project `qrproduct-3340b`へfunction名を明示した段階deployだけを行った。Functions全体deploy、Hosting、Rules / indexes、Storage、本番データ変更は行っていない。
- 東京顧客注文canaryから開始し、東京スタッフ、米国fallback、低頻度Callable、セッション、取消、配膳、会計、通知、pending集計trigger、scheduleの順に更新した。
- 全19本がNode.js 22 / ACTIVE。asia-northeast1 6本、us-central1 13本、全本256MiB / concurrency 80 / `minInstances`未設定 / `maxInstances: 20`。設定不一致は0本だった。
- 全Functionsの直近75分Cloud Run ERRORは0件、`orderCommandFailures`も直近75分0件だった。本番ダミー注文・通知は作成していない。
- pending-count監査はtrigger更新前後とも19席 / 未提供item 50件 / drift 7席 / item参照不整合0件で一致した。既存driftの修復は行っていない。
- `processReservationArrivals`はScheduler `ENABLED` / `every 1 minutes` / `Asia/Tokyo`を維持し、Node.js 22更新後の自然実行が3回連続HTTP 200（1.879秒、0.887秒、0.876秒）だった。
- Hosting asset `/assets/index-DGZ0_1if.js`は注文速度改善公開時とSHA-256が一致し、`/`、`/order`、`/staff`、`/admin/sales`はHTTP 200だった。Hosting再deployはしていない。
- 既存`notifyStaff`はfunctionがus-central1、Firestore triggerがasia-northeast1のためdeploy警告が残る。region変更は同名のまま安全に行えないため今回触らず、別名移行を将来課題とする。
