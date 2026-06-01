export default function ProductImagePicker({
  inputRef,
  imageUrl,
  onFileSelect,
  onClear,
}) {
  const openPicker = () => inputRef.current?.click()

  return (
    <div>
      <label className="product-form-label product-form-label-image">画像（任意）</label>
      <div className="product-image-picker">
        {imageUrl ? (
          <div className="product-image-preview-wrap">
            <img src={imageUrl} alt="" className="product-image-preview" />
            <button type="button" onClick={onClear} className="button product-image-clear">×</button>
          </div>
        ) : (
          <button type="button" onClick={openPicker} className="product-image-placeholder">
            <span className="product-image-placeholder-icon">📷</span>
            <span className="product-image-placeholder-label">タップ</span>
          </button>
        )}
        <div className="product-image-actions">
          <button type="button" onClick={openPicker} className="button button-secondary product-image-select">
            {imageUrl ? '画像を変更' : '画像を選択'}
          </button>
          <div className="product-image-help">JPEG / PNG / HEIC 対応・自動圧縮</div>
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" onChange={onFileSelect} className="visually-hidden" />
    </div>
  )
}
