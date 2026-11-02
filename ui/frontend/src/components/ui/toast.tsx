"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { usePresence } from "@/lib/primitives/use-presence"
import {
  AlertTriangleIcon,
  CheckIcon,
  CircleXIcon,
  InfoIcon,
  LoaderIcon,
  XIcon,
} from "@/components/icons"

/**
 * سیستم اعلان (توست) از پایه، بدون وابستگی به بستهٔ sonner.
 *
 * toast() یک تابع است، نه هوک — از هر جای کد (حتی خارج از کامپوننت) قابل
 * صداکردن است. یک فروشگاه ماژول‌سطح (خارج از React) نگهش می‌دارد و
 * Toaster با useSyncExternalStore به آن گوش می‌دهد؛ همان الگویی که خودِ
 * React برای اتصال به منابع دادهٔ بیرونی توصیه می‌کند.
 */

type ToastVariant = "default" | "success" | "error" | "warning" | "info"
type ToastAction = { label: string; onClick: () => void }
type ToastOptions = {
  id?: string | number
  description?: React.ReactNode
  action?: ToastAction
  duration?: number
  loading?: boolean
}
type ToastRecord = {
  id: string | number
  message: React.ReactNode
  description?: React.ReactNode
  variant: ToastVariant
  action?: ToastAction
  duration: number
  closing: boolean
  loading: boolean
}

let toasts: ToastRecord[] = []
let listeners: Array<(next: ToastRecord[]) => void> = []
let idCounter = 0

function emit() {
  const next = toasts
  listeners.forEach((listener) => listener(next))
}

function subscribe(listener: (next: ToastRecord[]) => void): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): ToastRecord[] {
  return toasts
}

const EMPTY_TOASTS: ToastRecord[] = []
function getServerSnapshot(): ToastRecord[] {
  return EMPTY_TOASTS
}

/**
 * «آیا روی کلاینت hydrate شده‌ایم؟» به‌شکلِ یک منبعِ خارجی.
 *
 * روی سرور و در طولِ hydration مقدار false است و بعد از آن true — همان
 * چیزی که تا حالا با useState+useEffect ساخته می‌شد، ولی بدونِ رندرِ
 * اضافه و بدونِ setState داخلِ افکت. مقدار بعد از mount هرگز عوض نمی‌شود،
 * پس اشتراک چیزی برای شنیدن ندارد.
 */
const NOOP_UNSUBSCRIBE = () => {}
function subscribeNever(): () => void {
  return NOOP_UNSUBSCRIBE
}
function getMountedSnapshot(): boolean {
  return true
}
function getMountedServerSnapshot(): boolean {
  return false
}

function addToast(
  message: React.ReactNode,
  variant: ToastVariant,
  options?: ToastOptions,
): string | number {
  const id = options?.id ?? ++idCounter
  const record: ToastRecord = {
    id,
    message,
    description: options?.description,
    variant,
    action: options?.action,
    duration: options?.duration ?? 4000,
    closing: false,
    loading: options?.loading ?? false,
  }
  const existingIndex = toasts.findIndex((t) => t.id === id)
  toasts =
    existingIndex === -1
      ? [record, ...toasts]
      : toasts.map((t, i) => (i === existingIndex ? record : t))
  emit()
  return id
}

function dismissToast(id?: string | number) {
  toasts = toasts.map((t) =>
    id === undefined || t.id === id ? { ...t, closing: true } : t,
  )
  emit()
}

function removeToast(id: string | number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

type PromiseMessages<T> = {
  loading: React.ReactNode
  success: React.ReactNode | ((data: T) => React.ReactNode)
  error: React.ReactNode | ((error: unknown) => React.ReactNode)
}

function toastPromise<T>(
  promise: Promise<T>,
  messages: PromiseMessages<T>,
): string | number {
  const id = addToast(messages.loading, "default", {
    duration: Infinity,
    loading: true,
  })
  promise.then(
    (data) => {
      const message =
        typeof messages.success === "function"
          ? messages.success(data)
          : messages.success
      addToast(message, "success", { id })
    },
    (error) => {
      const message =
        typeof messages.error === "function"
          ? messages.error(error)
          : messages.error
      addToast(message, "error", { id })
    },
  )
  return id
}

const toast = Object.assign(
  (message: React.ReactNode, options?: ToastOptions) =>
    addToast(message, "default", options),
  {
    success: (message: React.ReactNode, options?: ToastOptions) =>
      addToast(message, "success", options),
    error: (message: React.ReactNode, options?: ToastOptions) =>
      addToast(message, "error", options),
    warning: (message: React.ReactNode, options?: ToastOptions) =>
      addToast(message, "warning", options),
    info: (message: React.ReactNode, options?: ToastOptions) =>
      addToast(message, "info", options),
    promise: toastPromise,
    dismiss: (id?: string | number) => dismissToast(id),
  },
)

// آیکون داخلِ یک مربعِ نرمِ هم‌رنگ؛ رنگ نوع پیام را پیش از خواندن متن می‌رساند.
const VARIANT_ICON: Record<ToastVariant, React.ReactNode> = {
  default: null,
  success: <CheckIcon />,
  error: <CircleXIcon />,
  warning: <AlertTriangleIcon />,
  info: <InfoIcon />,
}

/** در appearance="inverse" زمینه تیره است؛ کاشیِ آیکون رنگِ پُرِ نوع را می‌گیرد تا روی تیره هم دیده شود. */
const VARIANT_ICON_BOX_INVERSE: Record<ToastVariant, string> = {
  default: "",
  success: "bg-success text-success-foreground",
  error: "bg-destructive text-destructive-foreground",
  warning: "bg-warning text-warning-foreground",
  info: "bg-info text-info-foreground",
}

const VARIANT_ICON_BOX: Record<ToastVariant, string> = {
  default: "",
  success: "bg-success-subtle text-success",
  error: "bg-destructive-subtle text-destructive",
  warning: "bg-warning-subtle text-warning",
  info: "bg-info-subtle text-info",
}

function ToastItem({
  toast: item,
  closeButton,
  richColors,
  appearance,
}: {
  toast: ToastRecord
  closeButton: boolean
  richColors: boolean
  appearance: ToastAppearance
}) {
  const { shouldRender, ref } = usePresence(!item.closing)

  React.useEffect(() => {
    if (!shouldRender) removeToast(item.id)
  }, [shouldRender, item.id])

  // تا وقتی نشانگر یا فوکوس روی پیام است زمان نمی‌گذرد؛ پیام وسطِ خواندن نمی‌رود.
  const [paused, setPaused] = React.useState(false)
  const remaining = React.useRef(item.duration)
  React.useEffect(() => {
    remaining.current = item.duration
  }, [item.duration, item.message])
  React.useEffect(() => {
    if (item.closing || paused || remaining.current === Infinity) return
    const started = Date.now()
    const timer = window.setTimeout(
      () => dismissToast(item.id),
      remaining.current,
    )
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - started
    }
  }, [item.id, item.closing, paused, item.duration, item.message])

  // نوارِ زمان: نشان می‌دهد پیام کی می‌رود (به‌خصوص وقتی «برگردان» دارد) و با هاور یا فوکوس می‌ایستد.
  const timerRef = React.useRef<HTMLSpanElement>(null)
  const timerAnimation = React.useRef<Animation | null>(null)
  const timed = item.duration !== Infinity && !item.loading
  React.useEffect(() => {
    const bar = timerRef.current
    if (!bar || !timed || typeof bar.animate !== "function") return
    timerAnimation.current = bar.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: item.duration, easing: "linear", fill: "forwards" })
    return () => timerAnimation.current?.cancel()
  }, [timed, item.duration, item.message])
  React.useEffect(() => {
    if (paused) timerAnimation.current?.pause()
    else timerAnimation.current?.play()
  }, [paused])

  if (!shouldRender) return null
  const inverse = appearance === "inverse" && !richColors

  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      data-slot="sonner-toast"
      data-variant={item.variant}
      data-state={item.closing ? "closed" : "open"}
      role={item.variant === "error" ? "alert" : "status"}
      aria-live={item.variant === "error" ? "assertive" : "polite"}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      data-appearance={appearance}
      className={cn(
        "relative overflow-hidden pointer-events-auto flex w-full max-w-[356px] items-start gap-3 rounded-xl border border-border bg-popover p-3.5 text-sm text-popover-foreground shadow-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2",
        richColors &&
          item.variant === "success" &&
          "border-success bg-success text-success-foreground",
        richColors &&
          item.variant === "error" &&
          "border-destructive bg-destructive text-destructive-foreground",
        // تیره روی هر صفحه‌ای دیده می‌شود؛ رنگِ نوع در کاشیِ آیکون است، نه کلِ کارت.
        inverse && "border-inverse-border bg-inverse text-[var(--dig-white)]",
      )}
    >
      {item.loading ? (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <LoaderIcon className="size-4 animate-spin" />
        </span>
      ) : (
        item.variant !== "default" && (
          <span
            aria-hidden
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
              richColors &&
                (item.variant === "success" || item.variant === "error")
                ? "bg-background text-foreground"
                : inverse
                  ? VARIANT_ICON_BOX_INVERSE[item.variant]
                  : VARIANT_ICON_BOX[item.variant],
            )}
          >
            {VARIANT_ICON[item.variant]}
          </span>
        )
      )}
      <div className="flex min-h-8 min-w-0 flex-1 flex-col justify-center gap-0.5">
        <p className="font-semibold leading-6">{item.message}</p>
        {item.description && (
          <p
            className={cn(
              "leading-6",
              richColors &&
                (item.variant === "success" || item.variant === "error")
                ? "text-current"
                : inverse
                  ? "text-[color-mix(in_oklab,var(--dig-white)_78%,var(--inverse))]"
                  : "text-muted-foreground",
            )}
          >
            {item.description}
          </p>
        )}
      </div>
      {item.action && (
        <button
          type="button"
          data-slot="sonner-toast-action"
          onClick={() => {
            item.action?.onClick()
            dismissToast(item.id)
          }}
          className={cn(
            "mt-0.5 shrink-0 cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2",
            inverse
              ? "border-inverse-border bg-inverse-raised text-[var(--dig-white)] hover:bg-inverse-border focus-visible:outline-[var(--dig-white)]"
              : "border-border bg-background text-foreground hover:bg-accent focus-visible:outline-foreground"
          )}
        >
          {item.action.label}
        </button>
      )}
      {timed && (
        <span
          ref={timerRef}
          aria-hidden
          data-slot="toast-timer"
          className={cn(
            "absolute inset-x-0 bottom-0 h-1 rtl:origin-right ltr:origin-left",
            inverse ? "bg-[color-mix(in_oklab,var(--dig-white)_80%,var(--inverse))]" : "bg-[color-mix(in_oklab,var(--foreground)_45%,var(--popover))]"
          )}
        />
      )}
      {closeButton && (
        <button
          type="button"
          data-slot="sonner-toast-close"
          onClick={() => dismissToast(item.id)}
          aria-label="بستن"
          className={cn(
            "shrink-0 cursor-pointer rounded-md p-1 transition-colors",
            inverse
              ? "text-[color-mix(in_oklab,var(--dig-white)_78%,var(--inverse))] hover:bg-inverse-raised hover:text-[var(--dig-white)]"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  )
}

const POSITION_CLASSES: Record<string, string> = {
  "top-left": "top-0 start-0 flex-col",
  "top-center": "top-0 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 flex-col",
  "top-right": "top-0 end-0 flex-col",
  "bottom-left": "bottom-0 start-0 flex-col-reverse",
  "bottom-center":
    "bottom-0 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 flex-col-reverse",
  "bottom-right": "bottom-0 end-0 flex-col-reverse",
}

type ToasterPosition = keyof typeof POSITION_CLASSES
/** inverse: زمینهٔ تیره که روی صفحهٔ روشن و تاریک هر دو دیده می‌شود (پیش‌فرض)؛ surface: کارتِ هم‌رنگِ popover. */
type ToastAppearance = "inverse" | "surface"

function Toaster({
  position = "bottom-left",
  dir = "rtl",
  theme,
  richColors = false,
  closeButton = false,
  appearance = "inverse",
  className,
}: {
  position?: ToasterPosition
  dir?: "rtl" | "ltr"
  theme?: "light" | "dark" | "system"
  richColors?: boolean
  closeButton?: boolean
  appearance?: ToastAppearance
  className?: string
}) {
  const items = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )
  const { theme: systemTheme } = useTheme()
  // systemTheme از next-themes فقط بعد از mount شدن در کلاینت مقدار واقعی
  // می‌گیرد (روی سرور و اولین رندر کلاینت undefined است)؛ اگر همان‌جا در
  // resolvedTheme استفاده شود، رندر سرور با رندر اول کلاینت فرق می‌کند و
  // React خطای hydration mismatch می‌دهد. با نگه‌داشتن "system" تا mount
  // شدن، هر دو رندر اول یکی می‌مانند و مقدار واقعی بعد از mount (به‌صورت
  // یک به‌روزرسانی عادی، نه در طول hydration) جایگزین می‌شود.
  //
  // پیاده‌سازی با useSyncExternalStore است، نه useState+useEffect: همان
  // نتیجه را می‌دهد بدونِ یک رندرِ اضافه بعد از hydration، و خودِ ری‌اکت
  // این را به‌عنوان راهِ درستِ «آیا hydrate شده‌ام؟» معرفی می‌کند. اشتراک
  // خالی است چون این مقدار بعد از mount دیگر هرگز عوض نمی‌شود.
  const mounted = React.useSyncExternalStore(
    subscribeNever,
    getMountedSnapshot,
    getMountedServerSnapshot,
  )
  const resolvedTheme = theme ?? (mounted ? systemTheme : undefined) ?? "system"

  return (
    <div
      data-slot="sonner-toaster"
      data-theme={resolvedTheme}
      dir={dir}
      className={cn(
        "pointer-events-none fixed z-[100] m-4 flex w-[356px] max-w-[calc(100vw-2rem)] gap-2",
        POSITION_CLASSES[position],
        className,
      )}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
    >
      {items.map((item) => (
        <ToastItem
          key={item.id}
          toast={item}
          closeButton={closeButton}
          richColors={richColors}
          appearance={appearance}
        />
      ))}
    </div>
  )
}

export { Toaster, toast }
