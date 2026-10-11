/**
 * Local-only file helpers. Downloads are created in the browser from in-memory
 * data; uploaded files are read locally and never sent anywhere.
 */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadText(text: string, filename: string, mime = 'application/json'): void {
  downloadBlob(new Blob([text], { type: `${mime};charset=utf-8` }), filename);
}

export function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsText(file);
  });
}

export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_LOGO_FILE_BYTES = 2 * 1024 * 1024;
const MAX_LOGO_W = 640;
const MAX_LOGO_H = 320;

export type LogoResult = { ok: true; dataUrl: string } | { ok: false; error: string };

/**
 * Validate and normalise a logo: PNG/JPEG/WebP up to 2 MB, decoded locally,
 * scaled down to at most 640×320 and re-encoded as PNG. Re-encoding strips
 * metadata and guarantees the result can be embedded in the PDF.
 */
export async function processLogoFile(file: File): Promise<LogoResult> {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Choose a PNG, JPEG or WebP image.' };
  }
  if (file.size > MAX_LOGO_FILE_BYTES) {
    return { ok: false, error: 'That image is larger than 2 MB. Choose a smaller file.' };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    if (!img.naturalWidth || !img.naturalHeight) return { ok: false, error: "That image couldn't be read." };
    const scale = Math.min(1, MAX_LOGO_W / img.naturalWidth, MAX_LOGO_H / img.naturalHeight);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (!g) return { ok: false, error: "Your browser couldn't process the image." };
    g.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png;base64,')) return { ok: false, error: "Your browser couldn't process the image." };
    return { ok: true, dataUrl };
  } catch {
    return { ok: false, error: "That file couldn't be read as an image." };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}
