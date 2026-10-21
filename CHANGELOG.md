# 変更の記録

本番に出したもの・日付・確認結果を新しい順に短く書く。
2026-10-21 より前の記録は `docs/archive/reset-2026-10-21/plan.MD`。

## 2026-10-21 品目の取消を店の共通パスコードで使えるようにする（K1）

- 設定画面に「取消パスコード」を追加。ハッシュで `storeSecrets/{storeId}` に保存し、照合は `cancelOrderItemCommand` で行う。5回続けて間違えると10分ロック。
- メニュー管理の権限がある人と Google ログインの店舗管理者はパスコード不要。席詳細と厨房で同じ取消モーダルを使う（厨房の標準ダイアログは廃止）。
- コミット `00fc5e8`。本番へ Firestore rules → Functions `setCancelPasscodeCommand`（新規）・`cancelOrderItemCommand` → Hosting の順に公開。
- 確認：`npm run check`（40件）・`npm run build`・エミュレーターの同時実行チェック（パスコード・ロックを含む）成功。本番の主要6画面は 200、配信ファイルは手元のビルドと一致。公開後の注文処理の失敗ログは増えていない。
- 公開直後から、メニュー管理の権限が無い人の取消にはパスコードが要る（未設定の間は権限のある人だけ）。

## 2026-10-21 税率の初期値を 10% にそろえる（K2）

- 設定を保存していない店で、設定画面は 10%・会計は 0% と食い違っていたのを、`settingsConfig.js` の1か所（10%）にそろえた。金額は変わらず、会計の「内消費税」の表示だけが変わる。
- コミット `607ffe6`。Hosting だけを `qrproduct-3340b` に公開。Functions・rules・データは変更なし。
- 確認：`npm run check`・`npm run build` 成功。本番の `index` の配信ファイルが手元のビルドと一致。`/`・`/login`・`/staff`・`/admin`・`/order/test-token` はすべて 200。

## 2026-10-21 指示書の作り直し

- 旧 `AGENTS.md`・`plan.MD`・`MAINTENANCE_PLAN.md` を `docs/archive/reset-2026-10-21/` へ移し、`AGENTS.md`・`CLAUDE.md` を作り直した（タグ `qr-before-md-reset-20261021`）。
- 理解確認（`TASK.md`・kakunin スキル）、本番反映の手順（honban スキル）、フック（`scripts/task-gate.py` ほか）を追加した。
- アプリの動作は変えていないため、本番反映は不要。
