# 08 Rules Lockdown

## 目的

注文 write を Functions command へ寄せた後、Firestore rules を段階的に締めて、ブラウザから任意の `orders` / `orderItems` を直接作れる状態を終わらせる。

## 前提

- 06 で Production の注文経路が Functions 本線になっていること。
- 07 で callable command の emulator 同時実行テストが通っていること。
- 11 の統合担当が Hosting / Functions / rules の deploy 順を管理すること。

## 担当範囲

- `firestore.rules`
- `scripts/check-functions-rules-migration.mjs`
- 必要なら新規 `scripts/check-order-rules-lockdown.mjs`
- `docs/order-reliability/11-integration-release.md` への rules deploy 注意点追記

## 段階方針

1. Compatibility stage
   - 既存公開クライアントが即死しない rules を維持する。
   - `orderCommandFailures` など観測用 collection の rules を整える。
   - Hosting を Functions runtime へ切り替える前に、rules だけ先に締めない。

2. Mainline stage
   - Functions command 経由の注文が Production で動いていることを確認する。
   - live logs と `orderCommandFailures` を確認し、旧 client write が残っていないか見る。

3. Lockdown stage
   - 新旧クライアント混在期間を置いた後、公開 `orders` / `orderItems` create/update を段階的に禁止する。
   - Staff/admin の必要な read 権限は壊さない。
   - Admin SDK 経由の Functions write は rules に依存しないため、Functions 内の権限チェックを前提にする。

## 完了条件

- rules の締め込み案が stage 別に分かれている。
- 旧 client が残る間に壊れる rules 変更が混ざっていない。
- rules 締め後に必要な customer/staff/admin read が残る。
- `npm run check:functions-rules-migration` または新規 rules lockdown check が通る。

## 禁止事項

- Hosting を Functions runtime に切り替える前に、公開注文 write を先に閉じない。
- read 権限を不用意に削って、スタッフ画面・キッチン・会計履歴を壊さない。
- データ削除や migration を rules 変更と同時に行わない。
- この分担単独で本番 deploy しない。
