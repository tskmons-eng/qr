// スタッフの4桁パスを staffMembers.code から、画面から読めない staffSecrets（ハッシュ）へ移す（2026-10-22 整理 第4章 4-B）。
// パスの値は変わらないので、スタッフはそのまま入れる。移したあと staffMembers から code を消す。
// まだ移していないスタッフは、次に入るときに Functions（activateStaffSessionCommand）が同じように移す。
//
// 使い方：
//   試す（書き込まない）：node scripts/migrate-staff-codes.mjs --project <プロジェクトID>
//   実行する：           node scripts/migrate-staff-codes.mjs --project <プロジェクトID> --apply
// エミュレーターに向けるときは FIRESTORE_EMULATOR_HOST を付ける。パスの値は表示しない。
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url))
const { createPasscodeHash } = functionsRequire('./passcodeLock.js')
const { STAFF_CODE_PATTERN, STAFF_SECRET_COLLECTION } = functionsRequire('./staffPasscode.js')

export async function migrateStaffCodes(db, FieldValue, { apply = false } = {}) {
  const snap = await db.collection('staffMembers').get()
  const summary = { checked: snap.size, migrated: 0, alreadyMigrated: 0, invalid: 0, noCode: 0 }
  for (const memberDoc of snap.docs) {
    const member = memberDoc.data()
    if (member.code === undefined) {
      summary.noCode += 1
      continue
    }
    const secretRef = db.collection(STAFF_SECRET_COLLECTION).doc(memberDoc.id)
    const result = await db.runTransaction(async transaction => {
      const [latestSnap, secretSnap] = await Promise.all([transaction.get(memberDoc.ref), transaction.get(secretRef)])
      const latest = latestSnap.data() ?? {}
      if (latest.code === undefined) return 'noCode'
      // すでにハッシュがある（スタッフが先に入って移った）なら、残った code を消すだけ。
      if (secretSnap.data()?.codeHash) {
        if (apply) transaction.update(memberDoc.ref, { code: FieldValue.delete() })
        return 'alreadyMigrated'
      }
      if (typeof latest.code !== 'string' || !STAFF_CODE_PATTERN.test(latest.code)) return 'invalid'
      if (apply) {
        const { hash, salt } = createPasscodeHash(latest.code)
        transaction.set(secretRef, {
          storeId: latest.storeId,
          codeHash: hash,
          codeSalt: salt,
          failedAttempts: 0,
          lockedUntilMs: 0,
          updatedAt: FieldValue.serverTimestamp(),
        })
        transaction.update(memberDoc.ref, { code: FieldValue.delete() })
      }
      return 'migrated'
    })
    summary[result] += 1
    if (result === 'invalid') console.warn(`4桁でないパスのため移せませんでした（店長がパスを設定し直す必要あり）: staffMembers/${memberDoc.id}`)
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
  const db = getFirestore(initializeApp({ projectId }, 'migrate-staff-codes'))
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `エミュレーター（${process.env.FIRESTORE_EMULATOR_HOST}）` : '本番'
  console.log(`${target} の ${projectId} を${apply ? '移し替えます' : '確認します（書き込みません）'}。`)
  const summary = await migrateStaffCodes(db, FieldValue, { apply })
  console.log(`スタッフ ${summary.checked} 人：移す ${summary.migrated} ／ 移し済みで code だけ残っていた ${summary.alreadyMigrated} ／ code なし ${summary.noCode} ／ 移せない ${summary.invalid}`)
  if (!apply) console.log('書き込むときは --apply を付けて、もう一度実行してください。')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
