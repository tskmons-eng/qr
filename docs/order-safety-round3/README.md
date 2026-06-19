# Order Safety Round 3 - 実店舗シナリオ並列計画

目的: QRからの注文で「注文できませんでした」「注文が入らない」「反映されない」を売上事故として扱い、飲食店で実際に起きる同時操作・通信断・会計タイミングをシナリオ別に潰す。

## ユーザー様の重視点

- 注文エラーは売上に直結するため、いたちごっこの修正ではなく再現条件ごとに潰す。
- お客様がQRコードから注文した時、注文が保存済みなのに画面だけエラーになる状態を防ぐ。
- 同じ席で複数人がQR画面を開き、同時に注文しても成立することを確認する。
- 既存の注文履歴、会計履歴、メニュー、カテゴリ、オプション、QR URL は消さない。
- 本番利用中のため、deployは担当MD単独で行わず、最終ゲートでまとめて判断する。

## 現状の前提

- Production build は `src/services/orderFunctionCommandService.js` の `shouldUseOrderCommandFunctions()` により、明示 override がなければ Functions command を使う。
- `functions/orderCommandHandlers.js` では、顧客の注文開始と注文送信が Firestore transaction と `clientRequestId` による冪等処理へ寄っている。
- `firestore.rules` の legacy public write helper は lockdown stage で `false`。通常の注文 write は Functions command 経由。
- `scripts/check-order-functions-emulator.mjs` は既に、同時着席、重複送信、会計後の遅延送信、商品/カテゴリ store scope などを一部検証している。
- ただし、実店舗での「複数端末」「通信断」「タイムアウト後の再試行」「古いQR画面」「監視/復旧」の受け止め方は、さらに分野別に強化する。

## 並列MD

1. [01-customer-session-race.md](01-customer-session-race.md)
   - 同じ席で複数人が同時にQRを開き、注文開始するケース。

2. [02-submit-idempotency-and-retry.md](02-submit-idempotency-and-retry.md)
   - 複数人同時注文、連打、タイムアウト後再送、同じ `clientRequestId` の冪等性。

3. [03-checkout-and-stale-qr-races.md](03-checkout-and-stale-qr-races.md)
   - 会計処理、席リセット、古いQR画面、会計直後の遅延注文。

4. [04-client-recovery-and-offline-ux.md](04-client-recovery-and-offline-ux.md)
   - 注文が保存済みなのに画面だけエラーになる状態、通信断、リロード復旧。

5. [05-live-failure-monitoring-and-repair.md](05-live-failure-monitoring-and-repair.md)
   - `orderCommandFailures`、Functions logs、pending count 監査、復旧手順。

6. [06-load-release-gate.md](06-load-release-gate.md)
   - 上記を統合して本番へ出せるか判断する負荷・リリースゲート。

## 共通禁止事項

- 既存データを削除しない。
- `orders`, `orderItems`, `checks`, `products`, `categories`, `optionTemplates`, `tables`, `reservations` の一括移行・削除・破壊的更新をしない。
- QR URL を変える変更をしない。
- メニューや注文履歴を検証のために本番で書き換えない。
- 担当MD単独で本番 deploy しない。deploy は `06-load-release-gate.md` の合格後に行う。
- 本番確認が必要な場合は、read-only audit または明示的なテスト店舗/テーブルに限定する。

## 共通完了条件

- 担当MD内のシナリオが自動チェックで再現される。
- エラーを「出さない」だけでなく、出る場合は注文が未保存なのか、保存済みで表示復旧が必要なのかが判別できる。
- お客様向け画面には、保存済み注文を失敗扱いにする表示を出さない。
- `npm run check` が通る。
- `npm run build` が通る。
- 変更内容、検証結果、未解決リスクを担当MDに追記する。

