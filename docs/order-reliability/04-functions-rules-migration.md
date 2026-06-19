# 04 Functions And Rules Migration

## 目的

最終的にブラウザから Firestore へ直接複数 write する構造をやめ、Cloud Functions command 経由へ移す。

## 現在の前提

- いまは client-side command/transaction まで完了。
- 既存 Firestore rules はすぐ締めない。
- 既存UIと既存データを保ったまま、次段階で Functions 化する。

## 移行順

1. Callable/HTTPS Functions に command API を追加する。
2. client-side command と同じ入力/返却形に揃える。
3. UIは同じ wrapper を呼び続け、内部だけ Functions 呼び出しへ差し替える。
4. emulator で同時操作テストを通す。
5. 新旧クライアントが混在しても壊れない期間を置く。
6. 最後に Firestore rules を段階的に締める。

## 禁止事項

- Functions deploy を勝手に行わない。
- rules を先に締めない。
- `orders create: true` / `orderItems create: true` を現行クライアント対応前に削らない。
- データ migration を同時に混ぜない。

## 検証

- Emulator Functions test
- Firestore rules test
- `npm run check`
- `npx vite build`
- 明示許可後の staging / production deploy 確認
