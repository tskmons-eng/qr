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
- `ordered`, `served`, `cancelled` の扱いを明確にし、キャンセルを隠すか表示するかは運用に合う形で決める。
- 追加注文送信直後は、送信した内容が反映待ちなのか、反映済みなのかが分かる表示を検討する。
- 新しい注文入口や別画面は増やさず、既存の注文確認導線に統合する。

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
