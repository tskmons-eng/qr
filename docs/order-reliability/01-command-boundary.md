# 01 Command Boundary

## 目的

注文処理の直接 Firestore 書き込みを減らし、注文開始・注文送信・会計・キャンセル・提供済み・席移動を command 層へ集約する。

## 現在の状態

実装済み command:

- `startCustomerOrderSession`
- `seatStaffOrderSession`
- `submitCustomerOrderItems`
- `submitStaffOrderItems`
- `completeCheckoutCommand`
- `markOrderItemServedCommand`
- `markOrderItemOrderedCommand`
- `cancelOrderItemCommand`
- `moveTableOrderCommand`

主要ファイル:

- `src/services/orderCommandService.js`
- `src/services/orderItemCommandService.js`
- `src/services/tableMoveCommandService.js`
- `src/services/orderCommandFailureService.js`
- `src/lib/orderCommands.js`
- `src/lib/orderCommandPayloads.js`
- `src/lib/orderCommandFailures.js`
- `scripts/check-order-command-boundary.mjs`

実装済み補助:

- command 失敗時に `orderCommandFailures` へ best-effort で記録する。
- 記録対象は command type、actor type、store/table/order/item/client request、error code/name/message、command version、timestamp。
- ログ書き込み失敗は元の注文エラーを上書きしない。
- local rules には `orderCommandFailures` を追加済み。ただし本番 deploy はこの分野では行わない。

## 作業ルール

- UIから直接 `orderItems`, `orders`, `tables.pendingCount` を複数箇所で更新する形に戻さない。
- command は現在状態を transaction 内で読む。
- `pendingCount` は現在の `itemStatus` に基づいて一度だけ増減する。
- 新しい注文系 write を追加する場合は、既存 wrapper ではなく command service に追加する。
- `npm run check:order-command-boundary` を通す。

## 次の候補

- command ごとの返却値を整理する。
- Cloud Functions 化前に client command の emulator test を追加する。

## 検証

- `npm run check:order-command-boundary`
- `npm run check`
- `npx vite build`
