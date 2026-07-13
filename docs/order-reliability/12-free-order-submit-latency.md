# 12 無料で行う注文送信レイテンシ改善

## 目的

月額の常駐費用を増やさない範囲で、お客様・スタッフの注文送信を短縮する。Functions command、Firestore transaction、`clientRequestId` による冪等性、既存の失敗記録は維持し、速度のために注文の安全性を下げない。

## 経路

- お客様送信は `submitCustomerOrderItemsCommandAsia`、スタッフ送信は `submitStaffOrderItemsCommandAsia` を `asia-northeast1` の優先経路にする。
- 既存の `submitCustomerOrderItemsCommand` と `submitStaffOrderItemsCommand` は `us-central1` に残し、限定的な退避先とrollback先にする。
- 東京Callableが未到達または一時障害のときだけ、同じ `clientRequestId` を含む同じpayloadで既存米国Callableへfallbackする。
- 商品不在、注文終了、入力不正、認証・権限などの業務エラー・権限エラーでは fallback しない。
- `minInstances` は追加しない。新しい有料サービスや依存パッケージも追加しない。異常な集中時の従量費を抑えるため、東京Callable 2本は既存米国経路と同じ`maxInstances: 20`を上限にする。

## 無料の処理短縮

- request内の商品IDを重複排除し、商品と必要なcategoryをAdmin SDK `db.getAll()`でまとめて読む。
- お客様送信のdedupe item / order、スタッフ送信のdedupe item / order / tableはtransactionの`getAll()`でまとめて読む。
- item document ID、transaction境界、`orderItemsRevision`、スタッフ注文の`pendingCount`更新は変更しない。

## 匿名の処理時間ログ

- Callable成功時に `order_command_completed` を出し、`commandType`、`actorType`、`region`、`durationMs`、`deduped` だけを記録する。
- 商品確認とtransaction完了時に `order_command_stage_completed` を出し、`commandType`、`stage`、`durationMs`、`itemCount` だけを記録する。
- 店舗ID、席ID、注文ID、商品明細、`clientRequestId`、スタッフUIDは成功ログへ出さない。失敗調査は既存の `orderCommandFailures` を使う。
- `product_verification` と `transaction` を分けて測るため、リージョン移動後に残る待ち時間を区別できる。

ログ確認例:

```powershell
npx.cmd firebase-tools functions:log --project qrproduct-3340b --only submitCustomerOrderItemsCommandAsia --lines 100
npx.cmd firebase-tools functions:log --project qrproduct-3340b --only submitStaffOrderItemsCommandAsia --lines 100
```

ログは読み取り専用で確認し、本番へ速度測定用のダミー注文は送らない。利用件数が集まった時点で `durationMs` のp50 / p95を比較する。

## 検証

```powershell
npm.cmd run check:order-latency-routing
npm.cmd run check:order-functions-mainline
npm.cmd run check:functions-rules-migration
npm.cmd run check:live-observability
npm.cmd run check:order-functions-emulator
```

エミュレーターでは東京別名Callableのお客様・スタッフ正常送信、同一requestの同時再送、送信完了後の再送を確認する。`permission-denied`、`invalid-argument`、`failed-precondition`、商品不在などの業務エラーが米国fallback対象にならないことは静的checkのfixtureで固定する。

## 公開とrollback

1. `submitCustomerOrderItemsCommandAsia` と `submitStaffOrderItemsCommandAsia` の2本だけを先に公開する。
2. `functions:list` で両方が `asia-northeast1` に存在し、既存米国Callableが残っていることを確認する。
3. Hostingを公開し、生成assetが東京別名と限定fallbackを含むことを確認する。
4. 問題時はクライアントのsubmit呼出しを既存米国Callableへ戻す。既存米国exportやデータを削除しない。

Functions未公開の状態でHostingだけを先に公開すると、初回送信が米国fallbackまで待つため速度改善にならない。必ずFunctions 2本を先に公開する。

## 2026-07-13 ローカル検証結果

- `check:order-latency-routing`、`check:order-functions-mainline`、`check:functions-rules-migration`、`check:live-observability` は通過した。
- Auth / Firestore / Functions Emulatorで既存fixture一式と東京別名Callableのお客様・スタッフ同時再送fixtureが通過した。
- Emulatorは `submitCustomerOrderItemsCommandAsia` と `submitStaffOrderItemsCommandAsia` を `asia-northeast1` として初期化した。
- エミュレーターログでtotal / phase eventが匿名fieldだけを持つことを確認した。本番Functions、Hosting、本番データはこの検証では変更していない。
