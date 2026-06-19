# 06 Load Release Gate

## 目的

01〜05 と 07 の成果を統合し、飲食店の混雑時に本番へ出してよいかを判断する最終ゲートにする。ここを通らない変更は本番 deploy しない。

## ゲート対象

- 同じ席で複数人が同時に注文開始する。
- 同じ席で複数人が同時に注文送信する。
- 同じ端末が連打・再送する。
- 注文送信と会計が競合する。
- 古いQR画面から再送される。
- 通信断/リロード後に保存済み注文を失敗扱いしない。
- キッチンの「提供済み」は押下直後に一度消え、失敗時だけ戻る。
- 失敗が出た場合に原因を追える。

## 統合前条件

- 01〜05 と 07 の担当MDが更新済み。
- 01〜05 と 07 の担当が commit/push 済み。
- `git status --short --branch` が clean。
- `npm run check` が通る。
- `npm run build` が通る。
- `npm run check:order-functions-emulator` が通る。
- read-only audit で直近の重大な order command failure を確認済み。

## 本番 deploy 方針

1. Functions / rules 差分があるかを確認する。
   - `git diff --name-status <live-base>..HEAD -- functions firestore.rules firebase.json storage.rules firestore.indexes.json`
2. Functions 差分がある場合:
   - 注文 command Functions だけを明示 deploy する。
   - 既存予約通知や集計 Functions を巻き込む全Functions deployを避ける。
3. Firestore rules 差分がある場合:
   - `npm run check:order-rules-lockdown` を通す。
   - legacy client 影響を確認してから deploy する。
4. Hosting 差分だけの場合:
   - `npm run build`
   - `npx --yes firebase-tools deploy --project qrproduct-3340b --only hosting --non-interactive`
5. deploy 後:
   - 本番HTMLが新アセットを返すこと。
   - `/login`, `/admin`, `/staff`, `/staff/kitchen`, `/order/test-token` が 200。
   - Functions logs に注文 command の起動エラーがないこと。
   - `audit:command-failures` と `audit:pending-counts` を確認すること。

## rollback 方針

- Hostingのみ問題:
  - 直前Hostingの正常ビルドへ戻す。
- Functions問題:
  - Functions logs と `orderCommandFailures` を保存し、原因箇所だけ戻す。
- rules問題:
  - lockdown helper を compatibility 側に戻す。
- データ問題:
  - 削除しない。read-only audit と dry-run repair で差分を確認してから限定修復する。

## 合格条件

- お客様の注文が `orderItems` に保存され、スタッフ/キッチンへ反映される。
- 同時注文・再送・会計競合のテストが通る。
- 保存済み注文を顧客画面が失敗扱いにしない。
- キッチン提供済み操作は optimistic hide / rollback で操作感と安全性を両立している。
- 失敗時は `orderCommandFailures` / Functions logs / audit で追跡できる。
- データ履歴、会計履歴、メニュー、QR URL を壊していない。

## 完了時の報告テンプレート

- 統合した担当MD:
- deploy対象:
- 実行した check:
- 本番 smoke:
- `orderCommandFailures`:
- `audit:pending-counts`:
- rollback方法:
- 監視継続点:
