import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'

function bySortOrder(a, b) {
  return a.sortOrder - b.sortOrder
}

function byJapaneseName(a, b) {
  return (a.name ?? '').localeCompare(b.name ?? '', 'ja')
}

function snapshotRows(snapshot) {
  return snapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }))
}

export async function loadProductAdminData(storeId) {
  const [prodSnap, catSnap, optionTemplateSnap, tagTemplateSnap] = await Promise.all([
    getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'categories'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'optionTemplates'), where('storeId', '==', storeId))),
    getDocs(query(collection(db, 'tagTemplates'), where('storeId', '==', storeId))),
  ])

  return {
    products: snapshotRows(prodSnap).sort(bySortOrder),
    categories: snapshotRows(catSnap).sort(bySortOrder),
    optionTemplates: snapshotRows(optionTemplateSnap).sort(byJapaneseName),
    tagTemplates: snapshotRows(tagTemplateSnap).sort(byJapaneseName),
  }
}

export async function saveOptionTemplateRecord({ storeId, templateId, name, options }) {
  if (templateId) {
    await updateDoc(doc(db, 'optionTemplates', templateId), {
      name,
      options,
      updatedAt: serverTimestamp(),
    })
    return
  }

  await addDoc(collection(db, 'optionTemplates'), {
    storeId,
    name,
    options,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function deleteOptionTemplateRecord(templateId) {
  return deleteDoc(doc(db, 'optionTemplates', templateId))
}

export async function saveTagTemplateRecord({ storeId, templateId, name, tags }) {
  if (templateId) {
    await updateDoc(doc(db, 'tagTemplates', templateId), {
      name,
      tags,
      updatedAt: serverTimestamp(),
    })
    return
  }

  await addDoc(collection(db, 'tagTemplates'), {
    storeId,
    name,
    tags,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export function deleteTagTemplateRecord(templateId) {
  return deleteDoc(doc(db, 'tagTemplates', templateId))
}

export async function createProductRecord(payload) {
  const ref = await addDoc(collection(db, 'products'), payload)
  return ref.id
}

export function updateProductRecord(productId, payload) {
  return updateDoc(doc(db, 'products', productId), payload)
}

export function updateProductSortOrderRecords(updates) {
  return Promise.all(updates.map(update => (
    updateProductRecord(update.id, { sortOrder: update.sortOrder, updatedAt: serverTimestamp() })
  )))
}

export async function batchUpdateProductSortOrderRecords(updates) {
  const batch = writeBatch(db)
  updates.forEach(update => {
    batch.update(doc(db, 'products', update.id), { sortOrder: update.sortOrder, updatedAt: serverTimestamp() })
  })
  await batch.commit()
}

export async function createCategoryRecord(payload) {
  const ref = await addDoc(collection(db, 'categories'), payload)
  return ref.id
}

export function updateCategoryRecord(categoryId, payload) {
  return updateDoc(doc(db, 'categories', categoryId), payload)
}

export function updateCategorySortOrderRecords(updates) {
  return Promise.all(updates.map(update => (
    updateCategoryRecord(update.id, { sortOrder: update.sortOrder, updatedAt: serverTimestamp() })
  )))
}

export async function batchUpdateCategorySortOrderRecords(updates) {
  const batch = writeBatch(db)
  updates.forEach(update => {
    batch.update(doc(db, 'categories', update.id), { sortOrder: update.sortOrder, updatedAt: serverTimestamp() })
  })
  await batch.commit()
}

export async function deleteCategoryRecordWithDisplayRefs(categoryId, productUpdates) {
  const batch = writeBatch(db)
  productUpdates.forEach(update => {
    batch.update(doc(db, 'products', update.id), {
      displayCategoryIds: update.displayCategoryIds,
      updatedAt: serverTimestamp(),
    })
  })
  batch.delete(doc(db, 'categories', categoryId))
  await batch.commit()
}
