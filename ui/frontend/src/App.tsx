import { useTheme } from 'next-themes';
import { ClockIcon, GridIcon, GuideIcon, ImageIcon, InfoIcon, MoonIcon, ShieldCheckIcon, SunIcon, TableIcon } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ControlSizeProvider } from '@/components/ui/control-size';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toast';
import { formatNumber } from '@/lib/persian';
import { colorName } from '@/lib/pixel-api';
import { usePixelStudio, type Studio } from '@/hooks/use-pixel-studio';
import { ImagePanel } from '@/features/ImagePanel';
import { MatrixPanel } from '@/features/MatrixPanel';
import { UploadPanel } from '@/features/UploadPanel';

function Guide() {
  return <Dialog><DialogTrigger asChild><Button variant="ghost" className="w-full justify-start"><GuideIcon aria-hidden="true" />راهنمای آزمایشگاه</Button></DialogTrigger><DialogContent>
    <DialogHeader><DialogTitle>از تصویر تا ماتریس</DialogTitle><DialogDescription>هر سطر از تصویر، سطری از مقدارهای پیکسل است.</DialogDescription></DialogHeader>
    <div className="space-y-4 text-body leading-relaxed text-muted-foreground"><p>یک PNG باز کنید و روی تصویر یا پنجرهٔ رنگی ماتریس کلیک کنید. برای جابه‌جایی دقیق‌تر، مختصات را وارد کنید یا از کلیدهای جهت‌نما روی تصویر و ماتریس استفاده کنید.</p><p>برای بازسازی، بخش «ماتریس به تصویر» را انتخاب و فایل متنی خروجی پروژه را باز کنید. PNG بازسازی‌شده از همان مقادیر ساخته می‌شود؛ اطلاعات جانبی فایل اصلی حفظ نمی‌شوند.</p><p>حد رابط ۳ میلیون پیکسل و طول هر ضلع ۴۰۹۶ است. مقادیر ۱۶بیتی در فایل حفظ می‌شوند؛ رنگ نمایشی و HEX به ۸ بیت تبدیل می‌شوند.</p><p>نتایج موقت‌اند. با بازکردن فایل‌های جدید ممکن است نتیجهٔ قدیمی از حافظه حذف شود؛ برای نگهداری، فایل خروجی را دریافت کنید.</p></div>
  </DialogContent></Dialog>;
}
function Stats({ studio }: { studio: Studio }) {
  const { session } = studio;
  const stats = [
    { title: 'ابعاد تصویر', value: session ? `${formatNumber(session.width)} × ${formatNumber(session.height)}` : '—', note: 'عرض × ارتفاع، پیکسل', Icon: ImageIcon, direction: true },
    { title: 'تعداد پیکسل‌ها', value: session ? formatNumber(session.width * session.height) : '—', note: 'خانه‌های ماتریس', Icon: GridIcon },
    { title: 'ساختار ماتریس', value: session ? colorName(session.channels) : '—', note: session ? `${formatNumber(session.sample_depth)} بیت برای هر کانال` : 'کانال‌های رنگ و شفافیت', Icon: TableIcon, direction: true },
    { title: 'زمان تبدیل', value: session ? formatNumber(session.elapsed) : '—', note: 'میلی‌ثانیه، روی همین رایانه', Icon: ClockIcon }
  ];
  return <section aria-label="مشخصات تصویر" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {stats.map(({ title, value, note, Icon, direction }) => <Card key={title}><CardContent className="flex items-start gap-3 pt-card"><span className="rounded-lg bg-subtle p-2 text-muted-foreground"><Icon aria-hidden="true" className="size-5" /></span><div className="min-w-0"><p className="text-label text-muted-foreground">{title}</p><p className="mt-1 text-heading font-medium tabular-nums"><bdi dir={direction ? 'ltr' : undefined}>{value}</bdi></p><p className="mt-1 text-caption text-muted-foreground">{note}</p></div></CardContent></Card>)}
  </section>;
}
function Workspace({ studio }: { studio: Studio }) {
  return <div className="flex min-w-0 flex-col gap-section">
    <UploadPanel key={studio.mode} studio={studio} />
    {studio.error && <Alert color="destructive" variant="flat" role="alert"><InfoIcon aria-hidden="true" /><AlertTitle>عملیات انجام نشد</AlertTitle><AlertDescription>{studio.error}{studio.session && ' نتیجهٔ قبلی همچنان نمایش داده می‌شود.'}</AlertDescription></Alert>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-description text-muted-foreground">تصویر و داده‌های آن، کنار هم</p><span role="status" aria-live="polite"><Badge variant="soft" color={studio.error ? 'destructive' : studio.busy ? 'info' : studio.cancelled ? 'default' : studio.session ? 'success' : 'default'}>{studio.status}</Badge></span></div>
    <div className="grid min-w-0 grid-cols-1 gap-section xl:grid-cols-2"><section aria-labelledby="image-panel-title" className="min-w-0"><ImagePanel studio={studio} /></section><section aria-labelledby="matrix-panel-title" className="min-w-0"><MatrixPanel studio={studio} /></section></div>
    <Stats studio={studio} />
    <p className="flex items-start gap-2 text-caption text-muted-foreground"><InfoIcon aria-hidden="true" className="size-4 shrink-0" />خروجی PNG پیکسل‌ها را بازسازی می‌کند؛ اطلاعات جانبی فایل اصلی حفظ نمی‌شوند.</p>
  </div>;
}
export default function App() {
  const studio = usePixelStudio();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  return <ControlSizeProvider size="default" mobileSize="xl">
    <Tabs value={studio.mode} onValueChange={studio.changeMode} className="min-h-screen gap-0 bg-subtle text-foreground">
      <aside aria-label="ناوبری آزمایشگاه" className="flex flex-col gap-section border-b bg-background p-5 lg:fixed lg:inset-y-0 lg:start-0 lg:z-10 lg:w-60 lg:border-e lg:border-b-0">
        <a href="/" className="flex items-center gap-3" aria-label="پیکسل، صفحهٔ اصلی"><span className="rounded-lg bg-primary p-2 text-primary-foreground"><GridIcon aria-hidden="true" className="size-6" /></span><span className="text-heading font-bold">پیکسل<span className="mt-1 block text-caption font-normal text-muted-foreground">آزمایشگاه تصویر</span></span></a>
        <div className="flex flex-col gap-3"><p className="hidden text-caption text-muted-foreground lg:block">ابزارهای تبدیل</p><TabsList aria-label="انتخاب مسیر تبدیل" className="flex w-full gap-2 lg:h-auto lg:flex-col lg:items-stretch"><TabsTrigger value="decode" disabled={studio.busy} className="min-w-0 flex-1 justify-start gap-2"><ImageIcon aria-hidden="true" />تصویر به ماتریس</TabsTrigger><TabsTrigger value="encode" disabled={studio.busy} className="min-w-0 flex-1 justify-start gap-2"><TableIcon aria-hidden="true" />ماتریس به تصویر</TabsTrigger></TabsList></div>
        <div className="hidden rounded-xl bg-subtle p-4 lg:block"><ShieldCheckIcon aria-hidden="true" className="mb-3 size-6 text-muted-foreground" /><p className="text-label font-medium">محلی و قابل بررسی</p><p className="mt-2 text-description leading-relaxed text-muted-foreground">تبدیل با کد Python پروژه انجام می‌شود. فایل‌ها روی همین رایانه می‌مانند.</p></div>
        <div className="hidden lg:mt-auto lg:block"><Guide /><p className="mt-4 border-t pt-4 text-caption text-muted-foreground">پروژهٔ دانشگاهی بینایی ماشین</p></div>
      </aside>
      <div className="min-w-0 lg:ms-60">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-gutter py-3"><p className="text-description text-muted-foreground">آزمایشگاه <span className="mx-3 text-border">/</span><span className="text-foreground">{studio.mode === 'decode' ? 'تصویر به ماتریس' : 'ماتریس به تصویر'}</span></p><div className="flex items-center gap-3"><Badge variant="soft">اجرای محلی</Badge><Button variant="ghost" size="icon" aria-label={dark ? 'فعال‌کردن حالت روشن' : 'فعال‌کردن حالت تیره'} aria-pressed={dark} onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? <SunIcon aria-hidden="true" /> : <MoonIcon aria-hidden="true" />}</Button></div></header>
        <main className="mx-auto min-w-0 max-w-page p-gutter">
          <div className="mb-section flex flex-wrap items-start justify-between gap-6"><div><p className="mb-2 text-caption text-muted-foreground">آزمایشگاه تعاملی PNG و ماتریس</p><h1 className="text-title font-bold leading-snug">{studio.mode === 'decode' ? 'هر تصویر، دنیایی از پیکسل‌ها' : 'از عددها، تصویر بسازید'}</h1><p className="mt-2 max-w-prose text-description leading-relaxed text-muted-foreground">{studio.mode === 'decode' ? 'تصویر را باز کنید و ببینید پشت هر رنگ چه عددهایی قرار دارند.' : 'ماتریس را باز کنید و تصویر ساخته‌شده از همان پیکسل‌ها را ببینید.'}</p></div><div className="lg:hidden"><Guide /></div></div>
          <TabsContent value="decode" className="m-0 min-w-0">{studio.mode === 'decode' && <Workspace studio={studio} />}</TabsContent>
          <TabsContent value="encode" className="m-0 min-w-0">{studio.mode === 'encode' && <Workspace studio={studio} />}</TabsContent>
        </main>
        <footer className="flex flex-wrap justify-between gap-2 border-t px-gutter py-4 text-caption text-muted-foreground"><span>پیکسل؛ ابزار آموزشی بینایی ماشین</span><span>فایل‌ها روی همین رایانه پردازش می‌شوند.</span></footer>
      </div>
    </Tabs>
    <Toaster appearance="surface" />
  </ControlSizeProvider>;
}
