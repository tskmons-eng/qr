# QR注文信頼性改善 並列作業インデックス

目的: 混雑時に注文が入らない・反映されない問題を、既存データ・履歴・メニュー・既存UIを壊さずに根本から改善する。

## 絶対条件

- Firestore の既存データを削除しない。
- `orders`, `orderItems`, `checks`, `staffActions`, `products`, `categories`, `optionTemplates`, `tagTemplates`, `tables`, `reservations` の履歴やメニュー資産を勝手に移行・一括更新・削除しない。
- 各分担MD単独では本番 deploy しない。deploy は [11-integration-release.md](11-integration-release.md) の統合担当が検証結果をそろえてから行う。
- UI/ルートは既存導線を保つ。今回の主対象は注文処理の実行経路、同時実行、失敗観測、rules、復旧手順。
- 旧来の client transaction 経路を「通常運用の既定」として残して完了扱いにしない。Production の注文経路は Functions command を本線にする。

## 2026-06-19 Round 2 方針

前回の `VITE_ORDER_COMMAND_RUNTIME=functions` opt-in は、本番データ・既存利用者・未検証deployを守るための安全弁だった。  
ただし、ユーザー様の現在の目的は「注文が入らない・反映されない状態を止めること」なので、opt-in のままでは改善完了ではない。

Round 2 の完了条件:

- 顧客注文、スタッフ注文、着席、提供済み/戻し、キャンセル、会計、席移動が、Production build で Cloud Functions command 経由になる。
- client command は local/dev/rollback 用に限定し、Production の通常経路として曖昧に残さない。
- Emulator で callable command の同時実行テストを追加し、mock だけで完了しない。
- Functions 側で失敗を記録し、注文が入らなかった原因を後から追える。
- 既存データを消さず、必要な修復は dry-run と監査結果を経由する。
- 新旧クライアント混在期間を考慮して、rules 締め込みは deploy 順と監視結果に基づいて段階的に行う。

## Round 1 完了MD

1. [01-command-boundary.md](01-command-boundary.md)
   - 注文処理を command 層へ集約した分野。
   - client-side command 境界と失敗ログの土台。

2. [02-data-preservation.md](02-data-preservation.md)
   - データ履歴・メニュー保護の分野。
   - 削除禁止、移行禁止、読み取り監査。

3. [03-concurrency-tests.md](03-concurrency-tests.md)
   - 混雑時・連打・再送・同時操作の検証分野。
   - 現状は in-memory mock と source guard が中心。

4. [04-functions-rules-migration.md](04-functions-rules-migration.md)
   - Functions callable command の準備段階。
   - このMDは Round 1 の opt-in 準備記録。Round 2 では 06 以降を優先する。

5. [05-ui-compatibility.md](05-ui-compatibility.md)
   - 既存UI/導線維持の分野。
   - command error を既存画面へ出す土台。

## Round 2 並列MD

1. [06-functions-mainline.md](06-functions-mainline.md)
   - Production の注文経路を Functions command 本線へ切り替える実装担当。

2. [07-functions-emulator-concurrency.md](07-functions-emulator-concurrency.md)
   - Callable Functions を Firebase Emulator 上で同時実行検証する担当。

3. [08-rules-lockdown.md](08-rules-lockdown.md)
   - 新旧クライアント混在を考慮して Firestore rules を段階的に締める担当。

4. [09-live-observability.md](09-live-observability.md)
   - 注文失敗の記録、調査、復旧確認を整える担当。

5. [10-data-consistency-repair.md](10-data-consistency-repair.md)
   - 履歴・メニューを消さず、注文表示ズレを監査/修復する担当。

6. [11-integration-release.md](11-integration-release.md)
   - 06〜10 の統合、検証、deploy順、rollback を担当する最終ゲート。

## 現在の到達点

- 注文開始、お客様注文、スタッフ注文、スタッフ着席、会計、キャンセル、提供済み、提供済み戻し、席移動は command/transaction 境界へ寄せた。
- `npm run check` と `npx vite build` は通過済み。
- Functions callable command は opt-in runtime として追加済み。
- 本番 deploy、Firestore データ削除、Firestore migration、rules 締め込みは未実施。
- ここからは「Functions を用意した」ではなく「Functions を本番注文経路にする」ことを完了条件にする。
