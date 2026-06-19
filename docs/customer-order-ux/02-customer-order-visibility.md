# 02 Customer Order Visibility

## 目的

お客様の注文確認画面で、過去に頼んだ商品と現在の状態を分かりやすく表示する。

## 現状確認

- `OrderCompletePage` は `subscribeCustomerOrderItems(orderId, setItems)` で現在の `orderItems` を購読している。
- `customerOrderStatusService.js` は `itemStatus !== 'cancelled'` の明細だけを表示対象にしている。
- `OrderStatusList` は商品名、数量、状態ラベル、価格を表示できるが、注文済み/未反映/キャンセルの境界が弱い。
- 送信直後のカート内容と、Firestoreへ反映された注文済み明細の差分表示はない。

## 変更方針

- 注文確認画面を、注文済み一覧として理解できる見出し・状態別表示へ整理する。
- `ordered`, `served`, `cancelled` の扱いを明確にし、キャンセルは履歴として表示する。
- 追加注文送信直後は、送信した内容が反映待ちなのか、反映済みなのかが分かる表示にする。
- 新しい注文入口や別画面は増やさず、既存の注文確認導線に統合する。

## 実装決定

- `cancelled` の明細は非表示にしない。お客様が「注文済みだったがスタッフによりキャンセルされた」履歴を確認できるようにする。
- キャンセル明細は合計金額と注文数から除外し、明細価格欄は `会計対象外` と表示する。
- 確認画面の一覧は `準備中`、`提供済み`、`キャンセル` の状態別セクションに分ける。
- 追加注文送信後は、カート送信時の `clientRequestId` を完了画面へ渡し、Firestoreに反映された行へ `今回追加` ラベルを出す。
- `showServedStatus` が無効な店舗では、提供済みを個別表示せず、注文済みセクションへまとめて既存設定を尊重する。

## 実装内容

- `customerOrderStatusService.js` で `cancelled` を除外せず、共通ソート関数で購読結果を整える。
- `customerOrderStatus.js` に状態正規化、状態別グループ、キャンセル除外の合計計算、最新送信リクエスト反映判定を追加する。
- `OrderCompletePage` に反映待ち/反映済みの案内を追加し、最新送信リクエストを保持する。
- `OrderStatusList` をフラット表示から状態別セクション表示へ変更し、キャンセル行と今回追加ラベルを出す。
- `OrderStatusSummary` はキャンセル件数も必要時だけ表示する。

## 影響範囲

- `src/pages/order/OrderCompletePage.jsx`
- `src/components/order/OrderStatusList.jsx`
- `src/lib/customerOrderStatus.js`
- `src/services/customerOrderStatusService.js`
- `scripts/check-customer-order-status.mjs`

## 検証方法

- `npm run check:customer-order-status`
- `npm run check:customer-cart`
- `npm run check:customer-entry`
- `npm run check`
- `npm run build`

## 検証結果

- `npm run check:customer-order-status` passed.
- `npm run check:customer-cart` passed.
- `npm run check:customer-entry` passed.
- `npm run check` passed.
- `npm run build` passed.
- Firebase deploy は実行していない。
