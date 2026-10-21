// 手元のテスト環境を起動する：Firebase エミュレーター（ログイン・データ・Functions）→ テスト用の店を作る → 画面（Vite）。
// 本番とは別のテスト用プロジェクト（demo-qr-local）で動くので、本番のお店には一切届かない。Ctrl+C でまとめて止まる。
import { spawn } from 'node:child_process'
import { LOCAL_PROJECT_ID, seedLocalEmulator } from './seed-local-emulator.mjs'

const VITE_PORT = 5174
const EMULATOR_PORTS = [9099, 8080, 5001]
const children = []

function run(command, env = {}) {
  const child = spawn(command, { shell: true, stdio: 'inherit', env: { ...process.env, ...env } })
  children.push(child)
  return child
}

async function waitForPorts(ports, timeoutMs = 180000) {
  const startedAt = Date.now()
  for (const port of ports) {
    while (true) {
      try {
        await fetch(`http://127.0.0.1:${port}/`)
        break
      } catch {
        if (Date.now() - startedAt > timeoutMs) throw new Error(`エミュレーターが起動しませんでした（ポート ${port}）`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }
}

function stopAll() {
  for (const child of children) child.kill()
}
process.on('SIGINT', () => { stopAll(); process.exit(0) })
process.on('exit', stopAll)

run(`npx --yes firebase-tools emulators:start --only auth,firestore,functions --project ${LOCAL_PROJECT_ID}`, {
  FUNCTIONS_DISCOVERY_TIMEOUT: '60',
})
await waitForPorts(EMULATOR_PORTS)
await seedLocalEmulator()
console.log('テスト用の店を作りました（手元のテスト環境だけ）。ログインに使う値は scripts/seed-local-emulator.mjs にあります。')
run(`npx vite --port ${VITE_PORT} --strictPort`, {
  VITE_USE_FIREBASE_EMULATORS: 'true',
  VITE_ORDER_COMMAND_RUNTIME: 'functions',
})
console.log(`画面：http://localhost:${VITE_PORT}/login`)
