import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectId = 'demo-sales-attribution'
const apiKey = 'demo-key'
const insideEnvironment = 'QR_SALES_ATTRIBUTION_EMULATOR_INSIDE'

function runInsideEmulator() {
  let temporaryDirectory = null
  let testCommand = 'node scripts/check-sales-attribution-rules-emulator.mjs'
  let exitStatus = 1

  try {
    if (process.platform === 'win32') {
      temporaryDirectory = mkdtempSync(join(tmpdir(), 'qr-sales-attribution-emulator-'))
      const commandPath = join(temporaryDirectory, 'run.cmd')
      writeFileSync(
        commandPath,
        `@echo off\r\n"${process.execPath}" "${fileURLToPath(import.meta.url)}"\r\n`,
        'utf8'
      )
      testCommand = commandPath
    }

    const firebaseArgs = [
      '--yes',
      'firebase-tools',
      '--project',
      projectId,
      'emulators:exec',
      '--only',
      'auth,firestore',
      testCommand,
    ]
    const result = process.platform === 'win32'
      ? spawnSync('cmd.exe', [
          '/d',
          '/c',
          `npx.cmd --yes firebase-tools --project ${projectId} emulators:exec --only auth,firestore "${testCommand}"`,
        ], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            GCLOUD_PROJECT: projectId,
            [insideEnvironment]: '1',
          },
          stdio: 'inherit',
        })
      : spawnSync('npx', firebaseArgs, {
          cwd: process.cwd(),
          env: {
            ...process.env,
            GCLOUD_PROJECT: projectId,
            [insideEnvironment]: '1',
          },
          stdio: 'inherit',
        })

    if (result.error) throw result.error
    exitStatus = result.status ?? 1
  } finally {
    if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true })
  }

  process.exit(exitStatus)
}

if (process.env[insideEnvironment] !== '1') runInsideEmulator()

function emulatorOrigin(configuredHost, fallbackHost) {
  const host = configuredHost || fallbackHost
  return /^https?:\/\//u.test(host) ? host : `http://${host}`
}

const authOrigin = emulatorOrigin(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099')
const firestoreOrigin = emulatorOrigin(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080')
const databaseName = `projects/${projectId}/databases/(default)`
const documentsName = `${databaseName}/documents`
const commitUrl = `${firestoreOrigin}/v1/${databaseName}/documents:commit`

async function requestJson(url, { method = 'GET', token = null, body = undefined } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const responseText = await response.text()
  let responseBody = null
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    body: responseBody,
  }
}

function responseDescription(result) {
  const body = typeof result.body === 'string' ? result.body : JSON.stringify(result.body)
  return `HTTP ${result.status}${body ? ` ${body}` : ''}`
}

async function expectAllowed(label, operation) {
  const result = await operation
  assert.equal(result.ok, true, `${label}: ${responseDescription(result)}`)
  console.log(`PASS allow: ${label}`)
  return result.body
}

async function expectPermissionDenied(label, operation) {
  const result = await operation
  assert.equal(result.status, 403, `${label}: ${responseDescription(result)}`)
  assert.equal(result.body?.error?.status, 'PERMISSION_DENIED', `${label}: ${responseDescription(result)}`)
  console.log(`PASS deny:  ${label}`)
}

async function createAuthUser({ email = null } = {}) {
  const body = email
    ? { email, password: 'test-password', returnSecureToken: true }
    : { returnSecureToken: true }
  const label = email ? `メール認証ユーザー作成 (${email})` : '匿名認証ユーザー作成'
  const response = await expectAllowed(label, requestJson(
    `${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    { method: 'POST', body }
  ))
  assert.equal(typeof response?.localId, 'string', `${label}: localIdがありません`)
  assert.equal(typeof response?.idToken, 'string', `${label}: idTokenがありません`)
  return {
    uid: response.localId,
    email: response.email ?? null,
    token: response.idToken,
  }
}

function encodeValue(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value }
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } }
  if (value && typeof value === 'object') return { mapValue: { fields: encodeFields(value) } }
  throw new TypeError(`Firestore RESTへ変換できない値です: ${String(value)}`)
}

function encodeFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeValue(value)]))
}

function decodeValue(value) {
  if ('nullValue' in value) return null
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return value.timestampValue
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {})
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue)
  throw new TypeError(`Firestore RESTから変換できない値です: ${JSON.stringify(value)}`)
}

function decodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]))
}

function documentName(path) {
  return `${documentsName}/${path}`
}

function documentUrl(path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${firestoreOrigin}/v1/${documentsName}/${encodedPath}`
}

function documentWrite(path, data, {
  exists = undefined,
  updateMask = null,
  serverTimestamps = [],
} = {}) {
  const write = {
    update: {
      name: documentName(path),
      fields: encodeFields(data),
    },
  }
  if (updateMask) write.updateMask = { fieldPaths: updateMask }
  if (serverTimestamps.length > 0) {
    write.updateTransforms = serverTimestamps.map(fieldPath => ({
      fieldPath,
      setToServerValue: 'REQUEST_TIME',
    }))
  }
  if (typeof exists === 'boolean') write.currentDocument = { exists }
  return write
}

function createWrite(path, data, serverTimestamps = []) {
  return documentWrite(path, data, { exists: false, serverTimestamps })
}

function updateWrite(path, data, serverTimestamps = []) {
  return documentWrite(path, data, {
    exists: true,
    updateMask: Object.keys(data),
    serverTimestamps,
  })
}

function deleteWrite(path) {
  return {
    delete: documentName(path),
    currentDocument: { exists: true },
  }
}

function commit(token, writes) {
  return requestJson(commitUrl, {
    method: 'POST',
    token,
    body: { writes },
  })
}

function getDocument(token, path) {
  return requestJson(documentUrl(path), { token })
}

const permissionNames = [
  'useKitchen',
  'closeRegister',
  'manageMenu',
  'manageTables',
  'manageReservations',
  'viewHistory',
  'manageSettings',
  'manageStaff',
]

function canonicalPermissions(overrides = {}) {
  return Object.fromEntries(permissionNames.map(name => [name, overrides[name] === true]))
}

function adminActor(user) {
  return {
    actorType: 'admin',
    actorStaffId: null,
    actorStaffName: null,
    actorUid: user.uid,
    actorEmail: user.email,
  }
}

function staffActor(user, staffMemberId, staffName) {
  return {
    actorType: 'staff',
    actorStaffId: staffMemberId,
    actorStaffName: staffName,
    actorUid: user.uid,
    actorEmail: null,
  }
}

function auditFields(prefix, actor) {
  return {
    [`${prefix}ByUid`]: actor.actorUid,
    [`${prefix}ByEmail`]: actor.actorEmail,
    [`${prefix}ByStaffId`]: actor.actorStaffId,
    [`${prefix}ByStaffName`]: actor.actorStaffName,
  }
}

function salesAssigneeAction({
  storeId,
  assigneeId,
  assigneeName,
  previousAssigneeName,
  isActive,
  changeType,
  actor,
}) {
  return {
    storeId,
    actionType: 'sales_assignee',
    changeType,
    targetType: 'salesAssignee',
    targetId: assigneeId,
    ...actor,
    assigneeId,
    assigneeName,
    previousAssigneeName,
    isActive,
    note: `担当者「${assigneeName}」の${changeType}`,
  }
}

function salesAttributionAction({
  storeId,
  checkId,
  previousAssigneeId,
  previousAssigneeName,
  assigneeId,
  assigneeName,
  changeType,
  actor,
}) {
  return {
    storeId,
    actionType: 'sales_attribution',
    changeType,
    targetType: 'check',
    targetId: checkId,
    ...actor,
    checkId,
    previousAssigneeId,
    previousAssigneeName,
    assigneeId,
    assigneeName,
    note: `会計「${checkId}」の担当を${changeType}`,
  }
}

function createAssigneeWrites({ storeId, assigneeId, name, actor, actionId, actionActor = actor }) {
  return [
    createWrite(`salesAssignees/${assigneeId}`, {
      storeId,
      name,
      isActive: true,
      ...auditFields('created', actor),
      ...auditFields('updated', actor),
      lastAuditActionId: actionId,
    }, ['createdAt', 'updatedAt']),
    createWrite(`staffActions/${actionId}`, salesAssigneeAction({
      storeId,
      assigneeId,
      assigneeName: name,
      previousAssigneeName: null,
      isActive: true,
      changeType: 'create',
      actor: actionActor,
    }), ['createdAt']),
  ]
}

function updateAssigneeWrites({
  storeId,
  assigneeId,
  previousName,
  nextName,
  previousIsActive,
  nextIsActive,
  actor,
  actionId,
}) {
  const changeType = previousIsActive !== nextIsActive
    ? (nextIsActive ? 'reactivate' : 'deactivate')
    : 'rename'
  const changes = {
    ...auditFields('updated', actor),
    lastAuditActionId: actionId,
  }
  if (previousName !== nextName) changes.name = nextName
  if (previousIsActive !== nextIsActive) changes.isActive = nextIsActive

  return [
    updateWrite(`salesAssignees/${assigneeId}`, changes, ['updatedAt']),
    createWrite(`staffActions/${actionId}`, salesAssigneeAction({
      storeId,
      assigneeId,
      assigneeName: nextName,
      previousAssigneeName: previousName,
      isActive: nextIsActive,
      changeType,
      actor,
    }), ['createdAt']),
  ]
}

function createAttributionWrites({
  storeId,
  checkId,
  assigneeId,
  assigneeName,
  actor,
  actionId,
  documentId = checkId,
  storedCheckId = checkId,
}) {
  return [
    createWrite(`salesAttributions/${documentId}`, {
      storeId,
      checkId: storedCheckId,
      status: 'assigned',
      assigneeId,
      assigneeNameSnapshot: assigneeName,
      ...auditFields('created', actor),
      ...auditFields('updated', actor),
      lastAuditActionId: actionId,
    }, ['createdAt', 'updatedAt']),
    createWrite(`staffActions/${actionId}`, salesAttributionAction({
      storeId,
      checkId: documentId,
      previousAssigneeId: null,
      previousAssigneeName: null,
      assigneeId,
      assigneeName,
      changeType: 'set',
      actor,
    }), ['createdAt']),
  ]
}

function clearAttributionWrites({
  storeId,
  checkId,
  previousAssigneeId,
  previousAssigneeName,
  actor,
  actionId,
}) {
  return [
    updateWrite(`salesAttributions/${checkId}`, {
      status: 'unassigned',
      assigneeId: null,
      assigneeNameSnapshot: null,
      ...auditFields('updated', actor),
      lastAuditActionId: actionId,
    }, ['updatedAt']),
    createWrite(`staffActions/${actionId}`, salesAttributionAction({
      storeId,
      checkId,
      previousAssigneeId,
      previousAssigneeName,
      assigneeId: null,
      assigneeName: null,
      changeType: 'clear',
      actor,
    }), ['createdAt']),
  ]
}

async function readAllowedDocument(label, token, path) {
  const response = await expectAllowed(label, getDocument(token, path))
  return decodeFields(response.fields ?? {})
}

async function main() {
  const superUser = await createAuthUser({ email: 'tsk.mons@gmail.com' })
  const storeId = superUser.uid
  const otherStoreId = 'other-store'
  const storeCode = 'RULE01'
  const managerPermissions = canonicalPermissions({ manageStaff: true })
  const registerPermissions = canonicalPermissions({ closeRegister: true })

  await expectAllowed('店舗・会計・正規スタッフを準備できる', commit(superUser.token, [
    createWrite(`storeCodes/${storeCode}`, { storeId }),
    createWrite('checks/check-a-1', { storeId, status: 'completed', total: 4200 }),
    createWrite('checks/check-a-2', { storeId, status: 'completed', total: 1800 }),
    createWrite('checks/check-no-audit', { storeId, status: 'completed', total: 2200 }),
    createWrite('checks/check-manager-denied', { storeId, status: 'completed', total: 3200 }),
    createWrite('checks/wrong-id', { storeId, status: 'completed', total: 1200 }),
    createWrite('checks/check-b-1', { storeId: otherStoreId, status: 'completed', total: 900 }),
    createWrite('staffMembers/manager-1', {
      storeId,
      name: '管理担当',
      permissionPreset: 'custom',
      permissions: managerPermissions,
    }),
    createWrite('staffMembers/register-1', {
      storeId,
      name: 'レジ担当',
      permissionPreset: 'custom',
      permissions: registerPermissions,
    }),
  ]))

  const managerUser = await createAuthUser()
  const registerUser = await createAuthUser()

  await expectAllowed('管理担当の初期スタッフセッションを作成できる', commit(managerUser.token, [
    createWrite(`staffSessions/${managerUser.uid}`, { storeId, code: storeCode }),
  ]))
  await expectAllowed('レジ担当の初期スタッフセッションを作成できる', commit(registerUser.token, [
    createWrite(`staffSessions/${registerUser.uid}`, { storeId, code: storeCode }),
  ]))

  const forgedRegisterPermissions = { ...registerPermissions, manageStaff: true }
  await expectPermissionDenied('スタッフセッションで権限を自己昇格できない', commit(registerUser.token, [
    updateWrite(`staffSessions/${registerUser.uid}`, {
      storeId,
      code: storeCode,
      staffMemberId: 'register-1',
      staffName: 'レジ担当',
      permissionPreset: 'custom',
      permissions: forgedRegisterPermissions,
    }, ['updatedAt']),
  ]))

  await expectAllowed('管理担当を正規staffMembersの権限で有効化できる', commit(managerUser.token, [
    updateWrite(`staffSessions/${managerUser.uid}`, {
      storeId,
      code: storeCode,
      staffMemberId: 'manager-1',
      staffName: '管理担当',
      permissionPreset: 'custom',
      permissions: managerPermissions,
    }, ['updatedAt']),
  ]))
  await expectAllowed('レジ担当を正規staffMembersの権限で有効化できる', commit(registerUser.token, [
    updateWrite(`staffSessions/${registerUser.uid}`, {
      storeId,
      code: storeCode,
      staffMemberId: 'register-1',
      staffName: 'レジ担当',
      permissionPreset: 'custom',
      permissions: registerPermissions,
    }, ['updatedAt']),
  ]))

  const registerSession = await readAllowedDocument(
    '正規化したスタッフセッションを本人が読める',
    registerUser.token,
    `staffSessions/${registerUser.uid}`
  )
  assert.equal(registerSession.permissions.closeRegister, true)
  assert.equal(registerSession.permissions.manageStaff, false)

  const manager = staffActor(managerUser, 'manager-1', '管理担当')
  const register = staffActor(registerUser, 'register-1', 'レジ担当')
  const admin = adminActor(superUser)

  const missingAssigneeAudit = createAssigneeWrites({
    storeId,
    assigneeId: 'assignee-no-audit',
    name: '操作ログなし担当',
    actor: manager,
    actionId: 'missing-assignee-action',
  })
  await expectPermissionDenied('担当マスタを操作ログなしの別コミットで作成できない', commit(
    managerUser.token,
    [missingAssigneeAudit[0]]
  ))

  const missingAssigneeBackLink = createAssigneeWrites({
    storeId,
    assigneeId: 'assignee-no-back-link',
    name: '逆参照なし担当',
    actor: manager,
    actionId: 'action-without-assignee',
  })
  await expectPermissionDenied('売上操作ログだけを逆参照なしの別コミットで作成できない', commit(
    managerUser.token,
    [missingAssigneeBackLink[1]]
  ))

  await expectAllowed('管理者actorでも担当マスタと操作ログを同一コミットで作成できる', commit(
    superUser.token,
    createAssigneeWrites({
      storeId,
      assigneeId: 'assignee-admin-path',
      name: '管理者経路担当',
      actor: admin,
      actionId: 'action-assignee-admin-path-create',
    })
  ))

  await expectAllowed('manageStaff担当が担当マスタと操作ログを同一コミットで作成できる', commit(
    managerUser.token,
    createAssigneeWrites({
      storeId,
      assigneeId: 'assignee-main',
      name: 'コンサル担当A',
      actor: manager,
      actionId: 'action-assignee-main-create',
    })
  ))
  const mainAssignee = await readAllowedDocument(
    'closeRegister担当が同じ店舗の担当マスタを読める',
    registerUser.token,
    'salesAssignees/assignee-main'
  )
  assert.equal(mainAssignee.name, 'コンサル担当A')
  assert.equal(mainAssignee.lastAuditActionId, 'action-assignee-main-create')

  await expectPermissionDenied('closeRegisterだけでは担当マスタを作成できない', commit(
    registerUser.token,
    createAssigneeWrites({
      storeId,
      assigneeId: 'assignee-register-denied',
      name: '権限外担当',
      actor: register,
      actionId: 'action-assignee-register-denied',
    })
  ))

  const spoofedActor = { ...manager, actorStaffName: '偽装した担当名' }
  await expectPermissionDenied('操作ログのactor情報を偽装できない', commit(
    managerUser.token,
    createAssigneeWrites({
      storeId,
      assigneeId: 'assignee-spoof-denied',
      name: '偽装担当',
      actor: manager,
      actionActor: spoofedActor,
      actionId: 'action-assignee-spoof-denied',
    })
  ))

  await expectAllowed('管理者が別店舗テスト用担当を正しい監査ログ付きで準備できる', commit(
    superUser.token,
    createAssigneeWrites({
      storeId: otherStoreId,
      assigneeId: 'assignee-other',
      name: '別店舗担当',
      actor: admin,
      actionId: 'action-assignee-other-create',
    })
  ))
  await expectPermissionDenied('他店舗の担当マスタを読めない', getDocument(
    registerUser.token,
    'salesAssignees/assignee-other'
  ))

  await expectAllowed('closeRegister担当が担当割当と操作ログを同一コミットで保存できる', commit(
    registerUser.token,
    createAttributionWrites({
      storeId,
      checkId: 'check-a-1',
      assigneeId: 'assignee-main',
      assigneeName: 'コンサル担当A',
      actor: register,
      actionId: 'action-attribution-main-set',
    })
  ))
  const mainAttribution = await readAllowedDocument(
    'closeRegister担当が同じ店舗の担当割当を読める',
    registerUser.token,
    'salesAttributions/check-a-1'
  )
  assert.equal(mainAttribution.assigneeId, 'assignee-main')
  assert.equal(mainAttribution.lastAuditActionId, 'action-attribution-main-set')

  await expectPermissionDenied('manageStaffだけでは担当割当を保存できない', commit(
    managerUser.token,
    createAttributionWrites({
      storeId,
      checkId: 'check-manager-denied',
      assigneeId: 'assignee-main',
      assigneeName: 'コンサル担当A',
      actor: manager,
      actionId: 'action-attribution-manager-denied',
    })
  ))

  const missingAttributionAudit = createAttributionWrites({
    storeId,
    checkId: 'check-no-audit',
    assigneeId: 'assignee-main',
    assigneeName: 'コンサル担当A',
    actor: register,
    actionId: 'missing-attribution-action',
  })
  await expectPermissionDenied('担当割当を操作ログなしの別コミットで保存できない', commit(
    registerUser.token,
    [missingAttributionAudit[0]]
  ))

  await expectPermissionDenied('ドキュメントIDとcheckIdを差し替えられない', commit(
    registerUser.token,
    createAttributionWrites({
      storeId,
      checkId: 'wrong-id',
      storedCheckId: 'check-a-2',
      assigneeId: 'assignee-main',
      assigneeName: 'コンサル担当A',
      actor: register,
      actionId: 'action-attribution-id-swap-denied',
    })
  ))

  await expectPermissionDenied('他店舗の会計へ担当を設定できない', commit(
    registerUser.token,
    createAttributionWrites({
      storeId: otherStoreId,
      checkId: 'check-b-1',
      assigneeId: 'assignee-other',
      assigneeName: '別店舗担当',
      actor: register,
      actionId: 'action-attribution-other-store-denied',
    })
  ))

  await expectAllowed('無効化テスト用の担当を作成できる', commit(
    managerUser.token,
    createAssigneeWrites({
      storeId,
      assigneeId: 'assignee-inactive',
      name: '休止担当',
      actor: manager,
      actionId: 'action-assignee-inactive-create',
    })
  ))
  await expectAllowed('担当の無効化と操作ログを同一コミットで保存できる', commit(
    managerUser.token,
    updateAssigneeWrites({
      storeId,
      assigneeId: 'assignee-inactive',
      previousName: '休止担当',
      nextName: '休止担当',
      previousIsActive: true,
      nextIsActive: false,
      actor: manager,
      actionId: 'action-assignee-inactive-deactivate',
    })
  ))
  await expectPermissionDenied('無効化済み担当を新しく割り当てられない', commit(
    registerUser.token,
    createAttributionWrites({
      storeId,
      checkId: 'check-a-2',
      assigneeId: 'assignee-inactive',
      assigneeName: '休止担当',
      actor: register,
      actionId: 'action-attribution-inactive-denied',
    })
  ))

  const missingClearAudit = clearAttributionWrites({
    storeId,
    checkId: 'check-a-1',
    previousAssigneeId: 'assignee-main',
    previousAssigneeName: 'コンサル担当A',
    actor: register,
    actionId: 'missing-clear-action',
  })
  await expectPermissionDenied('担当解除も操作ログなしの別コミットでは保存できない', commit(
    registerUser.token,
    [missingClearAudit[0]]
  ))
  await expectAllowed('担当解除と操作ログを同一コミットで保存できる', commit(
    registerUser.token,
    clearAttributionWrites({
      storeId,
      checkId: 'check-a-1',
      previousAssigneeId: 'assignee-main',
      previousAssigneeName: 'コンサル担当A',
      actor: register,
      actionId: 'action-attribution-main-clear',
    })
  ))
  const clearedAttribution = await readAllowedDocument(
    '解除後の担当割当を確認できる',
    registerUser.token,
    'salesAttributions/check-a-1'
  )
  assert.equal(clearedAttribution.status, 'unassigned')
  assert.equal(clearedAttribution.assigneeId, null)
  assert.equal(clearedAttribution.lastAuditActionId, 'action-attribution-main-clear')

  await expectPermissionDenied('売上操作ログを更新できない', commit(registerUser.token, [
    updateWrite('staffActions/action-attribution-main-set', { note: '改ざん' }),
  ]))
  await expectPermissionDenied('売上操作ログを物理削除できない', commit(registerUser.token, [
    deleteWrite('staffActions/action-attribution-main-set'),
  ]))
  await expectPermissionDenied('担当割当を物理削除できない', commit(registerUser.token, [
    deleteWrite('salesAttributions/check-a-1'),
  ]))
  await expectPermissionDenied('担当マスタを物理削除できない', commit(managerUser.token, [
    deleteWrite('salesAssignees/assignee-main'),
  ]))

  console.log('sales attribution Firestore rules emulator REST checks passed')
}

await main()
