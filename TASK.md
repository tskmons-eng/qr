# いまの作業の理解確認

書き方は `.claude/skills/kakunin/SKILL.md`。「状態」が `OK` か `省略` でない間は、アプリのコードを書き換えられない（フックが止める）。

状態：省略
作業名：4桁パスを忘れたスタッフの再設定（省略の理由：ユーザー様が仕様をそのまま指示。注文・会計・集計のデータには触らない）
ユーザー様のOK：2026-10-22「When a staff member forgets their passcode, let a store manager or owner (Google login) set a new one without the current passcode. A staff member with the staff-management permission still needs the current passcode.」

## 何のために要るのか

柱3。パスを忘れたスタッフを、削除・作り直しをせずに戻せるようにする。店長・オーナー（Google ログイン）だけは今のパスなしで新しいパスを決められる。スタッフ管理の権限を持つスタッフは、今までどおり今のパスが要る。

## 実際にどう使われるか

## 裏で増える処理・既存機能への影響

## 一緒に要る機能／要らなくなる機能

## 使い回せる既存の部品・処理

## 作らない方がいい・別のやり方がいいと思う点

## 試作

## 章の分け方と本番に出す時点
