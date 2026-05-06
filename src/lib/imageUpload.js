import imageCompression from 'browser-image-compression'
import heic2any from 'heic2any'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

async function toJpeg(file) {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  if (type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) {
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    return new File([blob], file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'), { type: 'image/jpeg' })
  }
  return file
}

export async function uploadProductImage(storeId, productId, file) {
  // HEIC変換
  const jpeg = await toJpeg(file)

  // 圧縮（最大800px / 200KB）
  const compressed = await imageCompression(jpeg, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: 'image/jpeg',
  })

  const path = `stores/${storeId}/products/${productId}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
  return await getDownloadURL(storageRef)
}

export async function deleteProductImage(storeId, productId) {
  try {
    const path = `stores/${storeId}/products/${productId}.jpg`
    await deleteObject(ref(storage, path))
  } catch {
    // 画像が存在しない場合は無視
  }
}
