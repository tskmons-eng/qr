# 07 Kitchen Served Optimistic UI

## 目的

キッチンパネルの「提供済み」操作で、処理完了まで行が残り続けるストレスを減らす。安全性は Functions command と失敗時 rollback で守りつつ、UI は押した瞬間に一度消して、処理できなかった場合だけ元に戻す。

## ユーザー様の重視点

- 処理が本当に完了するまで消えない安全性は大事。
- ただし、現場で使う側には押しても残り続ける挙動が遅く感じられる。
- 押した瞬間に一度消し、失敗した場合だけ戻すことで、失敗防止と操作感を両立したい。

## 想定する実店舗ケース

- キッチン担当が忙しい時間帯に、複数の「提供済み」ボタンを連続で押す。
- 「全提供」を押した後、Functions の一部処理だけ失敗する。
- 通信が遅く、Firestore の購読反映まで数秒かかる。
- 別スタッフが同じ注文を先に提供済みにしている。
- 失敗して戻った注文を見落とさず、もう一度操作できる。

## 現状確認

- UI: `src/pages/kitchen/KitchenPage.jsx`
- 表示: `src/components/staff/KitchenTableGrid.jsx`, `src/components/staff/KitchenTableCard.jsx`, `src/components/staff/KitchenItemRow.jsx`
- Command: `src/services/kitchenService.js`
- Functions: `functions/orderCommandHandlers.js` の `markOrderItemServedCommand()` / `markOrderItemsServedCommand()`
- Existing check: `scripts/check-kitchen-display.mjs`, `scripts/check-order-functions-emulator.mjs`

現状は `markKitchenItemServed()` / `markKitchenItemsServed()` の完了後、Firestore subscription が `itemStatus == ordered` から外れることで表示が消える。つまり安全だが、購読反映まで行が残る。

## 担当範囲

- `src/pages/kitchen/KitchenPage.jsx`
- `src/components/staff/KitchenTableGrid.jsx`
- `src/components/staff/KitchenTableCard.jsx`
- `src/components/staff/KitchenItemRow.jsx`
- `src/lib/kitchenDisplay.js`
- `scripts/check-kitchen-display.mjs`
- 必要なら `scripts/check-order-command-ui.mjs`

## 実装方針

1. `KitchenPage` に optimistic served state を追加する。
   - 例: `optimisticServedItemIds` または `optimisticHiddenItemIds`
   - item単位と「全提供」の複数itemに対応する。
2. 表示用 `pendingItems` は、Firestore購読結果から optimistic hidden item を除いたものを使う。
3. 「提供済み」押下時:
   - すぐに対象 item id を optimistic hidden に入れる。
   - command 実行中でも行は一旦消える。
   - command 成功後は購読反映に任せ、optimistic state を掃除する。
4. command 失敗時:
   - 対象 item id を optimistic hidden から外す。
   - 既存の `OrderCommandErrorNotice` に失敗メッセージを出す。
   - `logOrderCommandError()` は維持する。
5. Firestore購読側で対象itemが実際に消えた場合:
   - optimistic state から不要な id を掃除する。
6. 別スタッフが先に提供済みにしたなど、commandが冪等成功になる場合:
   - UIは戻さず、そのまま消えた状態を維持する。
7. 「全提供」の一部だけ失敗する設計にする場合は、成功分は消したまま、失敗分だけ戻す。ただし現Functionsが一括transactionで全体成功/失敗なら、全体 rollback でよい。

## 合格条件

- 「提供済み」を押した瞬間、対象行がキッチンパネルから消える。
- Functions command が失敗したら、対象行が戻る。
- 成功時に二重で消えたり、購読反映で戻ったりしない。
- 連打しても `pendingCount` が二重減算されない既存保証を壊さない。
- 「全提供」でも同じ optimistic hide / rollback が動く。
- 既存のエラー表示と failure log を維持する。

## 検証コマンド

```bash
npm run check:kitchen-display
npm run check:order-command-ui
npm run check:order-functions-emulator
npm run check
npm run build
```

## 完了時の報告

- item単位の optimistic hide: `KitchenPage` の `handleMarkServed()` で押下直後に対象 `item.id` を `optimisticHiddenItemIds` へ追加し、表示用 `visiblePendingItems` から除外する。
- 全提供の optimistic hide: `handleMarkAllServed()` で対象行の `item.id` 一覧をまとめて optimistic hidden に入れ、テーブルカード単位で即時に消えるようにする。
- 失敗時 rollback: `markKitchenItemServed()` / `markKitchenItemsServed()` の `catch` で対象IDを hidden から外し、既存の `OrderCommandErrorNotice` と `logOrderCommandError()` を維持する。
- Firestore購読反映後の state cleanup: `pendingItems` 更新時に `pruneOptimisticHiddenKitchenItemIds()` で、購読結果から消えたIDを optimistic state から掃除する。
- pendingCount / Functions 冪等性への影響: Functions command、`pendingCount` 更新、Firestore rules は変更せず、購読結果から作る表示データだけを filtered view にした。成功時は購読反映を source of truth とし、二重減算の経路は増やしていない。
- 検証結果:
  - `npm run check:kitchen-display`: passed
  - `npm run check:order-command-ui`: passed
  - `npm run check`: passed
  - `npm run build`: passed
  - `git diff --check`: passed
  - `npm run check:order-functions-emulator`: failed outside 07 scope. Existing uncommitted 01 race scenario now fires 50 concurrent `startCustomerOrderSessionCommand` calls, Firestore Emulator exited with code `4294967295`, and all 50 calls returned `internal`.
- 未解決リスク: ブラウザ実機操作での視覚確認と Firebase deploy は未実施。Round 3 共通方針どおり、本番 deploy は `06-load-release-gate.md` の最終ゲート後に判断する。
