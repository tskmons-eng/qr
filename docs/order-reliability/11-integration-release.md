# 11 Integration Release

## 目的

06〜10 の成果を統合し、Functions command を Production の注文本線として安全に反映する。  
並列担当が個別に deploy して順序事故を起こさないよう、このMDを最終ゲートにする。

## 統合前チェック

- `git status --short --branch` が clean。
- 06〜10 の担当が commit/push 済み。
- `npm run check` が通る。
- `npx vite build` が通る。
- Functions 関連の `node --check` が通る。
- 07 の emulator callable concurrency check が通る。
- 10 の read-only audit 結果を確認し、既存データ削除やメニュー変更が不要であることを確認する。

## deploy 順

1. Functions deploy
   - 既存予約通知や集計 Functions を巻き込む全Functions deployをしない。
   - `npx --yes firebase-tools functions:list --project qrproduct-3340b` で既存関数の region を確認する。
   - 2026-06-19 確認時点では、`notifyReservationCreated` と `syncTablePendingAggregateOn*` は `asia-northeast1`、`notifyStaff` と `processReservationArrivals` は `us-central1`。
   - 注文 callable は `us-central1` で出す。
   - 初回 deploy は以下のように注文 command だけを明示する。

```bash
npx --yes firebase-tools deploy --project qrproduct-3340b --only functions:startCustomerOrderSessionCommand,functions:submitCustomerOrderItemsCommand,functions:submitStaffOrderItemsCommand,functions:seatStaffOrderSessionCommand,functions:completeCheckoutCommand,functions:markOrderItemServedCommand,functions:markOrderItemsServedCommand,functions:markOrderItemOrderedCommand,functions:cancelOrderItemCommand,functions:moveTableOrderCommand --non-interactive
```

   - deploy 後に callable command export がすべて作成/更新されることを確認する。
   - 既存予約通知や集計 Functions を消さない。

2. Functions smoke check
   - `firebase functions:list` または同等手段で export を確認する。
   - Emulator ではなく live project の logs に deploy 後の起動エラーがないか確認する。
   - 可能なら test store/table で注文 command の end-to-end を確認する。

3. Hosting build/deploy
   - Production build が Functions runtime を使う状態で build する。
   - 顧客QR、カート送信、スタッフ注文、キッチン、会計の主要導線を確認する。

4. Monitoring window
   - `orderCommandFailures`
   - Functions logs
   - `audit:pending-counts`
   - スタッフ画面/キッチン反映
   を確認する。

5. Rules compatibility deploy
   - まず互換 rules を deploy する。
   - 新旧クライアント混在が落ち着くまで、公開 write の完全遮断は急がない。
   - `legacyPublicOrderWritesAllowed()` は `true` のままにする。
   - `legacyPublicTableOccupyAllowed()` は `true` のままにする。
   - この段階では `orders` / `orderItems` create と旧QRの table occupy update をまだ閉じない。

6. Rules lockdown deploy
   - 旧 client write が残っていないことを確認してから公開 `orders` / `orderItems` write を段階的に閉じる。
   - `legacyPublicOrderWritesAllowed()` を `false` にする。
   - `legacyPublicTableOccupyAllowed()` を `false` にする。
   - deploy 前に `npm run check:order-rules-lockdown` を実行する。
   - deploy 後に顧客QR、スタッフ注文、キッチン、会計の主要導線と `orderCommandFailures` を確認する。

## rollback

- Functions deploy 後に Hosting をまだ切り替えていない場合:
  - Hosting はそのまま。Functions は追加されたままでも通常 UI には影響しない。

- Hosting 切替後に注文失敗が増えた場合:
  - `VITE_ORDER_COMMAND_RUNTIME=client` の rollback build を作り、Hosting だけ戻す。
  - rules lockdown 前なら旧 client command が使える。
  - failure logs と Functions logs を保存して原因を調査する。

- rules lockdown 後に旧 client 影響が出た場合:
  - rules を compatibility stage に戻す。
  - `legacyPublicOrderWritesAllowed()` と `legacyPublicTableOccupyAllowed()` を `true` に戻す。
  - Hosting runtime と failure logs を確認する。
  - 必要なら `VITE_ORDER_COMMAND_RUNTIME=client` の rollback build をHostingへ戻す。

## 完了条件

- 実際の顧客注文が Functions command 経由で `orderItems` に入り、スタッフ/キッチンへ反映される。
- スタッフ注文、提供済み/戻し、キャンセル、会計、席移動が Functions command 経由で動く。
- 注文失敗時に `orderCommandFailures` または Functions logs で原因を追える。
- `audit:pending-counts` で重大なズレがない。
- データ履歴、メニュー、会計履歴を削除していない。

## 報告テンプレート

- deploy した対象:
- 実行した check:
- live smoke の結果:
- `orderCommandFailures` の確認結果:
- `audit:pending-counts` の結果:
- rollback 方法:
- 未完了/監視継続点:
