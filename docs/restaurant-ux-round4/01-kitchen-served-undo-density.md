# 01 Kitchen Served Undo And Density

## Purpose

キッチンパネルで間違えて「提供済み」を押した直後に、1つ前へ戻せるようにする。
同時に、文字サイズは維持したまま余白を詰めて一度に見える注文量を少し増やす。

## Safety Judgment

安全に設計できるため追加してよい。
理由は、既存に `markOrderItemOrderedCommand` があり、提供済みを `ordered` に戻す command 経路がすでにあるため。
ただし、ローカル表示だけを戻す実装は禁止。必ず command を呼び、失敗時はUndo表示も戻す。

## Current Confirmation

- キッチンの提供済みは `src/pages/kitchen/KitchenPage.jsx` から `markKitchenItemServed()` / `markKitchenItemsServed()` を呼んでいる。
- `src/services/orderItemCommandService.js` には `markOrderItemOrderedCommand()` がある。
- `functions/orderCommandHandlers.js` には `markOrderItemOrderedCommand` があり、`served` の item だけ `ordered` に戻す。
- `scripts/check-order-functions-emulator.mjs` は served/revert の二重実行で pendingCount が壊れないことを検証している。

## Change Plan

- `src/services/kitchenService.js` に `markKitchenItemOrdered(item)` を追加し、既存 command を使う。
- `KitchenPage.jsx` に直近の提供済み操作を1件だけ保持するUndo状態を追加する。
- 単品提供済みは1 item、全提供済みは対象item群をUndo対象にする。
- Undoボタンはキッチンヘッダー直下かエラー通知付近にコンパクトに表示する。
- Undo成功後はUndo状態を消す。Undo失敗時はエラーを表示し、対象は現在の購読状態に任せる。
- 表示密度は `src/styles/staff-kitchen-layout.css` と必要なキッチン行/カードCSSだけで調整する。
- 文字サイズは原則維持し、padding、gap、行高、カード内余白で調整する。

## Hard Requirements

- 会計済み、キャンセル済み、存在しないitem、別table itemは command 側の拒否に任せ、UIで握りつぶさない。
- Undo可能なのは「この画面で直近押した提供済み」だけ。古い履歴一覧から自由に戻す機能にはしない。
- `pendingCount` を画面側で直接増減しない。
- `orderItems` を直接 `updateDoc` しない。
- 「全提供済み」のUndoは、対象が一部だけ失敗しても結果を曖昧にしない。失敗時はエラー表示し、購読結果を正とする。

## Impact Scope

- `src/pages/kitchen/KitchenPage.jsx`
- `src/services/kitchenService.js`
- `src/lib/kitchenDisplay.js` if small helper extraction is needed
- `src/components/staff/KitchenHeader.jsx` or a small new kitchen undo component
- `src/styles/staff-kitchen-layout.css`
- `scripts/check-kitchen-display.mjs`
- `scripts/check-order-command-ui.mjs`
- this MD

## Verification

- `npm run check:kitchen-display`
- `npm run check:order-command-ui`
- `npm run check:order-functions-emulator`
- `npm run check`
- `npm run build`

## Completion Notes

- Production deploy: not run in this task.
- Result:
- Checks:
- Remaining risk:

