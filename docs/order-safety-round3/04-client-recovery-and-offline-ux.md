# 04 Client Recovery And Offline UX

## 目的

通信断、タイムアウト、リロード、ブラウザ戻る操作が起きても、保存済み注文をお客様側で失敗扱いにしない。未保存の場合だけ、再送できる表示にする。

## 想定する実店舗ケース

- 店内Wi-Fiや電波が弱く、送信後にレスポンスだけ失敗する。
- 注文送信中に画面を閉じる、リロードする。
- Functions は成功しているが、顧客端末が `complete` 画面へ進めなかった。
- 注文後の反映が数秒遅く、注文完了画面で「注文がありません」に見える。
- お客様が不安になって同じ注文を何度も押す。

## 現状確認

- `src/pages/order/CartPage.jsx` は送信中 request id を ref に保持するが、リロード後には消える。
- `src/pages/order/OrderCompletePage.jsx` は `clientRequestId` と注文状況表示を持つ。
- `src/components/order/OrderStatusList.jsx` は反映待ち表示を持つ。
- `src/services/orderCommandFailureService.js` は client-side failure log を持つ。

## 担当範囲

- `src/pages/order/CartPage.jsx`
- `src/pages/order/OrderCompletePage.jsx`
- `src/components/order/OrderSubmitCompleteScreen.jsx`
- `src/components/order/OrderStatusList.jsx`
- `src/services/customerCartService.js`
- `src/lib/orderCommandErrors.js`
- `scripts/check-customer-cart.mjs`
- `scripts/check-customer-order-status.mjs`

## 実装方針

1. 送信開始時の `clientRequestId` とカート内容を sessionStorage に一時保存するか、既存実装で同等に復旧できるか確認する。
2. 成功レスポンスを受ける前にリロードした場合、同じ `clientRequestId` の注文が反映済みか確認できる導線を作る。
3. `OrderCompletePage` では、直近 request id が反映されるまで「注文を反映しています」を出し、すぐに失敗扱いしない。
4. 一定時間後も反映されない場合だけ、再送可能な案内とスタッフ呼び出し導線を出す。
5. 顧客向け文言は、未保存と反映待ちを混同しない。

## 合格条件

- 保存済み注文を「注文できませんでした」と表示しない。
- 未保存の場合は、同じ request id で安全に再送できる。
- リロード後も、注文完了/反映待ち/再送のどれかに復旧できる。
- UIは既存の注文画面に自然に統合し、追加機能を表に出しすぎない。

## 検証コマンド

```bash
npm run check:customer-cart
npm run check:customer-order-status
npm run check:order-command-ui
npm run check
npm run build
```

## 完了時の報告

- 保存済み/未保存の判定方法:
  - 送信開始時に `clientRequestId`、`orderId`、`storeId`、`tableId`、カート内容を `sessionStorage` の復旧レコードへ保存する。
  - `OrderCompletePage` は購読した `orderItems` に同じ `clientRequestId` が出た時点で保存済み/反映済みと判定し、復旧レコードを削除する。
  - retryable な送信エラーは保存済みの可能性があるため、カート画面で失敗扱いにせず注文確認画面へ進める。non-retryable なエラーだけ未保存扱いで復旧レコードを削除する。
- リロード復旧の方法:
  - `CartPage` は同じ席/注文の復旧レコードを検出すると、保存済み確認のため `complete` へ遷移する。
  - `OrderCompletePage` は route state が失われても復旧レコードから直近 `clientRequestId` と品数を復元し、「注文を反映しています」を表示する。
- 顧客向け文言:
  - 反映待ちは「保存済みの可能性があるため、すぐに失敗扱いにはしません」と表示する。
  - 一定時間後は「未反映の場合だけ、同じ受付番号で再送できます」と表示し、未保存と反映待ちを分ける。
  - 反映後の完了画面は「注文確認にも反映しました」と表示し、一覧確認済みであることを伝える。
- 再送の安全性:
  - 再送ボタンは保存済み確認が一定時間続いた場合だけ表示する。
  - 再送は保存済みの `clientRequestId` とカートスナップショットを使うため、Functions/command 側の冪等 doc id により二重登録を避ける。
  - 再送後も同じ `clientRequestId` の反映を待ち、反映確認後に復旧レコードを削除する。
- 未解決リスク:
  - `sessionStorage` がブラウザ設定で使えない場合、route state の `clientRequestId` で反映確認はできるが、リロード後のカート内容再送までは復元できない。
  - Firestore の購読自体が長時間復旧しない端末では、スタッフ呼び出し導線で現場確認に逃がす。

## 実装結果

- `src/lib/customerSubmitRecovery.js` を追加し、顧客送信復旧レコードの作成、保存、読込、再送試行、反映済み、削除、遅延表示判定を集約した。
- `CartPage` は送信開始前に復旧レコードを保存し、retryable エラーまたはリロード後の保留状態では `complete` へ進んで反映確認する。
- `OrderCompletePage` は復旧レコードから直近 request id を復元し、同じ request id の orderItems が見えるまで反映待ち表示を維持する。
- 20秒経っても反映しない場合だけ、同じ request id での再送とスタッフ呼び出しを表示する。
- `OrderStatusList` と `OrderSubmitCompleteScreen` の文言を、反映待ち/反映済みの違いが分かる内容に変更した。

## 検証結果

- `git diff --check`: passed（CRLF変換警告のみ）
- `npm run check:customer-cart`: passed
- `npm run check:customer-order-status`: passed
- `npm run check:order-command-ui`: passed
- `npm run check`: passed
- `npm run build`: passed
