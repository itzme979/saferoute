const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export function validateImage(file: File, maxMb = 8): string | null {
  if (!ALLOWED.includes(file.type)) return 'Use a JPEG, PNG or WebP image.';
  if (file.size > maxMb * 1024 * 1024) return `Images must be under ${maxMb} MB.`;
  return null;
}

/**
 * Re-encodes an image through a canvas. This resizes large photos and strips
 * all metadata, including EXIF GPS coordinates that could reveal where the
 * photographer lives.
 */
export async function sanitizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('This image could not be read.'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not supported in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image.'))), 'image/jpeg', quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
