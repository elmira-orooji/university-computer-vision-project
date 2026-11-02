"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Slot } from "@/lib/primitives/slot"
import { Portal } from "@/lib/primitives/portal"
import { useControllableState } from "@/lib/primitives/use-controllable-state"
import { usePresence } from "@/lib/primitives/use-presence"
import { useFloatingPosition } from "@/lib/primitives/use-floating-position"
import {
  transformOriginFor,
  type Align,
  type Side,
} from "@/lib/primitives/positioning"

const TooltipProviderContext = React.createContext<{ delayDuration: number }>(
  { delayDuration: 0 }
)

function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number
  children?: React.ReactNode
}) {
  const value = React.useMemo(() => ({ delayDuration }), [delayDuration])
  return (
    <TooltipProviderContext.Provider value={value}>
      {children}
    </TooltipProviderContext.Provider>
  )
}

type TooltipContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  setTrigger: (node: HTMLElement | null) => void
  delayDuration: number
}

const TooltipContext = React.createContext<TooltipContextValue | null>(null)

function TooltipRoot({
  open,
  defaultOpen = false,
  onOpenChange,
  delayDuration,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  delayDuration?: number
  children?: React.ReactNode
}) {
  const providerContext = React.useContext(TooltipProviderContext)
  const [isOpen, setIsOpen] = useControllableState<boolean>({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  })
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const setTrigger = React.useCallback((node: HTMLElement | null) => {
    triggerRef.current = node
  }, [])

  const context = React.useMemo<TooltipContextValue>(
    () => ({
      open: isOpen,
      setOpen: setIsOpen,
      triggerRef,
      setTrigger,
      delayDuration: delayDuration ?? providerContext.delayDuration,
    }),
    [isOpen, setIsOpen, setTrigger, delayDuration, providerContext.delayDuration]
  )

  return (
    <TooltipContext.Provider value={context}>
      {children}
    </TooltipContext.Provider>
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipRoot>) {
  return (
    <TooltipProvider>
      <TooltipRoot data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  asChild = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const context = React.useContext(TooltipContext)
  const timerRef = React.useRef<number | undefined>(undefined)
  const Comp = asChild ? Slot : "button"

  const setRef = React.useCallback(
    (node: HTMLElement | null) => {
      context?.setTrigger(node)
    },
    [context]
  )

  return (
    <Comp
      ref={setRef as never}
      type="button"
      data-slot="tooltip-trigger"
      onMouseEnter={(event: React.MouseEvent<HTMLButtonElement>) => {
        onMouseEnter?.(event)
        window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(
          () => context?.setOpen(true),
          context?.delayDuration ?? 0
        )
      }}
      onMouseLeave={(event: React.MouseEvent<HTMLButtonElement>) => {
        onMouseLeave?.(event)
        window.clearTimeout(timerRef.current)
        context?.setOpen(false)
      }}
      onFocus={(event: React.FocusEvent<HTMLButtonElement>) => {
        onFocus?.(event)
        context?.setOpen(true)
      }}
      onBlur={(event: React.FocusEvent<HTMLButtonElement>) => {
        onBlur?.(event)
        context?.setOpen(false)
      }}
      onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event)
        context?.setOpen(false)
      }}
      {...props}
    />
  )
}

function TooltipContent({
  className,
  side = "top",
  align = "center",
  sideOffset = 12,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: Side
  align?: Align
  sideOffset?: number
}) {
  const context = React.useContext(TooltipContext)
  const { shouldRender, ref: presenceRef } = usePresence(
    Boolean(context?.open)
  )
  const contentRef = React.useRef<HTMLDivElement>(null)

  const position = useFloatingPosition(
    context?.triggerRef ?? contentRef,
    contentRef,
    Boolean(context?.open),
    { side, align, sideOffset }
  )

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node
      presenceRef(node)
    },
    [presenceRef]
  )

  if (!shouldRender) return null

  const finalSide = position?.side ?? side
  const finalAlign = position?.align ?? align

  return (
    <Portal>
      <div
        ref={setRefs}
        role="tooltip"
        data-slot="tooltip-content"
        data-state={context?.open ? "open" : "closed"}
        data-side={finalSide}
        style={
          {
            position: "fixed",
            top: position ? position.y : 0,
            left: position ? position.x : 0,
            visibility: position ? "visible" : "hidden",
            "--tooltip-content-transform-origin": transformOriginFor(
              finalSide,
              finalAlign
            ),
          } as React.CSSProperties
        }
        className={cn(
          "z-(--z-overlay) w-fit origin-(--tooltip-content-transform-origin) rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        {...props}
      >
        {children}
        <div
          className="absolute z-(--z-overlay) size-[11px] bg-primary"
          style={arrowStyle(finalSide)}
        />
      </div>
    </Portal>
  )
}

/**
 * پیکان یک مربعِ ۱۱ پیکسلیِ ۴۵ درجه چرخیده است که نیمهٔ پشتیش زیرِ کادر
 * تولتیپ پنهان می‌شود. برای اینکه نوکش کامل بیرون بزند، مرکزِ مربع باید
 * دقیقاً روی لبهٔ کادر بنشیند، یعنی نصفِ اندازه‌اش (۵٫۵ پیکسل) بیرون باشد.
 *
 * فقط همان گوشه‌ای که بیرون می‌زند رِیدیوس می‌گیرد. اگر با `rounded-*` هر
 * چهار گوشه را گرد کنی، دو گوشهٔ کناری که روی لبهٔ کادر می‌نشینند هم گرد
 * می‌شوند، محلِ چسبیدنِ مثلث به کادر تورفتگی پیدا می‌کند و پیکان تپل و
 * بی‌ریخت دیده می‌شود.
 *
 * چرخش فقط داخل همین `transform` انجام می‌شود؛ کلاسِ `rotate-45` را به
 * پیکان اضافه نکن. در Tailwind v4 آن کلاس روی پراپرتیِ مستقلِ `rotate`
 * می‌نشیند و با این `transform` جمع می‌شود؛ حاصلش ۹۰ درجه است، مربع دوباره
 * صاف می‌ایستد و پیکان کاملاً داخل کادر گم می‌شود.
 *
 * مربعِ چرخیده به‌اندازهٔ نصفِ قطرش بیرون می‌زند نه نصفِ ضلعش:
 * ۱۱ ÷ √۲ ≈ ۷٫۸ پیکسل. پس `sideOffset` باید از این عدد بیشتر باشد وگرنه نوکِ
 * مثلث روی خودِ آیتم می‌افتد؛ با ۱۲ پیکسل حدود ۴ پیکسل فاصلهٔ واقعی می‌ماند.
 */
const ARROW_OFFSET = -5.5
const ARROW_RADIUS = 3

function arrowStyle(side: Side): React.CSSProperties {
  switch (side) {
    case "top":
      return {
        bottom: ARROW_OFFSET,
        left: "50%",
        transform: "translateX(-50%) rotate(45deg)",
        borderBottomRightRadius: ARROW_RADIUS,
      }
    case "bottom":
      return {
        top: ARROW_OFFSET,
        left: "50%",
        transform: "translateX(-50%) rotate(45deg)",
        borderTopLeftRadius: ARROW_RADIUS,
      }
    case "left":
      return {
        right: ARROW_OFFSET,
        top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
        borderTopRightRadius: ARROW_RADIUS,
      }
    case "right":
      return {
        left: ARROW_OFFSET,
        top: "50%",
        transform: "translateY(-50%) rotate(45deg)",
        borderBottomLeftRadius: ARROW_RADIUS,
      }
  }
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
