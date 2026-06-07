import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { normalizeTableGroupName, sortTableGroups } from '../lib/tableGroups'
import { db } from '../lib/firebase'

function mapDocs(snapshot) {
  return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
}

export function subscribeTableGroups(storeId, onChange) {
  const tableGroupsQuery = query(collection(db, 'tableGroups'), where('storeId', '==', storeId))
  return onSnapshot(tableGroupsQuery, snap => onChange(sortTableGroups(mapDocs(snap))))
}

export async function createTableGroup({ storeId, name, sortOrder }) {
  const normalized = normalizeTableGroupName(name)
  if (!normalized) return null
  const ref = await addDoc(collection(db, 'tableGroups'), {
    storeId,
    name: normalized,
    sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export function renameTableGroup(groupId, name) {
  return updateDoc(doc(db, 'tableGroups', groupId), {
    name: normalizeTableGroupName(name),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteTableGroupAndClearTables({ groupId, storeId }) {
  const tablesSnap = await getDocs(query(
    collection(db, 'tables'),
    where('storeId', '==', storeId),
    where('groupId', '==', groupId)
  ))
  const batch = writeBatch(db)
  tablesSnap.docs.forEach(tableDoc => {
    batch.update(doc(db, 'tables', tableDoc.id), { groupId: null, updatedAt: serverTimestamp() })
  })
  batch.delete(doc(db, 'tableGroups', groupId))
  await batch.commit()
}

export function updateTableGroupAssignment({ tableId, groupId }) {
  return updateDoc(doc(db, 'tables', tableId), {
    groupId: groupId || null,
    updatedAt: serverTimestamp(),
  })
}
