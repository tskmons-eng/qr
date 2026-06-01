import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db } from '../lib/firebase'

export async function loadStaffMembers(storeId) {
  const snap = await getDocs(query(collection(db, 'staffMembers'), where('storeId', '==', storeId)))
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
}

export function createStaffMember({ storeId, name, code }) {
  return addDoc(collection(db, 'staffMembers'), {
    storeId,
    name: name.trim(),
    code,
    createdAt: serverTimestamp(),
  })
}

export function deleteStaffMember(memberId) {
  return deleteDoc(doc(db, 'staffMembers', memberId))
}
