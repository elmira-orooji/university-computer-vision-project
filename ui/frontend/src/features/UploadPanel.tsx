import { useEffect, useRef, useState } from 'react';
import { ImageIcon, TableIcon, XIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload, type FileUploadHandler } from '@/components/ui/file-upload';
import { formatNumber } from '@/lib/persian';
import type { Studio } from '@/hooks/use-pixel-studio';

/** Adapted from Dig's upload-files block: one local input, real conversion, no URL imports or simulated progress. */
export function UploadPanel({ studio }: { studio: Studio }) {
  const { mode, busy, session, convert, loadSample } = studio;
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(!session);
  useEffect(() => { if (session) setExpanded(false); }, [session?.id]);
  const controller = useRef<AbortController | null>(null);
  const upload: FileUploadHandler = async (file, context) => {
    const active = new AbortController();
    controller.current = active;
    const abort = () => active.abort();
    context.signal.addEventListener('abort', abort, { once: true });
    if (context.signal.aborted) active.abort();
    setUploading(true);
    try { await convert(file, { ...context, signal: active.signal }); }
    finally {
      context.signal.removeEventListener('abort', abort);
      if (controller.current === active) controller.current = null;
      setUploading(false);
    }
  };
  const open = (name: string) => { setFiles([]); void loadSample(name); };
  return <Card>
    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4"><div className="min-w-0 space-y-2"><CardTitle asChild className="text-subheading font-medium"><h2 id="upload-title">{session && !expanded ? <bdi dir="ltr" className="block max-w-64 truncate">{session.name}</bdi> : mode === 'decode' ? 'تصویر PNG را باز کنید' : 'ماتریس را به تصویر برگردانید'}</h2></CardTitle><CardDescription>{session && !expanded ? `${formatNumber(session.width)} × ${formatNumber(session.height)} پیکسل؛ آمادهٔ بررسی و دریافت خروجی` : mode === 'decode' ? 'فایل را انتخاب کنید یا داخل ناحیهٔ زیر رها کنید.' : 'فایل متنی خروجی پروژه را انتخاب کنید.'}</CardDescription></div>{session && <Button disabled={busy} variant={expanded ? 'outline' : 'default'} aria-expanded={expanded} aria-controls="upload-content" onClick={() => setExpanded(value => !value)}>{expanded ? 'بستن انتخاب فایل' : 'تغییر فایل'}</Button>}</CardHeader>
    <CardContent id="upload-content" hidden={!expanded} className="flex flex-col gap-4">
      <FileUpload name="source" files={files} onFilesChange={setFiles} onUpload={upload} disabled={busy}
        accept={mode === 'decode' ? '.png,image/png' : '.txt,text/plain'}
        maxSize={mode === 'decode' ? 12000000 : 96000000}
        title={mode === 'decode' ? 'تصویر PNG را اینجا رها کنید یا انتخاب کنید' : 'فایل متنی ماتریس را اینجا رها کنید یا انتخاب کنید'}
        hint={mode === 'decode' ? 'PNG ثابت تا ۱۲ مگابایت؛ حداکثر ۳ میلیون پیکسل' : 'TXT با کدگذاری UTF-8 تا ۹۶ مگابایت'} />
      {uploading && <div className="flex justify-end"><Button variant="outline" onClick={() => controller.current?.abort()}><XIcon aria-hidden="true" />لغو بارگذاری</Button></div>}
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-subtle p-3">
        <span className="me-auto text-description text-muted-foreground">با نمونهٔ پروژه شروع کنید</span>
        {mode === 'decode' ? <><Button variant="outline" disabled={busy} onClick={() => open('flower')}><ImageIcon aria-hidden="true" />گل‌ها</Button><Button variant="outline" disabled={busy} onClick={() => open('shrimp')}><ImageIcon aria-hidden="true" />میگو</Button></> : <Button variant="outline" disabled={busy} onClick={() => open('matrix')}><TableIcon aria-hidden="true" />ماتریس نمونه</Button>}
      </div>
    </CardContent>
  </Card>;
}
