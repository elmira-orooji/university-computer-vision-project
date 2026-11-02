"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { useControllableState } from "@/lib/primitives/use-controllable-state"
import {
  pressInteraction,
  type TabsInteraction,
} from "@/lib/primitives/interaction"

type TabsContextValue = {
  value: string | undefined
  setValue: (value: string) => void
  baseId: string
  interaction: TabsInteraction
  variant: TabsVariant
}

/** pill: قرص روی ریلِ خاکستری (پیش‌فرض). line: خطِ زیرِ برگهٔ فعال، برای ناوبریِ بالای کارت و برگه‌های آیکون‌دار. */
type TabsVariant = "pill" | "line"

const TabsContext = React.createContext<TabsContextValue | null>(null)

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  interaction = "none",
  variant = "pill",
  ...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** واکنش برگه‌ها به فشردن و جابه‌جایی برگهٔ فعال؛ فهرست کامل در صفحهٔ «اینتراکشن‌ها». */
  interaction?: TabsInteraction
  /**
   * ظاهرِ برگه‌ها. line برگه‌ها را با خطی زیرِ برگهٔ فعال نشان می‌دهد؛ اگر برگه آیکون داشته باشد،
   * آیکون بالای برچسب می‌نشیند (مثلِ پرواز، قطار، هتل در جست‌وجوی سفر).
   */
  variant?: TabsVariant
}) {
  const [current, setCurrent] = useControllableState<string | undefined>({
    value,
    defaultValue,
    onChange: onValueChange as (value: string | undefined) => void,
  })
  const baseId = React.useId()

  const context = React.useMemo<TabsContextValue>(
    () => ({ value: current, setValue: (v) => setCurrent(v), baseId, interaction, variant }),
    [current, setCurrent, baseId, interaction, variant]
  )

  return (
    <TabsContext.Provider value={context}>
      <div
        data-slot="tabs"
        data-interaction={interaction}
        data-variant={variant}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </TabsContext.Provider>
  )
}

type IndicatorRect = { left: number; right: number }

/**
 * قرص برگهٔ فعال در حالت slide و stretch. جای قرص با left و right فیزیکی
 * (فاصله از دو لبهٔ فهرست) اندازه گرفته می‌شود، پس در راست‌به‌چپ هم بدون
 * حساب جدا درست می‌نشیند.
 *
 * در stretch دو لبه دو زمان‌بندی جدا دارند: لبه‌ای که در جهت حرکت جلوست
 * زود راه می‌افتد و لبهٔ عقب با تأخیر دنبالش می‌آید.
 */
function useTabsIndicator(
  listRef: React.RefObject<HTMLDivElement | null>,
  value: string | undefined,
  enabled: boolean
) {
  const [state, setState] = React.useState<{
    rect: IndicatorRect | null
    direction: "left" | "right"
    animate: boolean
  }>({ rect: null, direction: "right", animate: false })
  const previous = React.useRef<IndicatorRect | null>(null)

  const measure = React.useCallback(
    (withMotion: boolean) => {
      const list = listRef.current
      if (!list) return
      const active = list.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]'
      )
      if (!active) {
        previous.current = null
        setState((s) => ({ ...s, rect: null, animate: false }))
        return
      }
      // offset به‌جای getBoundingClientRect: نه scale فشردن رویش اثر دارد
      // نه اسکرول افقی فهرست (قرص هم با محتوا اسکرول می‌شود).
      const next = {
        left: active.offsetLeft,
        right: list.clientWidth - active.offsetLeft - active.offsetWidth,
      }
      const prev = previous.current
      previous.current = next
      setState((s) => ({
        rect: next,
        direction: prev ? (next.left > prev.left ? "right" : "left") : s.direction,
        animate: withMotion && prev !== null,
      }))
    },
    [listRef]
  )

  // عوض شدن برگهٔ فعال: با حرکت.
  React.useLayoutEffect(() => {
    if (enabled) measure(true)
  }, [value, enabled, measure])

  // تغییر اندازهٔ فهرست: بی‌حرکت. ResizeObserver همان لحظهٔ observe یک بار
  // صدا زده می‌شود؛ اگر آن بار را نادیده نگیریم، درست بعد از کلیک انیمیشن
  // را خاموش می‌کند و قرص به‌جای لغزیدن می‌پرد.
  React.useEffect(() => {
    const list = listRef.current
    if (!enabled || !list) return
    let initial = true
    const observer = new ResizeObserver(() => {
      if (initial) {
        initial = false
        return
      }
      measure(false)
    })
    observer.observe(list)
    return () => observer.disconnect()
  }, [listRef, enabled, measure])

  return state
}

function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const context = React.useContext(TabsContext)
  const interaction = context?.interaction ?? "none"
  const line = context?.variant === "line"
  const hasIndicator = interaction === "slide" || interaction === "stretch"
  const listRef = React.useRef<HTMLDivElement>(null)
  const { rect, direction, animate } = useTabsIndicator(
    listRef,
    context?.value,
    hasIndicator
  )

  let transition = "none"
  if (animate) {
    const ease = "cubic-bezier(0.32,0.72,0,1)"
    if (interaction === "slide") {
      transition = `left 320ms ${ease}, right 320ms ${ease}`
    } else {
      // لبهٔ جلو در جهت حرکت: حرکت به راست یعنی لبهٔ right جلوست.
      const lead = direction === "right" ? "right" : "left"
      const trail = direction === "right" ? "left" : "right"
      transition = `${lead} 180ms ${ease}, ${trail} 420ms ${ease} 140ms`
    }
  }

  return (
    <div
      ref={listRef}
      data-slot="tabs-list"
      role="tablist"
      data-indicator={hasIndicator ? "true" : undefined}
      className={cn(
        // gap لازم است وگرنه لبهٔ برگهٔ فعال مستقیم روی لبهٔ برگهٔ کناری
        // می‌افتد و مرز دو سلول گم می‌شود — همان چیزی که ToggleGroup با
        // prop «separated» حل کرده است.
        // ارتفاع از ControlSizeProvider (پیش‌فرض همان ۳۶)، تا کنارِ فیلد و دکمه هم‌قد بماند.
        line
          ? // خطِ پایه زیرِ همهٔ برگه‌ها؛ برگهٔ فعال خطِ رنگیِ خودش را روی آن می‌کشد.
            "relative flex w-full items-stretch overflow-x-auto border-b border-border text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "relative inline-flex h-[var(--control-h,calc(var(--spacing)*9))] w-fit items-center justify-center gap-1 rounded-full bg-muted p-[3px] text-muted-foreground",
        className
      )}
      {...props}
    >
      {/* در دارک bg-background از ریل (muted) تیره‌تر است و قرص فرورفته دیده
          می‌شود؛ پس قرص یک پلهٔ روشن‌تر از ریل می‌گیرد. */}
      {hasIndicator && rect && (
        <span
          aria-hidden
          data-slot="tabs-indicator"
          className={cn(
            "pointer-events-none absolute motion-reduce:transition-none!",
            line
              ? "bottom-0 h-[3px] rounded-t-full bg-primary"
              : "inset-y-[3px] rounded-full bg-background shadow-card dark:bg-[color-mix(in_oklab,var(--color-foreground)_14%,var(--color-muted))]"
          )}
          style={{ left: rect.left, right: rect.right, transition }}
        />
      )}
      {children}
    </div>
  )
}

/** برگه‌های فعال داخل نزدیک‌ترین tablist، به ترتیب DOM. */
function getEnabledTabs(from: HTMLElement): HTMLButtonElement[] {
  const list = from.closest('[role="tablist"]')
  if (!list) return []
  return Array.from(
    list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')
  )
}

const PERSIAN_TEXT = /[\u0600-\u06FF]/

/**
 * فونتِ فارسی زیرِ خطِ پایه جا برای دنبالهٔ حروفِ فارسی نگه می‌دارد؛ برچسبِ
 * تمام‌لاتین (Claude Code، Export) بی‌آن دنباله حدود ۰.۱۳em بالاتر از وسط دیده
 * می‌شود. فقط وقتی هیچ متنِ فارسی‌ای در برچسب نیست، متنِ لاتین کمی پایین می‌آید.
 */
function centerLatin(children: React.ReactNode): React.ReactNode {
  const parts = React.Children.toArray(children)
  if (parts.some((part) => typeof part === "string" && PERSIAN_TEXT.test(part))) return children
  if (!parts.some((part) => typeof part === "string" && part.trim())) return children
  return parts.map((part, index) =>
    typeof part === "string" && part.trim() ? (
      <span key={index} className="inline-block translate-y-[0.12em]">
        {part}
      </span>
    ) : (
      part
    )
  )
}

function TabsTrigger({
  className,
  value,
  disabled,
  onClick,
  onKeyDown,
  children,
  ...props
}: React.ComponentProps<"button"> & { value: string }) {
  const context = React.useContext(TabsContext)
  const active = context?.value === value
  const interaction = context?.interaction ?? "none"
  const line = context?.variant === "line"
  const hasIndicator = interaction === "slide" || interaction === "stretch"

  return (
    <button
      type="button"
      role="tab"
      id={`${context?.baseId}-trigger-${value}`}
      aria-controls={`${context?.baseId}-content-${value}`}
      aria-selected={active}
      data-slot="tabs-trigger"
      data-state={active ? "active" : "inactive"}
      data-interaction={disabled ? undefined : interaction}
      disabled={disabled}
      tabIndex={disabled ? -1 : active ? 0 : -1}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || disabled) return
        context?.setValue(value)
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (event.defaultPrevented || disabled) return
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return
        event.preventDefault()

        const items = getEnabledTabs(event.currentTarget)
        const index = items.indexOf(event.currentTarget)
        if (index === -1 || items.length === 0) return

        const isRtl = event.currentTarget.closest('[dir="rtl"]') !== null
        let nextIndex = index
        if (event.key === "Home") nextIndex = 0
        else if (event.key === "End") nextIndex = items.length - 1
        else {
          const forward = isRtl
            ? event.key === "ArrowLeft"
            : event.key === "ArrowRight"
          nextIndex = (index + (forward ? 1 : -1) + items.length) % items.length
        }

        const next = items[nextIndex]
        next.focus()
        // فعال‌سازی خودکار: تغییر فوکوس با فلش بلافاصله همان برگه را باز می‌کند.
        next.click()
      }}
      className={cn(
        line
          ? // آیکون‌دار: آیکون بالای برچسب. خطِ برگهٔ فعال after است تا بی‌قرصِ لغزنده هم دیده شود.
            "relative inline-flex min-w-max flex-1 cursor-pointer items-center justify-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 motion-reduce:transition-none hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground has-[>svg]:flex-col has-[>svg]:gap-1.5 has-[>svg]:pt-4 disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-placeholder data-[state=active]:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6"
          : "inline-flex h-full flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-transparent px-[var(--control-field-px,calc(var(--spacing)*2))] py-1 text-[length:var(--control-text,var(--text-sm))] font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow,scale] duration-150 motion-reduce:transition-none hover:text-foreground focus-visible:border-foreground focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-foreground focus-visible:ring-0 focus-visible:shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-foreground)_12%,var(--color-background))] disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-placeholder data-[state=active]:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        pressInteraction,
        // با قرص لغزنده، پس‌زمینهٔ برگهٔ فعال را خود قرص می‌کشد و برگه روی
        // آن (z-10) می‌نشیند؛ بدون قرص، برگهٔ فعال خودش پس‌زمینه دارد.
        hasIndicator
          ? "relative z-10"
          : line
            ? "data-[state=active]:after:absolute data-[state=active]:after:inset-x-3 data-[state=active]:after:bottom-0 data-[state=active]:after:h-[3px] data-[state=active]:after:rounded-t-full data-[state=active]:after:bg-primary"
            : "data-[state=active]:bg-background data-[state=active]:shadow-card dark:data-[state=active]:bg-[color-mix(in_oklab,var(--color-foreground)_14%,var(--color-muted))]",
        className
      )}
      {...props}
    >
      {centerLatin(children)}
    </button>
  )
}

function TabsContent({
  className,
  value,
  /**
   * محتوا حتی وقتی برگه فعال نیست هم در DOM بماند و فقط با ویژگیِ hidden
   * پنهان شود.
   *
   * سه جا لازم می‌شود: فرمی که باید مقدارش را نگه دارد یا با submit ارسال
   * شود، محتوایی که باید با Ctrl+F پیدا شود، و صفحه‌ای که خزندهٔ موتور
   * جستجو یا یک ایجنت باید کاملش را بخواند. بدون این، هرچه پشت برگهٔ
   * غیرفعال است برای آن‌ها وجود ندارد.
   */
  forceMount = false,
  ...props
}: React.ComponentProps<"div"> & { value: string; forceMount?: boolean }) {
  const context = React.useContext(TabsContext)
  const active = context?.value === value

  if (!active && !forceMount) return null

  return (
    <div
      data-slot="tabs-content"
      role="tabpanel"
      data-state={active ? "active" : "inactive"}
      hidden={!active}
      id={`${context?.baseId}-content-${value}`}
      aria-labelledby={`${context?.baseId}-trigger-${value}`}
      tabIndex={active ? 0 : -1}
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
