"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { PauseIcon, PlayIcon } from "@/components/icons"
import { toFaDigits } from "@/lib/persian"
import { cn } from "@/lib/utils"

/**
 * پخش‌کنندهٔ صوت برای پیامِ صوتی، فایلِ بارگذاری‌شده یا ضبط.
 *
 * سه حالتِ دیده‌شدنی دارد: آمادهٔ پخش، در حالِ پخش (دکمهٔ مکث و زمانِ جاری)
 * و مکث‌شده (دکمهٔ پخش و همان نقطهٔ توقف). زمان با ارقامِ فارسی است
 * («۰:۱۲ / ۱:۰۴»)؛ نوارِ زمان مثلِ پخش‌کننده‌های واقعی نرم جلو می‌رود
 * (requestAnimationFrame، نه timeupdateِ چهارتایی در ثانیه)، با کشیدن و کلیک
 * جابه‌جا می‌شود و با جهت‌نماها ۵ ثانیه جلو و عقب می‌رود. فقط یک پخش‌کننده در صفحه هم‌زمان پخش می‌کند: شروعِ یکی بقیه را
 * مکث می‌کند، مثلِ پیام‌رسان‌ها.
 */

/** «۱:۰۴» یا «۱:۰۲:۳۰» با ارقامِ فارسی. */
export function formatDuration(totalSeconds: number) {
  const seconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return toFaDigits(h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`)
}

/**
 * خوانندهٔ سطحِ صدا برای اکولایزر، مشترکِ ضبط (میکروفون) و پخش (خروجی).
 *
 * طیفِ گفتار (۹۰ تا ۵۰۰۰ هرتز) به بازه‌های لگاریتمی تقسیم می‌شود، چون گوش و صدای آدم
 * لگاریتمی است؛ تقسیمِ خطی همهٔ انرژی را در چند میلهٔ اول می‌ریخت و بقیه ساکن می‌ماندند.
 * هر بازه سقفِ خودش را دنبال می‌کند (آرام پایین می‌آید)، پس بازه‌های زیرِ کم‌انرژی هم با
 * تُن بالا و پایین می‌روند؛ دروازهٔ نویز سکوت را صاف نگه می‌دارد. خروجی بین ۰ و ۱ است.
 */
export function createAudioLevelReader(analyser: AnalyserNode, bands: number) {
  // بازهٔ پیش‌فرض (‎-100 تا ‎-30 دسی‌بل) نویزِ اتاق را هم بالا نشان می‌دهد؛ کف را بالاتر می‌بریم.
  analyser.minDecibels = -85
  analyser.maxDecibels = -20
  const data = new Uint8Array(analyser.frequencyBinCount)
  const binHz = analyser.context.sampleRate / analyser.fftSize
  const low = 90
  const high = 5000
  const edges = Array.from({ length: bands + 1 }, (_, index) => low * Math.pow(high / low, index / bands))
  const ceilings = new Array<number>(bands).fill(0.35)
  let previous = new Array<number>(bands).fill(0)
  return () => {
    analyser.getByteFrequencyData(data)
    const next = edges.slice(0, -1).map((edge, band) => {
      const from = Math.min(data.length - 1, Math.floor(edge / binHz))
      const to = Math.min(data.length, Math.max(from + 1, Math.ceil(edges[band + 1] / binHz)))
      let peak = 0
      for (let i = from; i < to; i++) peak = Math.max(peak, data[i])
      const value = peak / 255
      ceilings[band] = Math.max(value, ceilings[band] * 0.996, 0.35)
      const level = Math.min(1, Math.max(0, (value - 0.15) / (ceilings[band] - 0.15)))
      // بالا رفتن سریع، پایین آمدنِ نرم؛ میله‌ها با هجا می‌پرند ولی نمی‌لرزند.
      return level > previous[band] ? previous[band] * 0.3 + level * 0.7 : previous[band] * 0.75 + level * 0.25
    })
    previous = next
    return next
  }
}

/** بازه‌ها آینه‌ای چیده می‌شوند: بم در وسط، زیر در دو لبه؛ شکلِ آشنای موجِ صدا. */
export function mirrorLevels(levels: number[]) {
  return [...[...levels].reverse(), ...levels]
}

/** آرایهٔ دلخواه را به n نمونه می‌رساند (بیشینهٔ هر تکه)، برای شکلِ ثابتِ موجِ ضبط. */
export function resampleLevels(levels: number[], count: number) {
  if (levels.length === 0) return new Array<number>(count).fill(0)
  return Array.from({ length: count }, (_, index) => {
    const from = Math.floor((index / count) * levels.length)
    const to = Math.max(from + 1, Math.floor(((index + 1) / count) * levels.length))
    return Math.max(...levels.slice(from, to))
  })
}

/**
 * میله‌های اکولایزر. ارتفاعِ هر میله از level (۰ تا ۱) بینِ ۱۴٪ و ۱۰۰٪ نوار است. با progress،
 * میله‌های پخش‌شده رنگِ playedClassName و بقیه رنگِ ملایم می‌گیرند. فقط تزئینی است.
 */
export function AudioBars({
  levels,
  progress,
  className,
  barClassName = "bg-primary",
  restClassName = "bg-placeholder",
}: {
  levels: number[]
  progress?: number
  className?: string
  barClassName?: string
  restClassName?: string
}) {
  return (
    <span data-slot="audio-bars" dir="ltr" aria-hidden className={cn("flex min-w-0 items-center justify-between gap-px overflow-hidden", className)}>
      {levels.map((level, index) => (
        <span
          key={index}
          className={cn(
            "w-[2px] shrink-0 rounded-full transition-[height] duration-75 motion-reduce:transition-none",
            progress === undefined || (index + 0.5) / levels.length <= progress ? barClassName : restClassName
          )}
          style={{ height: `${14 + Math.min(1, Math.max(0, level)) * 86}%` }}
        />
      ))}
    </span>
  )
}

/** رویدادی که هر پخش‌کنندهٔ دیگ هنگامِ شروع می‌فرستد تا بقیه مکث کنند. */
export const PLAYING_EVENT = "dig-audio-play"

const audioPlayerVariants = cva("flex items-center gap-3", {
  variants: {
    variant: {
      default: "rounded-xl border border-border bg-card p-3 shadow-card",
      ghost: "",
    },
    size: {
      sm: "gap-2 [&_[data-slot=audio-player-toggle]]:size-8",
      default: "[&_[data-slot=audio-player-toggle]]:size-10",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
})

export type AudioPlayerState = "idle" | "playing" | "paused" | "ended"

type AudioPlayerProps = Omit<React.ComponentProps<"div">, "onPlay" | "onPause"> &
  VariantProps<typeof audioPlayerVariants> & {
    src: string
    /** عنوانِ صوت (مثلاً نامِ فایل یا «پیام صوتی»)؛ برچسبِ دکمه‌ها هم از آن ساخته می‌شود. */
    title?: string
    /** مدت به ثانیه، وقتی از قبل معلوم است (تا قبل از بارگذاری هم نمایش داده شود). */
    duration?: number
    onStateChange?: (state: AudioPlayerState) => void
    /**
     * نوارِ زمان به‌شکلِ میله‌های صدا: حینِ پخش، میله‌ها با تُنِ صدای خروجی بزرگ و کوچک می‌شوند
     * و وقتی پخش نمی‌شود شکلِ peaks (یا میله‌های کوتاه) را نشان می‌دهند. src باید هم‌مبدأ، blob یا
     * با CORS باشد؛ وگرنه مرورگر صدای خروجیِ تحلیل‌شده را بی‌صدا می‌کند.
     */
    visualizer?: boolean
    /** شکلِ ثابتِ موج (۰ تا ۱)، مثلاً از VoiceRecorder؛ وقتی پخش نمی‌شود دیده می‌شود. */
    peaks?: number[]
  }

/** تعدادِ میله‌های نوارِ زمان در حالتِ visualizer. */
const PLAYER_BARS = 32

function AudioPlayer({
  className,
  variant,
  size,
  src,
  title,
  duration: durationProp,
  onStateChange,
  visualizer = false,
  peaks,
  ...props
}: AudioPlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [state, setState] = React.useState<AudioPlayerState>("idle")
  const [current, setCurrent] = React.useState(0)
  const [duration, setDuration] = React.useState(durationProp ?? 0)
  const [failed, setFailed] = React.useState(false)
  const label = title ?? "صوت"

  const update = React.useCallback(
    (next: AudioPlayerState) => {
      setState(next)
      onStateChange?.(next)
    },
    [onStateChange]
  )

  // متادیتا ممکن است پیش از hydrate شدنِ React بارگذاری شده باشد و رویدادش از
  // دست رفته باشد؛ مدت را همان لحظهٔ mount هم از خودِ audio می‌خوانیم.
  React.useEffect(() => {
    const value = audioRef.current?.duration
    if (value && Number.isFinite(value)) setDuration(value)
  }, [])

  // گرافِ صوتی فقط با visualizer و فقط با اولین پخش ساخته می‌شود (مرورگر AudioContext را
  // بدونِ اشارهٔ کاربر راه نمی‌اندازد، و هر audio فقط یک بار به گراف وصل می‌شود).
  const graphRef = React.useRef<{ context: AudioContext; read: () => number[] } | null>(null)
  const [live, setLive] = React.useState<number[] | null>(null)
  React.useEffect(() => () => void graphRef.current?.context.close(), [])
  const connectGraph = async () => {
    const audio = audioRef.current
    if (!visualizer || !audio) return
    if (!graphRef.current) {
      const AudioContextClass =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      try {
        const context = new AudioContextClass()
        const analyser = context.createAnalyser()
        analyser.fftSize = 1024
        analyser.smoothingTimeConstant = 0.5
        context.createMediaElementSource(audio).connect(analyser)
        analyser.connect(context.destination)
        graphRef.current = { context, read: createAudioLevelReader(analyser, PLAYER_BARS / 2) }
      } catch {
        return
      }
    }
    if (graphRef.current.context.state === "suspended") await graphRef.current.context.resume().catch(() => {})
  }

  // حینِ پخش، زمان هر فریم خوانده می‌شود تا دستگیره نرم حرکت کند و نپرد.
  const draggingRef = React.useRef(false)
  React.useEffect(() => {
    if (state !== "playing") return
    let frame = 0
    const tick = () => {
      const audio = audioRef.current
      if (audio && !draggingRef.current) setCurrent(audio.currentTime)
      if (graphRef.current) setLive(mirrorLevels(graphRef.current.read()))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state])

  // شروعِ هر پخش‌کننده بقیه را مکث می‌کند.
  React.useEffect(() => {
    const onOtherPlay = (event: Event) => {
      if (event.target !== audioRef.current) audioRef.current?.pause()
    }
    document.addEventListener(PLAYING_EVENT, onOtherPlay)
    return () => document.removeEventListener(PLAYING_EVENT, onOtherPlay)
  }, [])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.dispatchEvent(new Event(PLAYING_EVENT, { bubbles: true }))
      await connectGraph()
      try {
        await audio.play()
      } catch {
        setFailed(true)
      }
    } else {
      audio.pause()
    }
  }

  const playing = state === "playing"

  return (
    <div
      data-slot="audio-player"
      data-state={state}
      role="group"
      aria-label={label}
      className={cn(audioPlayerVariants({ variant, size }), className)}
      {...props}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => update("playing")}
        onPause={() => update(audioRef.current?.ended ? "ended" : "paused")}
        onEnded={() => update("ended")}
        onTimeUpdate={(event) => {
          if (!draggingRef.current) setCurrent(event.currentTarget.currentTime)
        }}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value)) setDuration(value)
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value) && value > 0) setDuration(value)
        }}
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        data-slot="audio-player-toggle"
        aria-label={playing ? `مکث ${label}` : `پخش ${label}`}
        aria-pressed={playing}
        disabled={failed}
        onClick={toggle}
        className="flex shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground outline-none transition-[filter] hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-placeholder dark:hover:brightness-125 [&>svg]:size-4"
      >
        {/* آیکونِ پخش کمی به جلو می‌رود تا مثلث به‌چشم وسط باشد. */}
        {playing ? <PauseIcon /> : <PlayIcon className="translate-x-px" />}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {title && variant !== "ghost" && (
          <span className="truncate text-sm font-medium" dir="auto">
            {title}
          </span>
        )}
        {failed ? (
          <span className="text-xs text-destructive">پخش این صوت ممکن نیست.</span>
        ) : (
          <div className="flex items-center gap-3">
            {/* نوارِ زمان همیشه چپ‌به‌راست است، مثلِ خودِ زمان در پخش‌کننده‌ها؛ بخشِ پرشده
                مقدارِ پخش‌شده است و دستگیره را می‌شود برای جلو و عقب بردن کشید. */}
            <SeekBar
              bars={visualizer ? ((state === "playing" ? live : null) ?? (peaks ? resampleLevels(peaks, PLAYER_BARS) : new Array<number>(PLAYER_BARS).fill(0))) : undefined}
              label={label}
              current={current}
              duration={duration}
              draggingRef={draggingRef}
              onPreview={setCurrent}
              onSeek={(seconds) => {
                if (audioRef.current) audioRef.current.currentTime = seconds
                setCurrent(seconds)
              }}
            />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground" dir="ltr">
              {state === "idle" && current === 0
                ? formatDuration(duration)
                : `${formatDuration(current)} / ${formatDuration(duration)}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}


/**
 * نوارِ زمان: همیشه چپ‌به‌راست (زمان در همهٔ پخش‌کننده‌ها از چپ به راست جلو
 * می‌رود). بخشِ پرشده دقیقاً تا مرکزِ دستگیره است؛ حینِ کشیدن فقط پیش‌نمایش
 * می‌دهد و با رها کردن جابه‌جا می‌کند تا صدا تکه‌تکه نشود. عمداً روی Slider
 * سوار نیست: کلاس‌های rtl:ِ آن داخلِ صفحهٔ راست‌به‌چپ حتی با dir="ltr" هم
 * فعال می‌مانند و دستگیره از پرشدگی جدا می‌افتاد.
 */
function SeekBar({
  bars,
  label,
  current,
  duration,
  draggingRef,
  onPreview,
  onSeek,
}: {
  /** اگر باشد، به‌جای خطِ نازک میله‌های صدا کشیده می‌شوند و پیشرفت با رنگِ میله‌هاست. */
  bars?: number[]
  label: string
  current: number
  duration: number
  draggingRef: React.MutableRefObject<boolean>
  onPreview: (seconds: number) => void
  onSeek: (seconds: number) => void
}) {
  const trackRef = React.useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const ready = duration > 0
  const percent = ready ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0

  const secondsAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={ready ? 0 : -1}
      aria-label={`زمان پخش ${label}`}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(current)}
      aria-valuetext={`${formatDuration(current)} از ${formatDuration(duration)}`}
      aria-disabled={!ready || undefined}
      data-slot="audio-player-seek"
      data-dragging={dragging || undefined}
      dir="ltr"
      onPointerDown={(event) => {
        if (!ready) return
        event.currentTarget.setPointerCapture(event.pointerId)
        draggingRef.current = true
        setDragging(true)
        onPreview(secondsAt(event.clientX))
      }}
      onPointerMove={(event) => {
        if (draggingRef.current) onPreview(secondsAt(event.clientX))
      }}
      onPointerUp={(event) => {
        if (!draggingRef.current) return
        draggingRef.current = false
        setDragging(false)
        onSeek(secondsAt(event.clientX))
      }}
      onPointerCancel={() => {
        draggingRef.current = false
        setDragging(false)
      }}
      onKeyDown={(event) => {
        if (!ready) return
        const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 5 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -5 : 0
        if (step) onSeek(Math.min(duration, Math.max(0, current + step)))
        else if (event.key === "Home") onSeek(0)
        else if (event.key === "End") onSeek(duration)
        else return
        event.preventDefault()
      }}
      className={cn(
        "group/seek relative flex min-w-0 flex-1 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:cursor-default",
        bars ? "h-7" : "h-5"
      )}
    >
      {bars ? (
        <AudioBars levels={bars} progress={percent / 100} className="size-full" />
      ) : (
        <span className="absolute inset-x-0 h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${percent}%` }} />
        </span>
      )}
      {ready && !bars && (
        <span
          aria-hidden
          className="absolute size-3.5 -translate-x-1/2 rounded-full border-2 border-primary bg-background shadow-control transition-transform group-hover/seek:scale-110 group-data-[dragging]/seek:scale-125"
          style={{ left: `${percent}%` }}
        />
      )}
    </div>
  )
}

export { AudioPlayer, audioPlayerVariants, type AudioPlayerProps }
