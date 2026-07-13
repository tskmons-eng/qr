import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

function serviceError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeAssigneeName(name) {
  const normalized = String(name ?? '').trim()
  if (!normalized) throw serviceError('assignee-name-required', '担当者名を入力してください。')
  if (normalized.length > 80) throw serviceError('assignee-name-too-long', '担当者名は80文字以内で入力してください。')
  return normalized
}

function buildActor(activeStaff) {
  const authUser = auth.currentUser
  const isStaffActor = Boolean(activeStaff?.id || activeStaff?.name)
  return {
    actorType: isStaffActor ? 'staff' : 'admin',
    actorStaffId: activeStaff?.id ?? null,
    actorStaffName: activeStaff?.name ?? null,
    actorUid: authUser?.uid ?? null,
    actorEmail: authUser?.email ?? null,
  }
}

function buildAuditFields(prefix, actor) {
  return {
    [`${prefix}ByUid`]: actor.actorUid,
    [`${prefix}ByEmail`]: actor.actorEmail,
    [`${prefix}ByStaffId`]: actor.actorStaffId,
    [`${prefix}ByStaffName`]: actor.actorStaffName,
  }
}

function buildStaffAction({ storeId, actionType, changeType, targetType, targetId, note, actor, extra = {} }) {
  return {
    storeId,
    actionType,
    changeType,
    targetType,
    targetId,
    ...actor,
    ...extra,
    note,
    createdAt: serverTimestamp(),
  }
}

export async function loadSalesAssignees(storeId) {
  const assigneesSnap = await getDocs(query(collection(db, 'salesAssignees'), where('storeId', '==', storeId)))
  return mapDocs(assigneesSnap).sort((a, b) => (
    Number(b.isActive !== false) - Number(a.isActive !== false)
    || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'ja')
  ))
}

export async function loadSalesHistoryMetadata(storeId) {
  const [salesAssignees, attributionsSnap] = await Promise.all([
    loadSalesAssignees(storeId),
    getDocs(query(collection(db, 'salesAttributions'), where('storeId', '==', storeId))),
  ])
  return {
    salesAssignees,
    salesAttributions: mapDocs(attributionsSnap),
  }
}

export async function createSalesAssignee({ storeId, name, activeStaff = null }) {
  const normalizedName = normalizeAssigneeName(name)
  const assigneeRef = doc(collection(db, 'salesAssignees'))
  const actionRef = doc(collection(db, 'staffActions'))
  const actor = buildActor(activeStaff)
  const now = serverTimestamp()
  const payload = {
    storeId,
    name: normalizedName,
    isActive: true,
    createdAt: now,
    ...buildAuditFields('created', actor),
    updatedAt: now,
    ...buildAuditFields('updated', actor),
    lastAuditActionId: actionRef.id,
  }
  const batch = writeBatch(db)
  batch.set(assigneeRef, payload)
  batch.set(actionRef, buildStaffAction({
    storeId,
    actionType: 'sales_assignee',
    changeType: 'create',
    targetType: 'salesAssignee',
    targetId: assigneeRef.id,
    note: `担当者「${normalizedName}」を追加`,
    actor,
    extra: {
      assigneeId: assigneeRef.id,
      assigneeName: normalizedName,
      previousAssigneeName: null,
      isActive: true,
    },
  }))
  await batch.commit()
  return { id: assigneeRef.id, ...payload, createdAt: new Date(), updatedAt: new Date() }
}

export async function updateSalesAssignee({ storeId, assigneeId, name, isActive, activeStaff = null }) {
  if (!assigneeId) throw serviceError('assignee-id-required', '更新する担当者を選択してください。')
  const assigneeRef = doc(db, 'salesAssignees', assigneeId)
  const actor = buildActor(activeStaff)
  const actionRef = doc(collection(db, 'staffActions'))

  return runTransaction(db, async transaction => {
    const assigneeSnap = await transaction.get(assigneeRef)
    if (!assigneeSnap.exists()) throw serviceError('assignee-not-found', '担当者が見つかりません。')
    const current = { id: assigneeSnap.id, ...assigneeSnap.data() }
    if (current.storeId !== storeId) throw serviceError('store-mismatch', '別店舗の担当者は更新できません。')

    const nextName = name === undefined ? current.name : normalizeAssigneeName(name)
    const currentIsActive = current.isActive !== false
    const nextIsActive = typeof isActive === 'boolean' ? isActive : currentIsActive
    if (nextName !== current.name && nextIsActive !== currentIsActive) {
      throw serviceError(
        'assignee-update-conflict',
        '担当者名の変更と有効状態の変更は別々に保存してください。'
      )
    }
    if (nextName === current.name && nextIsActive === currentIsActive) {
      return { ...current, deduped: true }
    }

    const updatePayload = {
      name: nextName,
      isActive: nextIsActive,
      updatedAt: serverTimestamp(),
      ...buildAuditFields('updated', actor),
      lastAuditActionId: actionRef.id,
    }
    let changeType = 'rename'
    if (nextIsActive !== currentIsActive) changeType = nextIsActive ? 'reactivate' : 'deactivate'
    const note = changeType === 'rename'
      ? `担当者「${current.name}」を「${nextName}」へ変更`
      : `担当者「${nextName}」を${nextIsActive ? '再有効化' : '無効化'}`

    transaction.update(assigneeRef, updatePayload)
    transaction.set(actionRef, buildStaffAction({
      storeId,
      actionType: 'sales_assignee',
      changeType,
      targetType: 'salesAssignee',
      targetId: assigneeId,
      note,
      actor,
      extra: {
        assigneeId,
        assigneeName: nextName,
        previousAssigneeName: current.name ?? null,
        isActive: nextIsActive,
      },
    }))
    return { ...current, ...updatePayload, updatedAt: new Date() }
  })
}

export async function saveSalesAttribution({ storeId, checkId, assignee, activeStaff = null }) {
  if (!checkId) throw serviceError('check-id-required', '担当を設定する会計を選択してください。')
  const requestedAssigneeId = typeof assignee === 'string' ? assignee : assignee?.id ?? null
  const checkRef = doc(db, 'checks', checkId)
  const attributionRef = doc(db, 'salesAttributions', checkId)
  const actor = buildActor(activeStaff)
  const actionRef = doc(collection(db, 'staffActions'))

  return runTransaction(db, async transaction => {
    const checkSnap = await transaction.get(checkRef)
    const attributionSnap = await transaction.get(attributionRef)
    const assigneeSnap = requestedAssigneeId
      ? await transaction.get(doc(db, 'salesAssignees', requestedAssigneeId))
      : null

    if (!checkSnap.exists()) throw serviceError('check-not-found', '会計が見つかりません。')
    const check = checkSnap.data()
    if (check.storeId !== storeId) throw serviceError('store-mismatch', '別店舗の会計は更新できません。')
    if (check.status !== 'completed') throw serviceError('check-not-completed', '完了済みの会計だけ担当を設定できます。')

    const current = attributionSnap.exists() ? { id: attributionSnap.id, ...attributionSnap.data() } : null
    if (current && (current.storeId !== storeId || current.checkId !== checkId)) {
      throw serviceError('attribution-scope-mismatch', '担当情報の店舗または会計が一致しません。')
    }

    let resolvedAssignee = null
    if (requestedAssigneeId) {
      if (!assigneeSnap?.exists()) throw serviceError('assignee-not-found', '担当者が見つかりません。')
      resolvedAssignee = { id: assigneeSnap.id, ...assigneeSnap.data() }
      if (resolvedAssignee.storeId !== storeId) throw serviceError('store-mismatch', '別店舗の担当者は設定できません。')
      if (resolvedAssignee.isActive === false) throw serviceError('assignee-inactive', '無効化された担当者は新しく設定できません。')
    }

    const nextStatus = resolvedAssignee ? 'assigned' : 'unassigned'
    const previousAssigned = current?.status === 'assigned' && current.assigneeId
    if (
      (!current && !resolvedAssignee)
      || (current?.status === nextStatus && (current.assigneeId ?? null) === (resolvedAssignee?.id ?? null))
    ) {
      return current ?? {
        id: checkId,
        storeId,
        checkId,
        status: 'unassigned',
        assigneeId: null,
        assigneeNameSnapshot: null,
        persisted: false,
        deduped: true,
      }
    }

    const changeType = !resolvedAssignee ? 'clear' : previousAssigned ? 'change' : 'set'
    const now = serverTimestamp()
    const mutablePayload = {
      status: nextStatus,
      assigneeId: resolvedAssignee?.id ?? null,
      assigneeNameSnapshot: resolvedAssignee?.name ?? null,
      updatedAt: now,
      ...buildAuditFields('updated', actor),
      lastAuditActionId: actionRef.id,
    }
    const payload = current
      ? mutablePayload
      : {
          storeId,
          checkId,
          ...mutablePayload,
          createdAt: now,
          ...buildAuditFields('created', actor),
        }
    const previousName = current?.assigneeNameSnapshot ?? null
    const nextName = resolvedAssignee?.name ?? null
    const note = changeType === 'clear'
      ? `担当「${previousName ?? '名称不明'}」を解除`
      : changeType === 'change'
        ? `担当を「${previousName ?? '名称不明'}」から「${nextName}」に変更`
        : `担当を「${nextName}」に設定`

    if (current) transaction.update(attributionRef, payload)
    else transaction.set(attributionRef, payload)
    transaction.set(actionRef, buildStaffAction({
      storeId,
      actionType: 'sales_attribution',
      changeType,
      targetType: 'check',
      targetId: checkId,
      note,
      actor,
      extra: {
        checkId,
        previousAssigneeId: current?.assigneeId ?? null,
        previousAssigneeName: previousName,
        assigneeId: resolvedAssignee?.id ?? null,
        assigneeName: nextName,
      },
    }))
    return { id: checkId, ...(current ?? {}), ...payload, updatedAt: new Date() }
  })
}

function sortOrderItems(items) {
  return [...items].sort((a, b) => {
    const aSeconds = a.orderedAt?.seconds ?? 0
    const bSeconds = b.orderedAt?.seconds ?? 0
    return aSeconds - bSeconds || String(a.id).localeCompare(String(b.id))
  })
}

async function loadDocsByIds(collectionName, ids) {
  const snapshots = []
  for (let offset = 0; offset < ids.length; offset += 25) {
    const chunk = ids.slice(offset, offset + 25)
    snapshots.push(...await Promise.all(chunk.map(id => getDoc(doc(db, collectionName, id)))))
  }
  return snapshots
}

function toFiniteAmount(value) {
  if (value === null || value === undefined || value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function buildDetailIntegrity(check, items, missingCount) {
  const recordedSubtotal = [
    check.checkoutSourceSubtotalBeforeItemDiscount,
    check.subtotalBeforeItemDiscount,
    check.subtotal,
  ].map(toFiniteAmount).find(amount => amount !== null) ?? null
  const loadedSubtotal = items.reduce((sum, item) => sum + (toFiniteAmount(item.lineTotal) ?? 0), 0)
  const hasSubtotalMismatch = recordedSubtotal !== null && loadedSubtotal !== recordedSubtotal
  return {
    recordedSubtotal,
    loadedSubtotal,
    hasSubtotalMismatch,
    hasIncompleteItems: missingCount > 0 || hasSubtotalMismatch,
  }
}

export async function loadCheckDetailItems(check) {
  if (!check?.id) throw serviceError('check-id-required', '明細を取得する会計を選択してください。')
  const hasCheckoutItemIds = Object.prototype.hasOwnProperty.call(check, 'checkoutItemIds')
    && Array.isArray(check.checkoutItemIds)
  const recordedCount = check.checkoutItemCount !== null
    && check.checkoutItemCount !== undefined
    && Number.isFinite(Number(check.checkoutItemCount))
      ? Math.max(0, Number(check.checkoutItemCount))
      : null

  if (hasCheckoutItemIds) {
    const checkoutItemIds = [...new Set(check.checkoutItemIds.filter(id => typeof id === 'string' && id))]
    const snapshots = await loadDocsByIds('orderItems', checkoutItemIds)
    const items = snapshots
      .filter(snapshot => snapshot.exists())
      .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }))
      .filter(item => (
        (!check.storeId || item.storeId === check.storeId)
        && (!check.orderId || item.orderId === check.orderId)
      ))
    const expectedCount = Math.max(recordedCount ?? 0, checkoutItemIds.length)
    const missingCount = Math.max(0, expectedCount - items.length)
    const integrity = buildDetailIntegrity(check, items, missingCount)
    return {
      items,
      source: 'checkoutItemIds',
      expectedCount,
      missingCount,
      ...integrity,
    }
  }

  if (check.orderId) {
    const snapshot = await getDocs(query(collection(db, 'orderItems'), where('orderId', '==', check.orderId)))
    const items = sortOrderItems(mapDocs(snapshot).filter(item => (
      item.itemStatus !== 'cancelled'
      && (!check.storeId || item.storeId === check.storeId)
    )))
    const expectedCount = Math.max(recordedCount ?? 0, items.length)
    const missingCount = Math.max(0, expectedCount - items.length)
    const integrity = buildDetailIntegrity(check, items, missingCount)
    return {
      items,
      source: 'orderId',
      expectedCount,
      missingCount,
      ...integrity,
    }
  }

  const expectedCount = recordedCount ?? 0
  const missingCount = expectedCount
  const integrity = buildDetailIntegrity(check, [], missingCount)
  return {
    items: [],
    source: 'none',
    expectedCount,
    missingCount,
    ...integrity,
  }
}
