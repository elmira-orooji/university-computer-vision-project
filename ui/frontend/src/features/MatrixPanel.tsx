import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTheme } from 'next-themes';
import { CopyIcon, DownloadIcon, GridIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { formatNumber } from '@/lib/persian';
import { colorName, displayValues } from '@/lib/pixel-api';
import type { Studio } from '@/hooks/use-pixel-studio';

function PixelMap({ studio }: { studio: Studio }) {
  const { resolvedTheme } = useTheme();
  const { session, pixel, busy, visit } = studio;
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!session || !canvas.current) return;
    const ctx = canvas.current.getContext('2d');
    if (!ctx) return;
    const rows = session.window.rows, height = rows.length, width = rows[0].length;
    ctx.clearRect(0, 0, 400, 400);
    const bitmap = ctx.createImageData(400, 400);
    rows.forEach((row, y) => row.forEach((cell, x) => {
      // These are file pixels, not UI colors: copy RGBA samples into ImageData.
      for (let py = Math.ceil(y * 400 / height + 2); py < (y + 1) * 400 / height - 2; py++) {
        for (let px = Math.ceil(x * 400 / width + 2); px < (x + 1) * 400 / width - 2; px++) {
          bitmap.data.set(cell.rgba, (py * 400 + px) * 4);
        }
      }
    }));
    ctx.putImageData(bitmap, 0, 0);
    rows.forEach((row, y) => row.forEach((cell, x) => {
      if (cell.x === pixel?.x && cell.y === pixel.y) {
        ctx.strokeStyle = getComputedStyle(canvas.current!).getPropertyValue('--foreground').trim();
        ctx.lineWidth = 3;
        ctx.strokeRect(x * 400 / width + 1, y * 400 / height + 1, 400 / width - 2, 400 / height - 2);
      }
    }));
  }, [session, pixel, resolvedTheme]);
  const pick = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!session || busy) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rows = session.window.rows;
    const row = Math.min(rows.length - 1, Math.floor((event.clientY - rect.top) / rect.height * rows.length));
    const column = Math.min(rows[0].length - 1, Math.floor((event.clientX - rect.left) / rect.width * rows[0].length));
    void visit(rows[row][column].x, rows[row][column].y);
  };
  const move = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (!session || !pixel || busy) return;
    const offsets: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!offsets[event.key]) return;
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    if (pixel.x + dx >= 0 && pixel.x + dx < session.width && pixel.y + dy >= 0 && pixel.y + dy < session.height) void visit(pixel.x + dx, pixel.y + dy);
  };
  return <canvas ref={canvas} width={400} height={400} tabIndex={busy ? -1 : 0} role="img" aria-label="پنجرهٔ ماتریس پیکسل؛ برای جابه‌جایی از کلیدهای جهت‌نما استفاده کنید"
    onClick={pick} onKeyDown={move} className="pixel-checker mx-auto aspect-square w-full max-w-64 cursor-crosshair rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring" />;
}
function PixelSwatch({ pixel }: { pixel: Studio['pixel'] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1, 1);
    if (pixel) ctx.putImageData(new ImageData(Uint8ClampedArray.from(pixel.rgba), 1, 1), 0, 0);
  }, [pixel]);
  return <span className="pixel-checker size-9 shrink-0 overflow-hidden rounded-md"><canvas aria-hidden="true" ref={ref} width={1} height={1} className="h-full w-full" /></span>;
}
export function MatrixPanel({ studio }: { studio: Studio }) {
  const { session, pixel, busy, mode, visit, download, loadSample } = studio;
  const [x, setX] = useState('0'), [y, setY] = useState('0');
  const [coordinateError, setCoordinateError] = useState('');
  useEffect(() => { setX(String(pixel?.x ?? 0)); setY(String(pixel?.y ?? 0)); setCoordinateError(''); }, [pixel]);
  const values = pixel && session ? displayValues(pixel, session.sample_depth) : null;
  const hex = pixel ? '#' + pixel.rgba.slice(0, 3).map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase() : '—';
  const coordinatesValid = session && x.trim() && y.trim() && Number.isInteger(Number(x)) && Number.isInteger(Number(y)) && Number(x) >= 0 && Number(y) >= 0 && Number(x) < session.width && Number(y) < session.height;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!coordinatesValid) { setCoordinateError('مختصات باید داخل ابعاد تصویر باشند.'); return; }
    setCoordinateError(''); void visit(Number(x), Number(y));
  };
  const copy = async () => {
    if (!pixel) return;
    try { await navigator.clipboard.writeText(JSON.stringify({ x: pixel.x, y: pixel.y, values: pixel.values })); toast.success('مقدار پیکسل کپی شد.'); }
    catch { toast.error('مرورگر اجازهٔ کپی نداد.'); }
  };
  return <Card className="flex min-w-0 flex-col" aria-busy={busy}>
    <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle asChild className="text-subheading font-medium"><h2 id="matrix-panel-title" className="flex items-center gap-2"><GridIcon aria-hidden="true" className="size-5 text-muted-foreground" />ماتریس پیکسل‌ها</h2></CardTitle><Badge variant="soft">{session ? colorName(session.channels) : 'بدون داده'}</Badge></CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4">
      <Tabs defaultValue="colors" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><TabsList aria-label="نمایش ماتریس"><TabsTrigger value="colors">نمای رنگی</TabsTrigger><TabsTrigger value="values">مقادیر</TabsTrigger></TabsList><span className="text-caption text-muted-foreground">{session ? `${formatNumber(session.height)} سطر × ${formatNumber(session.width)} ستون` : 'پنجرهٔ پیکسل'}</span></div>
        <TabsContent value="colors" className="min-w-0">
          {session ? <PixelMap studio={studio} /> : busy ? <Skeleton className="mx-auto aspect-square w-full max-w-64" /> : <EmptyState size="sm"><EmptyStateIcon><GridIcon aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>هنوز ماتریسی نداریم</EmptyStateTitle><EmptyStateDescription>با بازکردن فایل، پنجرهٔ پیکسل‌ها اینجا نمایش داده می‌شود.</EmptyStateDescription><EmptyStateActions><Button variant="outline" onClick={() => void loadSample(mode === 'decode' ? 'flower' : 'matrix')}>بازکردن نمونه</Button></EmptyStateActions></EmptyState>}
        </TabsContent>
        <TabsContent value="values" className="min-w-0"><pre dir="ltr" className="h-64 overflow-auto rounded-lg bg-subtle p-4 font-mono text-caption leading-relaxed">{session ? session.window.rows.map(row => '[' + row.map(cell => '(' + cell.values.join(', ') + ')').join(', ') + ']').join('\n') : 'پس از بازکردن فایل، مقادیر اینجا نمایش داده می‌شوند.'}</pre></TabsContent>
      </Tabs>
      <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground"><span>{session ? `${formatNumber(session.window.rows.length)} × ${formatNumber(session.window.rows[0].length)} پیکسل` : 'هر خانه، یک پیکسل'}</span><bdi dir="ltr">X: {pixel ? formatNumber(pixel.x) : '—'} / Y: {pixel ? formatNumber(pixel.y) : '—'}</bdi></div>
      <div className="rounded-lg bg-subtle p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-label font-medium">پیکسل انتخاب‌شده</h3><Button variant="ghost" size="icon" aria-label="کپی مقدار پیکسل" disabled={!pixel || busy} onClick={() => void copy()}><CopyIcon aria-hidden="true" /></Button></div>
        <div className="flex flex-wrap items-center gap-3" dir="ltr" aria-live="polite" aria-atomic="true">
          <PixelSwatch pixel={pixel} />
          {['R', 'G', 'B', 'A'].map((label, index) => <div key={label} className="min-w-7 text-center"><span className="block text-caption text-muted-foreground">{label}</span><span className="text-description tabular-nums">{values ? formatNumber(values[index]) : '—'}</span></div>)}
          <span className="ms-auto text-caption text-muted-foreground">{hex}</span>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3"><TextField label="ستون (X)" inputMode="numeric" dir="ltr" faDigits value={x} onValueChange={setX} disabled={!session || busy} invalid={!!coordinateError} description={session ? `صفر تا ${formatNumber(session.width - 1)}` : 'مختصات افقی'} /><TextField label="سطر (Y)" inputMode="numeric" dir="ltr" faDigits value={y} onValueChange={setY} disabled={!session || busy} invalid={!!coordinateError} description={session ? `صفر تا ${formatNumber(session.height - 1)}` : 'مختصات عمودی'} /></div>
        {coordinateError && <p role="alert" className="text-description text-destructive">{coordinateError}</p>}
        <Button type="submit" variant="outline" disabled={!coordinatesValid || busy}>نمایش پیکسل</Button>
      </form>
    </CardContent>
    <CardFooter className="flex-wrap justify-between gap-3 border-t"><span className="text-caption text-muted-foreground">{session ? `مقادیر ${formatNumber(session.sample_depth)} بیتی` : 'ماتریس کامل فایل متنی'}{session?.sample_depth === 16 && '؛ رنگ نمایشی ۸ بیت'}</span><Button variant="outline" disabled={!session || busy} onClick={() => void download('matrix')}><DownloadIcon aria-hidden="true" />دریافت ماتریس</Button></CardFooter>
  </Card>;
}
