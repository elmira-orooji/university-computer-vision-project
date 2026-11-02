"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * رنگ Alert هم مثل Button با متغیرهای CSS منتقل می‌شود: --alert/--alert-foreground
 * برای حالت پررنگ و --alert-subtle/--alert-subtle-foreground برای پس‌زمینهٔ ملایم
 * (از توکن‌های `-subtle` که در globals.css برای همین منظور کنترل کنتراست شده‌اند).
 * محور `color` فقط این چهار متغیر را ست می‌کند و محور `variant` تصمیم می‌گیرد
 * رنگ کجا بنشیند. افزودن رنگ تازه = یک سطر در محور color.
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        // متن با رنگِ «subtle-foreground» (۷۰۰ در روشن، ۲۰۰ در تیره)؛ رنگِ اصلیِ هشدار (کهربایی ۵۰۰) روی کارت ۲:۱ بود.
        default: "bg-card text-(color:--alert-subtle-foreground)",
        solid:
          "border-transparent bg-(color:--alert) text-(color:--alert-foreground)",
        bordered:
          "border-(color:--alert)/40 bg-background text-(color:--alert-subtle-foreground)",
        flat: "border-transparent bg-(color:--alert-subtle) text-(color:--alert-subtle-foreground)",
        faded:
          "border-(color:--alert)/25 bg-(color:--alert-subtle) text-(color:--alert-subtle-foreground)",
      },
      color: {
        default:
          "[--alert:var(--color-foreground)] [--alert-foreground:var(--color-background)] [--alert-subtle:var(--color-muted)] [--alert-subtle-foreground:var(--color-foreground)]",
        primary:
          "[--alert:var(--color-primary)] [--alert-foreground:var(--color-primary-foreground)] [--alert-subtle:var(--color-primary-subtle)] [--alert-subtle-foreground:var(--color-primary-subtle-foreground)]",
        info: "[--alert:var(--color-info)] [--alert-foreground:var(--color-info-foreground)] [--alert-subtle:var(--color-info-subtle)] [--alert-subtle-foreground:var(--color-info-subtle-foreground)]",
        success:
          "[--alert:var(--color-success)] [--alert-foreground:var(--color-success-foreground)] [--alert-subtle:var(--color-success-subtle)] [--alert-subtle-foreground:var(--color-success-subtle-foreground)]",
        warning:
          "[--alert:var(--color-warning)] [--alert-foreground:var(--color-warning-foreground)] [--alert-subtle:var(--color-warning-subtle)] [--alert-subtle-foreground:var(--color-warning-subtle-foreground)]",
        destructive:
          "[--alert:var(--color-destructive)] [--alert-foreground:var(--color-destructive-foreground)] [--alert-subtle:var(--color-destructive-subtle)] [--alert-subtle-foreground:var(--color-destructive-subtle-foreground)]",
      },
      radius: {
        none: "rounded-none",
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        full: "rounded-full",
      },
    },
    compoundVariants: [
      // حالت خنثای پیش‌فرض رنگ اصلی متن را از توکن مات‌شدهٔ card می‌گیرد، نه از
      // currentColor؛ برای بقیهٔ ترکیب‌ها currentColor خودش رنگ درست هر واریانت را دارد.
      {
        variant: "default",
        color: "default",
        class: "*:data-[slot=alert-description]:text-muted-foreground",
      },
    ],
    defaultVariants: {
      variant: "default",
      color: "default",
      radius: "lg",
    },
  }
)

type AlertColor = NonNullable<VariantProps<typeof alertVariants>["color"]>

/** رنگ فعلی Alert را به AlertIcon می‌رساند تا آیکون پیش‌فرض متناسب انتخاب شود. */
const AlertContext = React.createContext<{ color: AlertColor }>({
  color: "default",
})

const iconStrokeProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const

/**
 * آیکون پیش‌فرض هر رنگ؛ فقط وقتی استفاده می‌شود که AlertIcon بدون children
 * صدا زده شود. دقیقاً مثل محور color خودِ Alert: یک نگاشت ساده، نه بیشتر.
 */
const defaultAlertIcons: Record<
  AlertColor,
  React.ReactElement<{ className?: string }>
> = {
  default: (
    <svg {...iconStrokeProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
  primary: (
    <svg {...iconStrokeProps}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  ),
  info: (
    <svg {...iconStrokeProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  ),
  success: (
    <svg {...iconStrokeProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  warning: (
    <svg {...iconStrokeProps}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  destructive: (
    <svg {...iconStrokeProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  ),
}

type AlertProps = Omit<React.ComponentProps<"div">, "color"> &
  VariantProps<typeof alertVariants> & {
    /** دکمهٔ بستن را نشان می‌دهد؛ با کلیک، Alert از درخت DOM حذف می‌شود. */
    dismissible?: boolean
    /** حالت کنترل‌شدهٔ نمایش. */
    open?: boolean
    /** حالت اولیهٔ نمایش وقتی کنترل‌نشده است. */
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
  }

function Alert({
  className,
  variant,
  color,
  radius,
  dismissible = false,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  children,
  ...props
}: AlertProps) {
  const [openState, setOpenState] = React.useState(defaultOpen)
  const open = openProp ?? openState

  const close = React.useCallback(() => {
    if (openProp === undefined) setOpenState(false)
    onOpenChange?.(false)
  }, [openProp, onOpenChange])

  if (!open) return null

  return (
    <AlertContext.Provider value={{ color: color ?? "default" }}>
      <div
        data-slot="alert"
        data-variant={variant}
        data-color={color}
        role="alert"
        className={cn(
          alertVariants({ variant, color, radius }),
          dismissible && "pe-9",
          className
        )}
        {...props}
      >
        {children}
        {dismissible && (
          <button
            type="button"
            data-slot="alert-close"
            aria-label="بستن"
            onClick={close}
            className="absolute end-3 top-3 rounded-xs opacity-70 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>
    </AlertContext.Provider>
  )
}

type AlertIconProps = {
  className?: string
  /** آیکون دلخواه؛ اگر ندهید، آیکون پیش‌فرض همان رنگِ Alert نمایش داده می‌شود. */
  children?: React.ReactElement<{ className?: string }>
}

/** ستون اول Alert. بدون children یک آیکون پیش‌فرض متناسب با color نشان می‌دهد. */
function AlertIcon({ className, children }: AlertIconProps) {
  const { color } = React.useContext(AlertContext)
  const icon = children ?? defaultAlertIcons[color]
  return React.cloneElement(icon, {
    className: cn(icon.props.className, className),
  })
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-current/85 [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

/** ردیف اقدام (مثلاً یک دکمه) زیر عنوان/توضیح؛ به همان ستون دوم گرید می‌پیوندد. */
function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("col-start-2 mt-2 flex items-center gap-2", className)}
      {...props}
    />
  )
}

export {
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  AlertAction,
  alertVariants,
  type AlertProps,
  type AlertColor,
}
