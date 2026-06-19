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
- リロード復旧の方法:
- 顧客向け文言:
- 再送の安全性:
- 未解決リスク:

