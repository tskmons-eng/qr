import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getDiscountedProductPrice } from '../lib/discounts'

export async function submitStaffMenuOrder({ cart, orderId, storeId, tableId }) {
  const now = serverTimestamp()

  await Promise.all(cart.map(({ product, quantity, optionSelections }) => {
    const extra = (optionSelections ?? []).reduce((sum, option) => sum + (option.extraPrice ?? 0), 0)
    const { originalPrice, discountAmount, discountedPrice } = getDiscountedProductPrice(product)

    return addDoc(collection(db, 'orderItems'), {
      orderId,
      storeId,
      tableId,
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceSnapshot: originalPrice,
      unitDiscountSnapshot: discountAmount,
      discountConfigSnapshot: product.discountConfig ?? null,
      categoryGroup: product.categoryGroup ?? '',
      quantity,
      lineTotal: (discountedPrice + extra) * quantity,
      orderedBy: 'staff',
      itemStatus: 'ordered',
      optionSelections: optionSelections ?? [],
      orderedAt: now,
      updatedAt: now,
    })
  }))

  await updateDoc(doc(db, 'tables', tableId), {
    pendingCount: increment(cart.length),
    updatedAt: now,
  })
}
