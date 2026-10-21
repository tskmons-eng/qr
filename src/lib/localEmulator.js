// 手元のテスト環境（Firebase エミュレーター）につなぐかどうか。
// 開発用の起動（npm run dev:local）だけで true になる。本番ビルドでは必ず false（本番のお店には届かない）。
export const USE_LOCAL_EMULATORS = !import.meta.env.PROD && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'

// テスト環境は本番と別の名前で動かす。demo- で始まるプロジェクトは、エミュレーターの外には一切つながらない。
export const LOCAL_EMULATOR_PROJECT_ID = 'demo-qr-local'

export const LOCAL_EMULATOR_HOSTS = {
  host: '127.0.0.1',
  authPort: 9099,
  firestorePort: 8080,
  functionsPort: 5001,
}
