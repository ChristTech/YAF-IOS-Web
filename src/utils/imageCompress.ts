/**
 * Compresses and resizes an uploaded image file so it fits comfortably
 * inside a Firestore document (well below the 1 MiB document size limit).
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 960,
  maxBytes = 250_000
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not decode the selected image file.'));
      image.src = objectUrl;
    });

    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > maxDimension || height > maxDimension) {
      const ratio = Math.min(maxDimension / width, maxDimension / height);
      width = Math.max(1, Math.round(width * ratio));
      height = Math.max(1, Math.round(height * ratio));
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Image compression canvas is unavailable in this browser.');
    }

    let currentWidth = width;
    let currentHeight = height;
    const qualities = [0.78, 0.62, 0.48, 0.35];

    for (let scaleAttempt = 0; scaleAttempt < 3; scaleAttempt++) {
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx.clearRect(0, 0, currentWidth, currentHeight);
      ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

      for (const q of qualities) {
        const dataUrl = canvas.toDataURL('image/jpeg', q);
        if (dataUrl.length <= maxBytes) {
          return dataUrl;
        }
      }

      currentWidth = Math.max(160, Math.round(currentWidth * 0.7));
      currentHeight = Math.max(160, Math.round(currentHeight * 0.7));
    }

    const fallbackUrl = canvas.toDataURL('image/jpeg', 0.3);
    if (fallbackUrl.length > maxBytes * 2) {
      throw new Error('Selected image is too large even after compression. Please pick a smaller image.');
    }
    return fallbackUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
