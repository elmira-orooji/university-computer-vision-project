import { useCallback, useEffect, useRef, useState } from 'react';
import { readWindow, sample, selectedPixel, upload, type Mode, type Pixel, type Session, type UploadContext } from '@/lib/pixel-api';

export function usePixelStudio() {
  const [mode, setMode] = useState<Mode>('decode');
  const [session, setSession] = useState<Session | null>(null);
  const [pixel, setPixel] = useState<Pixel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [status, setStatus] = useState('آمادهٔ بازکردن تصویر');
  const working = useRef(false);
  const active = useRef<Session | null>(null);
  const pending = useRef<AbortController | null>(null);
  const windowSequence = useRef(0);
  const apply = useCallback((data: Session) => {
    pending.current?.abort();
    windowSequence.current++;
    active.current = data;
    setSession(data);
    setPixel(selectedPixel(data.window));
    setStatus('تبدیل تکمیل شد');
  }, []);
  const loadSample = useCallback(async (name: string, external?: AbortSignal) => {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError(''); setCancelled(false); setStatus('در حال بازکردن نمونه…');
    pending.current?.abort(); windowSequence.current++;
    const controller = new AbortController();
    const abort = () => controller.abort();
    external?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, 90000);
    try { apply(await sample(name, controller.signal)); }
    catch (exception) {
      if (!external?.aborted) setError(controller.signal.aborted ? 'زمان انتظار تمام شد؛ دوباره تلاش کنید.' : (exception as Error).message);
      setStatus('بازکردن نمونه انجام نشد');
    } finally {
      clearTimeout(timer); external?.removeEventListener('abort', abort);
      working.current = false; setBusy(false);
    }
  }, [apply]);
  useEffect(() => {
    const controller = new AbortController();
    void loadSample('flower', controller.signal);
    return () => { controller.abort(); pending.current?.abort(); };
  }, [loadSample]);
  const changeMode = (next: string) => {
    if (working.current || (next !== 'encode' && next !== 'decode')) return;
    pending.current?.abort(); windowSequence.current++;
    active.current = null; setSession(null); setPixel(null); setError('');
    setMode(next); setCancelled(false); setStatus(next === 'decode' ? 'آمادهٔ بازکردن تصویر' : 'آمادهٔ بازکردن ماتریس');
  };
  const convert = async (file: File, context: UploadContext) => {
    if (working.current) throw Error('یک عملیات در حال اجراست؛ کمی بعد دوباره تلاش کنید.');
    working.current = true; setBusy(true); setError(''); setCancelled(false); setStatus('در حال تبدیل فایل…');
    pending.current?.abort(); windowSequence.current++;
    try { apply(await upload(file, mode, context)); }
    catch (exception) {
      if (!context.signal.aborted) setError((exception as Error).message);
      setCancelled(context.signal.aborted);
      setStatus(context.signal.aborted ? 'بارگذاری لغو شد' : 'تبدیل انجام نشد');
      throw exception;
    } finally { working.current = false; setBusy(false); }
  };
  const visit = async (x: number, y: number) => {
    const current = active.current;
    if (!current || working.current) return;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= current.width || y >= current.height) {
      setError('مختصات باید داخل ابعاد تصویر باشند.'); return;
    }
    pending.current?.abort();
    const sequence = ++windowSequence.current;
    setError('');
    const existing = current.window.rows.flat().find(p => p.x === x && p.y === y);
    if (existing) { setPixel(existing); return; }
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const window = await readWindow(current.id, x, y, controller.signal);
      if (sequence === windowSequence.current && current.id === active.current?.id) {
        const next = { ...current, window };
        active.current = next; setSession(next); setPixel(selectedPixel(window));
      }
    } catch (exception) {
      if (sequence === windowSequence.current) setError(controller.signal.aborted ? 'دریافت پیکسل طول کشید؛ دوباره تلاش کنید.' : (exception as Error).message);
    } finally { clearTimeout(timer); }
  };
  const download = async (kind: 'png' | 'matrix') => {
    const current = active.current;
    if (!current || working.current) return;
    working.current = true; setBusy(true); setError(''); setCancelled(false); setStatus('در حال آماده‌سازی خروجی…');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(`/api/file?id=${current.id}&kind=${kind}`, { signal: controller.signal });
      if (!response.ok) { const data = await response.json(); throw Error(data.error || 'دریافت فایل انجام نشد.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = kind === 'png' ? 'reconstructed.png' : 'pixel_matrix.txt'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('فایل خروجی آماده شد');
    } catch (exception) { setError(controller.signal.aborted ? 'زمان دریافت فایل تمام شد.' : (exception as Error).message); setStatus('دریافت خروجی انجام نشد'); }
    finally { clearTimeout(timer); working.current = false; setBusy(false); }
  };
  return { mode, session, pixel, busy, error, cancelled, status, changeMode, loadSample, convert, visit, download };
}
export type Studio = ReturnType<typeof usePixelStudio>;
