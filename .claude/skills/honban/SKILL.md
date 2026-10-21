---
name: honban
description: QRシステムの変更を確認・コミット・push・Firebase 本番反映・本番確認・記録まで最後まで通すときに使う。実装とレビューが終わったとき、「本番に出して」「デプロイして」と言われたときに使う。
---

# 本番への出し方（毎回最後まで）

ユーザー様の方針は「毎回最後まで出す」。ただし章に分けた大きな作業の途中の章は出さない（`TASK.md` の「章の分け方と本番に出す時点」に従う）。
本番が止まると店の損害になるので、下の止まる場所では必ず止まる。

## 手順

1. `TASK.md` の状態が `OK` か `省略` であることを確かめる。違えば kakunin スキルへ戻る。
2. 確認を走らせる：`npm run check` と `npm run build`。注文・会計・Functions に触ったなら `npm run check:order-functions-emulator` も。
   **止まる場所**：1つでも失敗したら出さない。失敗した名前と内容をユーザー様に伝える。
3. `git status --short --branch` で、自分の変更だけをコミットし push する。push できなければ止めて報告する。
4. `bash scripts/prod-status.sh` で、出す前の本番の状態を見る。
5. 変わったものだけを出す。
   - 画面：`firebase deploy --only hosting --project qrproduct-3340b`
   - Functions：`firebase deploy --only functions:<名前> --project qrproduct-3340b`（対象を1本ずつ。全体デプロイはしない）
   - rules：`firebase deploy --only firestore:rules`（または `storage`）
   **止まる場所**：Firebase CLI が費用の増加や削除の確認を出したら、内容をユーザー様に見せて聞く。`--force` を自分の判断で付けない。
   **止まる場所**：営業中の店に影響が出る変更（注文・会計の流れ、rules）は、出す時間帯をユーザー様に確かめる。
6. `bash scripts/prod-status.sh` をもう一度実行し、出したものが本番に反映されたことを確かめる。本番にダミー注文は送らない。
   注文まわりを出した後は `npm run audit:command-failures` で失敗が増えていないか見る。
7. `CHANGELOG.md` に、日付・出したもの（Hosting／Functions の名前／rules）・コミット・確認結果を短く書き、コミットして push する。
8. `TASK.md` を「状態：なし」に戻す（章の途中なら戻さない）。
9. ユーザー様へ「ローカル」「GitHub に push 済み」「Firebase にデプロイ済み」を分けて報告する。

## 戻すとき

問題が出たら、出す前のコミットに戻した版を同じ対象だけ出し直す。Hosting は Firebase コンソールの公開履歴からも戻せる。データは巻き戻さない。
