# QR注文信頼性改善 並列作業インデックス

目的: 混雑時に注文が入らなくなる問題を、既存データ・履歴・メニュー・既存UIを壊さずに根本から改善する。

## 絶対条件

- Firestore の既存データを削除しない。
- `orders`, `orderItems`, `checks`, `staffActions`, `products`, `categories`, `optionTemplates`, `tagTemplates` の履歴やメニュー資産を勝手に移行・一括更新・削除しない。
- 本番 deploy は、明示指示と検証完了があるまで行わない。
- UI/ルートは既存導線を保ち、まず注文処理の中核だけを安定化する。

## 分野別MD

1. [01-command-boundary.md](01-command-boundary.md)
   - 注文処理を command 層へ集約する分野。
   - 現在の client-side command 層と残作業を扱う。

2. [02-data-preservation.md](02-data-preservation.md)
   - データ履歴・メニュー保護の分野。
   - 削除禁止、移行禁止、データ保全チェックを扱う。

3. [03-concurrency-tests.md](03-concurrency-tests.md)
   - 混雑時・連打・再送・同時操作の検証分野。
   - Emulator/回帰テストの追加を扱う。

4. [04-functions-rules-migration.md](04-functions-rules-migration.md)
   - 将来の Cloud Functions 化と Firestore rules 締め込み分野。
   - 現段階では deploy しない。

5. [05-ui-compatibility.md](05-ui-compatibility.md)
   - 既存UI/導線維持の分野。
   - 見た目を壊さず、注文中核変更をユーザー体験へ安全に接続する。

## 現在の到達点

- 注文開始、お客様注文、スタッフ注文、スタッフ着席、会計、キャンセル、提供済み、提供済み戻し、席移動は command/transaction 境界へ寄せた。
- `npm run check` と `npx vite build` は通過済み。
- 本番 deploy、Firestore データ削除、Firestore migration、rules 締め込みはしていない。
- Functions callable command は opt-in runtime として追加済み。現行既定は client transaction のままで、rules 締め込みと deploy は未実施。
