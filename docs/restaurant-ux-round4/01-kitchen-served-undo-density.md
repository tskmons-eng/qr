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
- Result: Added a command-backed latest-served undo bar to the kitchen screen and reduced kitchen card/grid spacing without shrinking base text size. Single-item and all-served actions store only the latest action from the current screen, and undo calls the existing ordered command path.
- Checks: `npm run check:kitchen-display`, `npm run check:order-command-ui`, `npm run check:order-functions-emulator`, `npm run check`, and `npm run build` passed.
- Remaining risk: The final cross-task release gate and production deploy are intentionally left to `07-integration-release-gate.md`.

## 2026-06-20 Live Feedback Rollback

- Finding: User feedback after the first implementation was that the kitchen panel felt better before the Round4 undo/density UI change.
- Fix: Reverted the Round4 kitchen undo bar and density styling back to the previous kitchen panel layout. Kept the safer Round3 served action behavior where an item disappears immediately after tapping served and is restored if the command fails.
- Data impact: UI only. No menu data, order history, QR URL, Firestore rules, indexes, storage, or Functions schema changes.
- Verification target: `npm run check:kitchen-display`, `npm run check:order-command-ui`, `npm run check`, `npm run build`, and final release gate.

## 2026-06-20 Crowded Table Visibility Fix

- Finding: If many items arrive from one table, a single kitchen card grows too tall and forces excessive page scrolling.
- Fix: Kitchen table cards now cap their height, keep the table header visible, and scroll only the item list inside the card. Crowded tables also span two columns on wider screens and render items in two columns to show more at once.
- Data impact: Kitchen UI only. Served/cancel commands, order data, menu data, order history, QR URL, Firestore rules, indexes, storage, and Functions are unchanged.
- Verification target: `npm run check:kitchen-display`, `npm run check:order-command-ui`, `npm run check`, `npm run build`, and Hosting-only deploy verification.

## 2026-06-20 Kitchen Item Detail Attribution

- Finding: Kitchen rows showed the generic label `スタッフ` because staff-added order items stored only `orderedBy: staff`; the active staff name was not passed into `orderItems`.
- Fix: New staff-added order items store `orderedByStaffId` and `orderedByStaffName`; kitchen rows prefer that name and fall back to `スタッフ` for older rows. Elapsed time is now a small higher-contrast chip, and option text is inline beside the product name/quantity instead of a separate row.
- Data impact: New order item metadata only. Existing order history, menu data, QR URLs, Firestore rules, indexes, and storage are unchanged.
- Deploy target: Hosting plus only `functions:submitStaffOrderItemsCommand`.
- Verification target: `npm run check:kitchen-display`, `npm run check:order-command-ui`, `npm run check:order-functions-mainline`, `npm run check:order-functions-emulator`, `npm run check`, and `npm run build`.
