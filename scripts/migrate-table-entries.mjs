// 今ある席に、QRの入口の記録（tableEntries/<QRの文字>）を作る（2026-10-28 QR 第1章）。
// 席・注文は変えない。机に貼ってあるQRはそのまま使える。もう入口がある席は飛ばす。
// これを本番で走らせてから、席の一覧を店の人だけにする rules を出す（先に出すと、入口の無い席にお客様が入れない）。
//
// 使い方：
//   試す（書き込まない）：node scripts/migrate-table-entries.mjs --project <プロジェクトID>
//   実行する：           node scripts/migrate-table-entries.mjs --project <プロジェクトID> --apply
// エミュレーターに向けるときは FIRESTORE_EMULATOR_HOST を付ける。QRの文字は表示しない。
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url))

export async function migrateTableEntries(db, FieldValue, { apply = false } = {}) {
  const snap = await db.collection('tables').get()
  const summary = { checked: snap.size, created: 0, alreadyExists: 0, noToken: 0, conflict: 0 }
  for (const tableDoc of snap.docs) {
    const table = tableDoc.data()
    const qrToken = String(table.qrToken ?? '')
    if (!qrToken || !table.storeId) {
      summary.noToken += 1
      continue
    }
    const entryRef = db.collection('tableEntries').doc(qrToken)
    const entrySnap = await entryRef.get()
    if (entrySnap.exists) {
      if (entrySnap.data().tableId === tableDoc.id) summary.alreadyExists += 1
      else {
        summary.conflict += 1
        console.warn(`同じQRの文字の入口が別の席を指しています（作らずに飛ばしました）: tables/${tableDoc.id}`)
      }
      continue
    }
    if (apply) await entryRef.create({ storeId: table.storeId, tableId: tableDoc.id, createdAt: FieldValue.serverTimestamp() })
    summary.created += 1
  }
  return summary
}

async function main() {
  const args = process.argv.slice(2)
  const projectIndex = args.indexOf('--project')
  const projectId = projectIndex >= 0 ? args[projectIndex + 1] : null
  const apply = args.includes('--apply')
  if (!projectId) {
    console.error('--project <プロジェクトID> を付けてください。')
    process.exit(1)
  }
  const { initializeApp } = functionsRequire('firebase-admin/app')
  const { getFirestore, FieldValue } = functionsRequire('firebase-admin/firestore')
  const db = getFirestore(initializeApp({ projectId }, 'migrate-table-entries'))
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `エミュレーター（${process.env.FIRESTORE_EMULATOR_HOST}）` : '本番'
  console.log(`${target} の ${projectId} を${apply ? '書き込みます' : '確認します（書き込みません）'}。`)
  const summary = await migrateTableEntries(db, FieldValue, { apply })
  console.log(`席 ${summary.checked}：入口を作る ${summary.created} ／ もうある ${summary.alreadyExists} ／ QRの文字なし ${summary.noToken} ／ 食い違い ${summary.conflict}`)
  if (!apply) console.log('書き込むときは --apply を付けて、もう一度実行してください。')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
