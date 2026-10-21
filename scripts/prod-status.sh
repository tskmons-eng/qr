#!/usr/bin/env bash
# 本番（Firebase qrproduct-3340b）の状態を直接聞く。読むだけで、何も変えない。
# 手元の記録は別PC・別セッションの分を知らないので、本番の状態を話す前に必ずこれを実行する。
PROJECT=qrproduct-3340b
FB=firebase
if ! command -v firebase >/dev/null 2>&1; then
  FB=""
fi

echo "== GitHub（origin）の最新"
git fetch --quiet origin 2>/dev/null
git log -1 --format='%h %ad %s' --date=format:'%Y-%m-%d %H:%M' origin/main 2>/dev/null | sed 's/^/main: /'
git log -1 --format='%h %ad %s' --date=format:'%Y-%m-%d %H:%M' "@{u}" 2>/dev/null | sed 's/^/今のブランチの push 先: /'

if [ -z "$FB" ]; then
  echo "== Firebase CLI がこのPCに見つかりません。本番の状態は確かめられていません（推測で話さないこと）。"
  echo "   ユーザー様に Firebase CLI の導入（npm install -g firebase-tools）とログインをお願いする。"
  exit 1
fi

echo "== Hosting（live の最終公開）"
$FB hosting:channel:list --project "$PROJECT" 2>&1 | grep -E "live|Channel ID" || echo "取得できませんでした（firebase login を確認）"

echo "== Cloud Functions"
$FB functions:list --project "$PROJECT" 2>&1 | tail -n +1
