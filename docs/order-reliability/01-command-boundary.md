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
- `src/lib/orderCommands.js`
- `src/lib/orderCommandPayloads.js`
- `scripts/check-order-command-boundary.mjs`

## 作業ルール

- UIから直接 `orderItems`, `orders`, `tables.pendingCount` を複数箇所で更新する形に戻さない。
- command は現在状態を transaction 内で読む。
- `pendingCount` は現在の `itemStatus` に基づいて一度だけ増減する。
- 新しい注文系 write を追加する場合は、既存 wrapper ではなく command service に追加する。
- `npm run check:order-command-boundary` を通す。

## 次の候補

- command 層のエラー記録を追加する。
- command ごとの返却値を整理する。
- Cloud Functions 化前に client command の emulator test を追加する。

## 検証

- `npm run check:order-command-boundary`
- `npm run check`
- `npx vite build`
