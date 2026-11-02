import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { DownloadIcon, ImageIcon, InfoIcon, MinusIcon, PlusIcon, RefreshIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/persian';
import type { Studio } from '@/hooks/use-pixel-studio';

export function ImagePanel({ studio }: { studio: Studio }) {
  const { session, pixel, busy, mode, visit, download, loadSample } = studio;
  const [zoom, setZoom] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => { setZoom(1); setImageError(false); }, [session?.id]);
  useEffect(() => {
    if (!session || !frame.current) return;
    const resize = () => {
      const element = frame.current;
      if (!element) return;
      const scale = Math.min(element.clientWidth * .9 / session.width, element.clientHeight * .9 / session.height);
      setSize({ width: session.width * scale, height: session.height * scale });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(frame.current); resize();
    return () => observer.disconnect();
  }, [session]);
  const pick = (event: MouseEvent<HTMLImageElement>) => {
    if (!session || busy || !image.current) return;
    const rect = image.current.getBoundingClientRect();
    void visit(Math.min(session.width - 1, Math.floor((event.clientX - rect.left) / rect.width * session.width)),
      Math.min(session.height - 1, Math.floor((event.clientY - rect.top) / rect.height * session.height)));
  };
  const move = (event: KeyboardEvent<HTMLImageElement>) => {
    if (!session || !pixel || busy) return;
    const offsets: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!offsets[event.key]) return;
    event.preventDefault();
    const [dx, dy] = offsets[event.key];
    if (pixel.x + dx >= 0 && pixel.x + dx < session.width && pixel.y + dy >= 0 && pixel.y + dy < session.height) void visit(pixel.x + dx, pixel.y + dy);
  };
  return <Card className="flex min-w-0 flex-col" aria-busy={busy}>
    <CardHeader className="flex flex-row items-center justify-between gap-3">
      <CardTitle asChild className="text-subheading font-medium"><h2 id="image-panel-title" className="flex items-center gap-2"><ImageIcon aria-hidden="true" className="size-5 text-muted-foreground" />{mode === 'decode' ? 'تصویر ورودی' : 'تصویر بازسازی‌شده'}</h2></CardTitle>
      <Badge variant="soft">PNG</Badge>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-caption text-muted-foreground">
        <bdi dir="ltr" className="max-w-full truncate">{session?.name ?? 'هنوز فایلی باز نشده'}</bdi>
        <bdi dir="ltr">{session ? `${formatNumber(session.width)} × ${formatNumber(session.height)}` : '— × —'}</bdi>
      </div>
      <div ref={frame} dir="ltr" className="pixel-checker relative grid h-72 place-items-center overflow-hidden rounded-xl sm:h-80">
        {session && !imageError ? <div className="relative shrink-0" style={{ width: size.width, height: size.height, transform: `scale(${zoom})` }}>
          <img ref={image} src={`/api/file?kind=source&id=${session.id}`} alt={`بررسی پیکسل‌های ${session.name}`} role="button" tabIndex={busy ? -1 : 0} aria-disabled={busy}
            aria-label="بررسی پیکسل‌های تصویر با کلیک یا کلیدهای جهت‌نما" onClick={pick} onKeyDown={move} onError={() => setImageError(true)} draggable={false}
            className="h-full w-full cursor-crosshair outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            style={{ imageRendering: zoom > 1 || session.width <= 64 ? 'pixelated' : 'auto' }} />
          {pixel && <span aria-hidden="true" className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-background outline-1 outline-foreground"
            style={{ insetInlineStart: `${(pixel.x + .5) / session.width * 100}%`, insetBlockStart: `${(pixel.y + .5) / session.height * 100}%` }} />}
        </div> : busy ? <div className="w-2/3 space-y-3"><Skeleton className="aspect-square w-full" /><Skeleton className="h-4 w-2/3" /></div> : <EmptyState size="sm">
          <EmptyStateIcon><ImageIcon aria-hidden="true" /></EmptyStateIcon><EmptyStateTitle>{imageError ? 'تصویر بارگذاری نشد' : 'اولین تصویر را باز کنید'}</EmptyStateTitle>
          <EmptyStateDescription>یک فایل انتخاب کنید یا با نمونهٔ پروژه شروع کنید.</EmptyStateDescription><EmptyStateActions><Button variant="outline" onClick={() => void loadSample(mode === 'decode' ? 'flower' : 'matrix')}>بازکردن نمونه</Button></EmptyStateActions>
        </EmptyState>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" dir="ltr">
          <Button variant="outline" size="icon" disabled={!session || busy || zoom <= 1} onClick={() => setZoom(v => Math.max(1, v - .5))} aria-label="کوچک‌نمایی"><MinusIcon aria-hidden="true" /></Button>
          <span className="min-w-12 text-center text-description tabular-nums">{formatNumber(zoom * 100)}٪</span>
          <Button variant="outline" size="icon" disabled={!session || busy || zoom >= 4} onClick={() => setZoom(v => Math.min(4, v + .5))} aria-label="بزرگ‌نمایی"><PlusIcon aria-hidden="true" /></Button>
          <Button variant="ghost" size="icon" disabled={!session || busy || zoom === 1} onClick={() => setZoom(1)} aria-label="بازنشانی بزرگ‌نمایی"><RefreshIcon aria-hidden="true" /></Button>
        </div>
        <span className="text-caption text-muted-foreground" dir="ltr">X: {pixel ? formatNumber(pixel.x) : '—'} / Y: {pixel ? formatNumber(pixel.y) : '—'}</span>
      </div>
      <p className="flex items-start gap-2 text-caption text-muted-foreground"><InfoIcon aria-hidden="true" className="size-4 shrink-0" />روی تصویر کلیک کنید؛ رنگ و مقادیر همان پیکسل در بخش ماتریس نمایش داده می‌شود.</p>
    </CardContent>
    <CardFooter className="justify-between gap-3 border-t"><span className="text-caption text-muted-foreground">بازسازی از مقادیر واقعی پیکسل</span><Button variant="outline" disabled={!session || busy} onClick={() => void download('png')}><DownloadIcon aria-hidden="true" />دریافت PNG</Button></CardFooter>
  </Card>;
}
