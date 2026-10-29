// 席のQRの文字を、お客様も読める席の記録（tables）から、店の人だけが読める tableSecrets へ移す（2026-10-29 QR 第2章）。
// 前に座ったお客様が、席の記録を読んで作り直したあとのQRを知れないようにするため。
// QRの文字は変えないので、机に貼ってあるQRはそのまま使える。入口（tableEntries）が無い席は作ってから移す。
// 新しい画面（tableSecrets を読む）と決まり（tableSecrets の読み書き）を出してから走らせる。
//
// 使い方：
//   試す（書き込まない）：node scripts/migrate-table-secrets.mjs --project <プロジェクトID>
//   実行する：           node scripts/migrate-table-secrets.mjs --project <プロジェクトID> --apply
// エミュレーターに向けるときは FIRESTORE_EMULATOR_HOST を付ける。QRの文字は表示しない。
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url))

export async function migrateTableSecrets(db, FieldValue, { apply = false } = {}) {
  const snap = await db.collection('tables').get()
  const summary = { checked: snap.size, moved: 0, alreadyMoved: 0, entryCreated: 0, noToken: 0 }
  for (const tableDoc of snap.docs) {
    const table = tableDoc.data()
    const secretRef = db.collection('tableSecrets').doc(tableDoc.id)
    const qrToken = String(table.qrToken ?? '')
    if (!qrToken) {
      const secretSnap = await secretRef.get()
      if (secretSnap.exists) summary.alreadyMoved += 1
      else {
        summary.noToken += 1
        console.warn(`QRの文字がどこにも無い席です（席の画面でQRを作り直してください）: tables/${tableDoc.id}`)
      }
      continue
    }
    const entryRef = db.collection('tableEntries').doc(qrToken)
    const entrySnap = await entryRef.get()
    if (!entrySnap.exists) summary.entryCreated += 1
    summary.moved += 1
    if (!apply) continue
    const batch = db.batch()
    if (!entrySnap.exists) batch.create(entryRef, { storeId: table.storeId, tableId: tableDoc.id, createdAt: FieldValue.serverTimestamp() })
    batch.set(secretRef, { storeId: table.storeId, qrToken, updatedAt: FieldValue.serverTimestamp() })
    batch.update(tableDoc.ref, { qrToken: FieldValue.delete() })
    await batch.commit()
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
  const db = getFirestore(initializeApp({ projectId }, 'migrate-table-secrets'))
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `エミュレーター（${process.env.FIRESTORE_EMULATOR_HOST}）` : '本番'
  console.log(`${target} の ${projectId} を${apply ? '書き込みます' : '確認します（書き込みません）'}。`)
  const summary = await migrateTableSecrets(db, FieldValue, { apply })
  console.log(`席 ${summary.checked}：移す ${summary.moved}（うち入口も作る ${summary.entryCreated}）／ 移し済み ${summary.alreadyMoved} ／ QRの文字なし ${summary.noToken}`)
  if (!apply) console.log('書き込むときは --apply を付けて、もう一度実行してください。')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
