/** 画像を長辺 maxSize px の JPEG に縮小する */
export async function resizeToJpeg(file: Blob, maxSize = 1280, quality = 0.85): Promise<Blob> {
  const bitmap = await loadImage(file);
  const { width, height } = bitmap;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ('close' in bitmap) bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像の変換に失敗しました'))), 'image/jpeg', quality),
  );
}

async function loadImage(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fallthrough */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
