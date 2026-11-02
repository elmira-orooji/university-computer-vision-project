import { cn } from "@/lib/utils"

type SkeletonAnimation = "pulse" | "shimmer" | "none"

/**
 * شعاع گوشه. برخلاف بیشتر کامپوننت‌ها که توکن سراسری --radius را دنبال
 * می‌کنند، اسکلت واقعاً به پیچِ هر نمونه نیاز دارد: جای‌نگهدارِ آواتار باید
 * دایره باشد و جای‌نگهدارِ یک خطِ متن کم‌شعاع — هر دو در همان صفحه.
 */
type SkeletonRadius = "none" | "sm" | "md" | "lg" | "full"

const RADIUS_CLASS: Record<SkeletonRadius, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
}

interface SkeletonProps extends React.ComponentProps<"div"> {
  /** نوع انیمیشن جای‌نگهدار. */
  animation?: SkeletonAnimation
  /** شعاع گوشه؛ برای جای‌نگهدارِ آواتار «full» بدهید. */
  radius?: SkeletonRadius
}

function Skeleton({
  className,
  animation = "pulse",
  radius = "md",
  ...props
}: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      data-animation={animation}
      className={cn(
        "relative overflow-hidden bg-accent",
        RADIUS_CLASS[radius],
        animation === "pulse" && "animate-pulse",
        className
      )}
      {...props}
    />
  )
}

/**
 * چند Skeleton را طوری گروه می‌کند که به‌جای شیمر جداگانه روی هر کدام،
 * یک باند نور واحد از روی کل گروه رد شود (globals.css با :has() تشخیص
 * می‌دهد و شیمر تک‌تک فرزندان را خاموش می‌کند).
 */
function SkeletonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-group"
      className={cn("relative overflow-hidden", className)}
      {...props}
    />
  )
}

export { Skeleton, SkeletonGroup }
export type { SkeletonAnimation }
