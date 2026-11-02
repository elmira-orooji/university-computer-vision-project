export type Mode = 'decode' | 'encode';
export type Pixel = { x: number; y: number; values: number[]; rgba: [number, number, number, number] };
export type PixelWindow = { x: number; y: number; start_x: number; start_y: number; rows: Pixel[][] };
export type Session = {
  id: string; name: string; width: number; height: number; bit_depth: number; sample_depth: 8 | 16;
  channels: 1 | 2 | 3 | 4; color_type: number; interlace: number; bytes: number;
  mode: Mode; elapsed: number; window: PixelWindow;
};
export type UploadContext = { onProgress: (percent: number) => void; signal: AbortSignal };

export function validWindow(value: unknown): value is PixelWindow {
  if (!value || typeof value !== 'object') return false;
  const window = value as PixelWindow;
  return Number.isInteger(window.x) && Number.isInteger(window.y) && Array.isArray(window.rows) &&
    window.rows.length > 0 && window.rows.length <= 16 && window.rows.every(row => Array.isArray(row) && row.length > 0 && row.length <= 16 &&
      row.every(pixel => pixel && Number.isInteger(pixel.x) && Number.isInteger(pixel.y) &&
        Array.isArray(pixel.rgba) && pixel.rgba.length === 4 && pixel.rgba.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
        Array.isArray(pixel.values) && pixel.values.length >= 1 && pixel.values.length <= 4 && pixel.values.every(n => Number.isInteger(n) && n >= 0 && n <= 65535)));
}
export function assertSession(value: unknown): asserts value is Session {
  const data = value as Session | null;
  if (!data || !/^[a-f0-9]{32}$/.test(data.id) || typeof data.name !== 'string' ||
    !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width <= 0 || data.height <= 0 ||
    ![1, 2, 3, 4].includes(data.channels) || ![8, 16].includes(data.sample_depth) || !validWindow(data.window)) {
    throw Error('ساختار پاسخ سرور معتبر نیست.');
  }
  selectedPixel(data.window);
}
export async function sample(name: string, signal: AbortSignal): Promise<Session> {
  const response = await fetch('/api/sample?name=' + encodeURIComponent(name), { method: 'POST', signal });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'بازکردن نمونه انجام نشد.');
  assertSession(data);
  return data;
}
export function upload(file: File, mode: Mode, context: UploadContext): Promise<Session> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => context.signal.removeEventListener('abort', abort);
    xhr.open('POST', `/api/convert?mode=${mode}&name=${encodeURIComponent(file.name)}`);
    xhr.timeout = 90000;
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = event => { if (event.lengthComputable) context.onProgress(event.loaded / event.total * 100); };
    xhr.onload = () => {
      cleanup();
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300) throw Error(data.error || 'تبدیل فایل انجام نشد.');
        assertSession(data);
        resolve(data);
      } catch (error) { reject(error); }
    };
    xhr.onerror = () => { cleanup(); reject(Error('ارتباط با سرور محلی برقرار نشد.')); };
    xhr.ontimeout = () => { cleanup(); reject(Error('زمان انتظار تمام شد؛ کمی بعد دوباره تلاش کنید.')); };
    xhr.onabort = () => { cleanup(); reject(new DOMException('بارگذاری لغو شد.', 'AbortError')); };
    if (context.signal.aborted) { reject(new DOMException('بارگذاری لغو شد.', 'AbortError')); return; }
    context.signal.addEventListener('abort', abort, { once: true });
    xhr.send(file);
  });
}
export async function readWindow(id: string, x: number, y: number, signal: AbortSignal): Promise<PixelWindow> {
  const response = await fetch(`/api/window?id=${id}&x=${x}&y=${y}`, { signal });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || 'دریافت پیکسل انجام نشد.');
  if (!validWindow(data)) throw Error('ساختار پنجرهٔ پیکسل معتبر نیست.');
  return data;
}
export function selectedPixel(window: PixelWindow): Pixel {
  const cell = window.rows.flat().find(pixel => pixel.x === window.x && pixel.y === window.y);
  if (!cell) throw Error('پیکسل انتخاب‌شده در پاسخ سرور موجود نیست.');
  return cell;
}
export function displayValues(pixel: Pixel, depth: number): number[] {
  const alpha = depth === 16 ? 65535 : 255;
  if (pixel.values.length === 1) return [...Array(3).fill(pixel.values[0]), alpha];
  if (pixel.values.length === 2) return [...Array(3).fill(pixel.values[0]), pixel.values[1]];
  return pixel.values.length === 3 ? [...pixel.values, alpha] : pixel.values;
}
export const colorName = (channels: number) => ({ 1: 'GRAY', 2: 'GRAY + A', 3: 'RGB', 4: 'RGBA' })[channels];
