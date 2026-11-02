import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * حالتِ خالی: جایی که فهرست، جدول یا جست‌وجو چیزی برای نشان‌دادن ندارد.
 *
 * هر صفحه‌ای که داده نشان می‌دهد یک روز خالی است (اولین ورود، فیلترِ بی‌نتیجه،
 * صندوقِ پیامِ خوانده‌شده)؛ بدونِ این کامپوننت هر صفحه یک پاراگرافِ خاکستریِ
 * متفاوت می‌گذاشت. ساختار همیشه یکی است: آیکون، عنوانِ کوتاه، یک خط توضیح که
 * می‌گوید چرا خالی است، و حداکثر دو کنشِ روشن برای خروج از این حالت.
 */
const emptyStateVariants = cva(
  "flex flex-col items-center justify-center gap-3 text-center",
  {
    variants: {
      variant: {
        default: "",
        bordered: "rounded-xl border border-dashed border-border",
        muted: "rounded-xl bg-muted",
      },
      size: {
        sm: "px-4 py-6",
        default: "px-6 py-10",
        lg: "px-8 py-16",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

type EmptyStateProps = React.ComponentProps<"div"> &
  VariantProps<typeof emptyStateVariants>

function EmptyState({ className, variant, size, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      data-variant={variant ?? "default"}
      data-size={size ?? "default"}
      className={cn(emptyStateVariants({ variant, size }), className)}
      {...props}
    />
  )
}

/** قابِ دایره‌ای آیکون؛ آیکون خودکار ۲۴px می‌شود. */
function EmptyStateIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="empty-state-icon"
      aria-hidden
      className={cn(
        "mb-1 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [[data-variant=muted]_&]:bg-background [&>svg]:size-6",
        className
      )}
      {...props}
    />
  )
}

function EmptyStateTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="empty-state-title"
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function EmptyStateDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-state-description"
      className={cn("max-w-sm text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/** جای دکمه‌ها؛ کنشِ اصلی را اول بگذارید (در RTL سمتِ راست می‌نشیند). */
function EmptyStateActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-state-actions"
      className={cn("mt-2 flex flex-wrap items-center justify-center gap-2", className)}
      {...props}
    />
  )
}

export {
  EmptyState,
  EmptyStateIcon,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateActions,
  emptyStateVariants,
  type EmptyStateProps,
}
