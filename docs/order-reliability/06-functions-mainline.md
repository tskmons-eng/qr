# 06 Functions Mainline

## 目的

Production の注文経路を Cloud Functions command 本線へ切り替える。  
`VITE_ORDER_COMMAND_RUNTIME=functions` を「将来使える」状態のままにせず、顧客注文・スタッフ注文・着席・提供済み/戻し・キャンセル・会計・席移動が Functions 経由で実行される状態を完了条件にする。

## なぜ必要か

前回の opt-in は本番影響を避ける安全弁だった。  
しかし、注文が入らない・反映されない問題を止めるには、ブラウザが複数 collection を直接 write する経路を通常運用から外す必要がある。

## 担当範囲

- `src/services/orderCommandService.js`
- `src/services/orderFunctionCommandService.js`
- `src/services/orderItemCommandService.js`
- `src/services/tableMoveCommandService.js`
- `functions/orderCommandApi.js`
- `functions/orderCommandHandlers.js`
- `.env.local.example`
- `scripts/check-functions-rules-migration.mjs`
- 必要なら新規 `scripts/check-order-functions-mainline.mjs`

## 実装方針

- Production build では Functions command を既定経路にする。
- local/dev/rollback だけ `VITE_ORDER_COMMAND_RUNTIME=client` で client command に戻せるようにする。
- Functions 未deployの状態で Hosting だけ先に切り替わらないよう、build/check script で検出する。
- 全 command の入力/返却形は既存 wrapper と互換にし、UI 側に別経路を作らない。
- `clientRequestId` は Functions 経由でも保持し、二重送信の idempotency を壊さない。
- customer command は未ログイン利用を前提に、store/table/order の整合を Functions 内で検証する。
- staff command は Admin SDK が Firestore rules を迂回するため、Functions 内で staff/store 権限を必ず検証する。
- 既存 Firestore データ、履歴、メニューは変更しない。

## 完了条件

- `npm run build` 時に Production の既定 runtime が Functions であることを静的チェックできる。
- `VITE_ORDER_COMMAND_RUNTIME=client` を明示した場合だけ rollback/dev 経路になる。
- すべての注文 command が callable Functions で呼べる。
- Functions 未deployのまま Hosting を Functions runtime で出す危険が、チェックか統合手順で止まる。
- `npm run check:functions-rules-migration` と新規 mainline check が通る。
- `node --check` で Functions 関連ファイルが通る。

## 実装結果

- `src/services/orderFunctionCommandService.js` は `VITE_ORDER_COMMAND_RUNTIME=client` のときだけ client command に戻す。
- `VITE_ORDER_COMMAND_RUNTIME=functions` は emulator/manual verification 用に残す。
- runtime override が未設定の場合、Production build は Functions command、dev build は client command を選ぶ。
- `scripts/check-order-functions-mainline.mjs` で Production default、rollback override、callable export と wrapper 呼び出しの対応を静的確認する。
- `npm run check` は `check:order-functions-mainline` を含む。
- `.env.local.example` は local/dev rollback 用として `VITE_ORDER_COMMAND_RUNTIME=client` を残す。

## 統合担当への注意

- 2026-06-19 時点の live Functions は、既存予約/集計関数が `asia-northeast1` と `us-central1` に分かれている。ソース側でも既存関数の region を明示しているが、注文 command の初回反映では既存関数を巻き込む全Functions deployを避ける。
- Hosting を新ビルドへ切り替える前に、以下の callable Functions を deploy 済みにする。
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
- 注文 callable は `us-central1` で定義する。client は region override がない場合 `getFunctions(app)` の既定 `us-central1` を呼ぶ。
- rollback build は `VITE_ORDER_COMMAND_RUNTIME=client` を明示して作る。
- この分担では Firebase deploy は実行しない。

## 検証結果

- `npm run check:functions-rules-migration` passed.
- `npm run check:order-functions-mainline` passed.
- `node --check functions/index.js functions/orderCommandApi.js functions/orderCommandAuth.js functions/orderCommandHandlers.js functions/orderCommandShared.js` passed.
- `npm run check` passed.
- `npm run build` passed.
- `.env.local` に `VITE_ORDER_COMMAND_RUNTIME` override がないことを確認した。
- Firebase deploy は実行していない。

## 禁止事項

- この分担単独で本番 deploy しない。
- 旧 client 経路を Production の通常既定として残したまま完了扱いにしない。
- UI へ別の注文ボタンや別 route を追加しない。
- データ migration、履歴削除、メニュー削除をしない。

## 引き継ぎ報告

完了時は以下を報告する。

- Production 既定 runtime の判定方法。
- rollback/dev の切替方法。
- 追加/変更した check script。
- Functions deploy が必要な export 名。
- 未deploy時に壊れないための統合担当への注意点。
