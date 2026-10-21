# 仕様の判断（なぜそうしたか）

今も効いている判断だけを書く。経緯の詳細は `docs/archive/reset-2026-10-21/` と `docs/<作業名>/`。
画面の好みは `.claude/rules/ui.md`。ここには書かない。

## 注文の届け方

- お客様の注文送信は東京の `submitCustomerOrderItemsCommandAsia` が本線。一時的な障害のときだけ米国の `submitCustomerOrderItemsCommand` へ、同じ `clientRequestId` で送り直す（二重注文にならない）。
- 注文開始 `startCustomerOrderSessionCommand` と東京の送信の2本だけ `minInstances: 1` で常時待機（2026-08-30）。待ち時間を減らすため。費用は Firebase の目安で月約16米ドル（無料枠の前）。ほかの17本は待機させない。
- 全 Functions は Node.js 22、256MiB、同時処理 80、`maxInstances: 20`。

## 権限とログイン

- 店舗の管理者メールを変えても店舗IDは移さない。`storeAdminEmails/{email}` が既存の `storeId` を指す形にし、古い `stores/{uid}` の持ち方も動かし続ける。
- スタッフ権限の項目が無い既存スタッフは、今までの現場の権限として扱う。メニュー管理・レジ締めなどの強い操作は、明示的にオンにしたときだけ。
- スタッフが同じ店の端末で一度4桁パスを通したら、次からは自動で入れる。スタッフ切り替え・ログアウト・パス変更・権限変更で、この近道は消える。
- `/owner` は固定のスーパー管理者だけ。スーパー管理者は店舗一覧から対象店舗を選び（`ownerActiveStoreId`）、その店のオーナーと同じ管理画面に入れる（2026-06-21）。通常のユーザーが同じ値を触っても無視し、rules は既存の `isSuper()` の範囲から広げない。
