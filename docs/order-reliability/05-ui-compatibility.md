# 05 UI Compatibility

## 目的

注文処理の中核を直しながら、利用中の顧客画面・スタッフ画面・管理画面の導線を壊さない。

## 守る導線

- 顧客 QR 入店
- 人数入力
- メニュー表示
- カート注文
- 注文完了
- 呼び出し / 会計希望
- スタッフ着席
- スタッフ追加注文
- キッチン提供済み
- 席詳細キャンセル
- 席移動
- 会計

## 作業ルール

- 既存 route を不用意に変えない。
- 既存ボタン配置を大きく変えない。
- ブラウザ標準 `alert` / `confirm` の増加は避ける。既存UI改善時はコンポーネント化する。
- command 層のエラーはユーザー向けには短く、管理/調査向けには記録できる形にする。

## 次の候補

- command error code ごとの表示文言を整理する。
- 注文失敗時の再試行導線を顧客/スタッフで統一する。
- 席移動失敗時に「席が既に埋まった」など具体的に出す。

## 2026-06-19 実装メモ

- `src/lib/orderCommandErrors.js` を追加し、command error code を短いユーザー向け文言へ変換する。
- `src/components/OrderCommandErrorNotice.jsx` を追加し、顧客/スタッフの既存アクション周辺へ同じ見た目でエラーを出す。
- 顧客の人数入力、顧客カート、スタッフ追加注文、スタッフ着席、席詳細の提供済み/戻し/キャンセル、席移動、キッチン提供済み/削除、会計で command 失敗をインライン表示する。
- 注文送信の `clientRequestId` は失敗時に保持し、既存ボタンから再送できる状態を保つ。
- 席移動の `target-table-not-vacant` は「移動先の席がすでに埋まっています」と表示する。
- command service 側の `orderCommandFailures` 記録と重複しないよう、UI側は表示文言と軽い console 調査情報に限定する。
- 既存 route、下部ナビ、注文ボタン位置、管理画面導線は変更しない。
- 本番 deploy は行わない。

## 検証

- `npm run check`
- `npm run check:order-command-ui`
- `npm run build`
- 主要ルートの手動確認
- 本番 deploy は明示許可後のみ

## 2026-06-19 検証結果

- `npm run check:customer-entry` passed.
- `npm run check:customer-cart` passed.
- `npm run check:staff-table-detail` passed.
- `npm run check:kitchen-display` passed.
- `npm run check:order-command-ui` passed.
- `npm run check` passed.
- `npm run build` passed.
- Local Vite dev server: `http://127.0.0.1:5174/`
- `/`, `/staff`, `/staff/kitchen` は HTTP 200 を確認。
- 本番 deploy は未実行。
