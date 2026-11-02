import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/persian"

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/**
 * محور color هم مثل Alert با متغیر CSS منتقل می‌شود: فقط --progress را ست
 * می‌کند، خودِ نوار پرشده (یا کمان دایره‌ای) با bg-(color:--progress) /
 * stroke-(color:--progress) رنگ می‌گیرد. افزودن رنگ تازه = یک سطر.
 */
const progressColorVariants = cva("", {
  variants: {
    color: {
      default: "[--progress:var(--color-foreground)]",
      primary: "[--progress:var(--color-primary)]",
      brand: "[--progress:var(--color-brand-secondary)]",
      success: "[--progress:var(--color-success)]",
      warning: "[--progress:var(--color-warning)]",
      destructive: "[--progress:var(--color-destructive)]",
    },
  },
  defaultVariants: { color: "brand" },
})
type ProgressColor = NonNullable<
  VariantProps<typeof progressColorVariants>["color"]
>
type ProgressSize = "sm" | "md" | "lg"

const BAR_SIZE: Record<ProgressSize, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
}

type ProgressBaseProps = {
  value?: number
  min?: number
  max?: number
  /** پیشرفت نامشخص (مقدار دقیق معلوم نیست)؛ aria-valuenow حذف می‌شود. */
  indeterminate?: boolean
  size?: ProgressSize
  color?: ProgressColor
  /** فقط برای aria-valuetext و برچسب استفاده می‌شود؛ پیش‌فرض سبک درصد با ارقام فارسی. */
  formatOptions?: Intl.NumberFormatOptions
}

function valueText(
  value: number | undefined,
  min: number,
  max: number,
  formatOptions: Intl.NumberFormatOptions | undefined
) {
  if (value === undefined) return undefined
  const ratio = max === min ? 0 : (value - min) / (max - min)
  return formatNumber(ratio, formatOptions ?? { style: "percent" })
}

function Progress({
  className,
  value,
  min = 0,
  max = 100,
  indeterminate = false,
  size = "md",
  color = "primary",
  formatOptions,
  ...props
}: Omit<React.ComponentProps<"div">, "color"> & ProgressBaseProps) {
  const clamped =
    value === undefined ? undefined : clamp(value, min, max)
  const percent =
    clamped === undefined ? 0 : ((clamped - min) / (max - min)) * 100

  return (
    <div
      data-slot="progress"
      data-indeterminate={indeterminate ? "" : undefined}
      role="progressbar"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuetext={
        indeterminate ? undefined : valueText(clamped, min, max, formatOptions)
      }
      className={cn(
        progressColorVariants({ color }),
        // ریل یک پله تیره‌تر از muted تا مرزِ پر و خالی روی کارتِ سفید هم پیدا باشد.
        "relative w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--input)_70%,var(--muted))]",
        BAR_SIZE[size],
        className
      )}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          "h-full bg-(color:--progress) transition-[width]",
          indeterminate && "w-full animate-pulse"
        )}
        style={indeterminate ? undefined : { width: `${percent}%` }}
      />
    </div>
  )
}

const CIRCLE_DIMENSIONS: Record<ProgressSize, { size: number; stroke: number }> = {
  sm: { size: 32, stroke: 3 },
  md: { size: 48, stroke: 4 },
  lg: { size: 64, stroke: 5 },
}

/**
 * حلقهٔ نامشخص یک کمان ثابت (ربع دایره) است که کل SVG با animate-spin
 * می‌چرخد — بدون keyframe سفارشی، فقط از انیمیشن توکاری Tailwind.
 */
function ProgressCircle({
  className,
  value,
  min = 0,
  max = 100,
  indeterminate = false,
  size = "md",
  color = "primary",
  formatOptions,
  strokeWidth,
  ...props
}: Omit<React.ComponentProps<"div">, "color"> &
  ProgressBaseProps & { strokeWidth?: number }) {
  const clamped = value === undefined ? undefined : clamp(value, min, max)
  const percent =
    clamped === undefined ? 0 : ((clamped - min) / (max - min)) * 100

  const dims = CIRCLE_DIMENSIONS[size]
  const stroke = strokeWidth ?? dims.stroke
  const radius = (dims.size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const arcPercent = indeterminate ? 25 : percent
  const offset = circumference - (arcPercent / 100) * circumference

  return (
    <div
      data-slot="progress-circle"
      data-indeterminate={indeterminate ? "" : undefined}
      role="progressbar"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuetext={
        indeterminate ? undefined : valueText(clamped, min, max, formatOptions)
      }
      className={cn(
        progressColorVariants({ color }),
        "relative inline-flex shrink-0 items-center justify-center",
        indeterminate && "animate-spin",
        className
      )}
      style={{ width: dims.size, height: dims.size }}
      {...props}
    >
      <svg
        width={dims.size}
        height={dims.size}
        viewBox={`0 0 ${dims.size} ${dims.size}`}
        className="-rotate-90"
      >
        <circle
          data-slot="progress-circle-track"
          cx={dims.size / 2}
          cy={dims.size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          data-slot="progress-circle-fill"
          cx={dims.size / 2}
          cy={dims.size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-(color:--progress) transition-[stroke-dashoffset]"
        />
      </svg>
    </div>
  )
}

export { Progress, ProgressCircle, progressColorVariants }
