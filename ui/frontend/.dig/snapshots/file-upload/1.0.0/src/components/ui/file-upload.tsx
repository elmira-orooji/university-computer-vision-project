"use client"

import * as React from "react"

import { ArrowUpIcon, CheckIcon, FileTextIcon, PauseIcon, PlayIcon, RefreshIcon, TrashIcon, XIcon } from "@/components/icons"
import { formatDuration, PLAYING_EVENT } from "@/components/ui/audio-player"
import { Progress } from "@/components/ui/progress"
import { toFaDigits } from "@/lib/persian"
import { cn } from "@/lib/utils"

/**
 * بارگذاریِ فایل با کشیدن‌ورهاکردن و فهرستِ فایل‌های انتخاب‌شده.
 *
 * input بومیِ type="file" همیشه در DOM است (فقط از دید پنهان)، پس کلیک،
 * Tab، صفحه‌خوان و ارسالِ فرم همان رفتارِ مرورگر را دارند؛ ناحیهٔ رها‌کردن
 * یک label برای همان input است. فایل‌های ردشده (نوع یا حجمِ نامجاز، بیش از
 * سقفِ تعداد) با دلیلِ فارسی گزارش می‌شوند، نه بی‌صدا حذف.
 */

export type FileRejection = { file: File; reason: string }

/** وضعیتِ بارگذاریِ هر فایل وقتی onUpload داده شده. */
export type FileUploadStatus =
  | { state: "uploading"; progress: number }
  | { state: "done" }
  | { state: "error"; message: string }

export type FileUploadHandler = (
  file: File,
  helpers: {
    /** پیشرفت از ۰ تا ۱۰۰. */
    onProgress: (percent: number) => void
    /** با حذفِ فایل حینِ بارگذاری abort می‌شود. */
    signal: AbortSignal
  }
) => Promise<void>

type FileUploadProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  /** همان accept بومی: "image/*,.pdf" */
  accept?: string
  multiple?: boolean
  /** بیشینهٔ حجمِ هر فایل به بایت. */
  maxSize?: number
  /** بیشینهٔ تعدادِ فایل‌ها (فقط با multiple). */
  maxFiles?: number
  /** فایل‌های کنترل‌شده؛ بدونِ آن، فهرست داخلی نگه داشته می‌شود. */
  files?: File[]
  onFilesChange?: (files: File[]) => void
  onReject?: (rejections: FileRejection[]) => void
  name?: string
  id?: string
  disabled?: boolean
  invalid?: boolean
  required?: boolean
  /** متنِ اصلیِ ناحیهٔ رهاکردن. */
  title?: React.ReactNode
  /** خطِ راهنما زیرِ عنوان (نوع و حجمِ مجاز). */
  hint?: React.ReactNode
  /** برچسبِ دکمهٔ حذفِ هر فایل برای صفحه‌خوان. */
  removeLabel?: (file: File) => string
  /**
   * بارگذاریِ هر فایلِ پذیرفته‌شده. با آن، هر فایل در فهرست نوارِ پیشرفت و
   * درصد، بعد تیکِ «بارگذاری شد» یا پیامِ خطا با دکمهٔ تلاشِ دوباره می‌گیرد.
   * بدونِ آن، فایل‌ها فقط انتخاب می‌شوند و با فرم می‌روند.
   */
  onUpload?: FileUploadHandler
  /** list: ردیف با تامنیلِ کوچک؛ grid: کارت با تامنیلِ بزرگ، برای تصویر. */
  layout?: "list" | "grid"
}

/** حجمِ فایل با ارقامِ فارسی: ۲٫۴ مگابایت */
export function formatFileSize(bytes: number) {
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت"]
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  const rounded = unit === 0 ? size : Math.round(size * 10) / 10
  return `${toFaDigits(String(rounded).replace(".", "٫"))} ${units[unit]}`
}

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true
  return accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .some((rule) => {
      if (rule.startsWith(".")) return file.name.toLowerCase().endsWith(rule)
      if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1))
      return file.type === rule
    })
}

function FileUpload({
  className,
  accept,
  multiple = false,
  maxSize,
  maxFiles,
  files: filesProp,
  onFilesChange,
  onReject,
  name,
  id,
  disabled = false,
  invalid = false,
  required,
  title,
  hint,
  removeLabel = (file) => `حذف ${file.name}`,
  onUpload,
  layout = "list",
  ...props
}: FileUploadProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [internal, setInternal] = React.useState<File[]>([])
  const [dragging, setDragging] = React.useState(false)
  const [rejections, setRejections] = React.useState<FileRejection[]>([])
  const files = filesProp ?? internal
  const [statuses, setStatuses] = React.useState(() => new Map<File, FileUploadStatus>())
  const controllers = React.useRef(new Map<File, AbortController>())

  const setStatus = (file: File, status: FileUploadStatus | undefined) =>
    setStatuses((current) => {
      const next = new Map(current)
      if (status) next.set(file, status)
      else next.delete(file)
      return next
    })

  const upload = (file: File) => {
    if (!onUpload) return
    const controller = new AbortController()
    controllers.current.set(file, controller)
    setStatus(file, { state: "uploading", progress: 0 })
    onUpload(file, {
      signal: controller.signal,
      onProgress: (percent) => {
        if (!controller.signal.aborted) {
          setStatus(file, { state: "uploading", progress: Math.max(0, Math.min(100, percent)) })
        }
      },
    })
      .then(() => {
        if (!controller.signal.aborted) setStatus(file, { state: "done" })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setStatus(file, {
          state: "error",
          message: error instanceof Error && error.message ? error.message : "بارگذاری انجام نشد.",
        })
      })
      .finally(() => controllers.current.delete(file))
  }

  /** input بومی همیشه همان فایل‌های فهرست را دارد تا submitِ فرم درست باشد. */
  const syncInput = React.useCallback((next: File[]) => {
    const input = inputRef.current
    if (!input || typeof DataTransfer === "undefined") return
    const transfer = new DataTransfer()
    next.forEach((file) => transfer.items.add(file))
    input.files = transfer.files
  }, [])

  const commit = (next: File[]) => {
    if (filesProp === undefined) setInternal(next)
    syncInput(next)
    onFilesChange?.(next)
  }

  const add = (incoming: File[]) => {
    const accepted: File[] = []
    const rejected: FileRejection[] = []
    const room = multiple ? (maxFiles ?? Infinity) - files.length : 1
    const isDuplicate = (file: File) =>
      [...files, ...accepted].some((other) => other.name === file.name && other.size === file.size)
    for (const file of incoming) {
      if (isDuplicate(file)) rejected.push({ file, reason: "این فایل قبلاً اضافه شده." })
      else if (!matchesAccept(file, accept)) rejected.push({ file, reason: "نوعِ این فایل مجاز نیست." })
      else if (maxSize !== undefined && file.size > maxSize)
        rejected.push({ file, reason: `حجم بیشتر از ${formatFileSize(maxSize)} است.` })
      else if (accepted.length >= room)
        rejected.push({ file, reason: `حداکثر ${toFaDigits(maxFiles ?? 1)} فایل مجاز است.` })
      else accepted.push(file)
    }
    setRejections(rejected)
    if (rejected.length > 0) onReject?.(rejected)
    if (accepted.length > 0) {
      if (!multiple) {
        files.forEach((file) => {
          controllers.current.get(file)?.abort()
          releaseThumbnail(file)
        })
      }
      commit(multiple ? [...files, ...accepted] : accepted)
      accepted.forEach(upload)
    } else syncInput(files)
  }

  const remove = (target: File) => {
    controllers.current.get(target)?.abort()
    releaseThumbnail(target)
    setStatus(target, undefined)
    commit(files.filter((file) => file !== target))
    inputRef.current?.focus()
  }

  const uploadingCount = files.filter((file) => statuses.get(file)?.state === "uploading").length
  const hasError = invalid || rejections.length > 0
  const errorId = `${inputId}-errors`

  return (
    <div data-slot="file-upload" className={cn("flex flex-col gap-3", className)} {...props}>
      <label
        htmlFor={inputId}
        data-dragging={dragging || undefined}
        data-disabled={disabled || undefined}
        data-invalid={hasError || undefined}
        onDragOver={(event) => {
          if (disabled) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled) add(Array.from(event.dataTransfer.files))
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-background px-6 py-10 text-center transition-colors",
          "hover:border-[color-mix(in_oklab,var(--brand-secondary)_45%,var(--input))] hover:bg-muted",
          "has-[input:focus-visible]:border-ring has-[input:focus-visible]:ring-[3px] has-[input:focus-visible]:ring-ring/50",
          // کشیدنِ فایل روی ناحیه: حاشیهٔ توپرِ رنگِ مکمل و ته‌رنگِ ملایم؛ متن هم «رها کنید» می‌شود.
          "data-[dragging]:border-solid data-[dragging]:border-brand-secondary data-[dragging]:bg-[color-mix(in_oklab,var(--brand-secondary)_8%,var(--background))]",
          "data-[invalid]:border-destructive",
          "data-[disabled]:cursor-not-allowed data-[disabled]:border-border data-[disabled]:bg-muted data-[disabled]:text-placeholder"
        )}
      >
        <span className="mb-1 flex size-12 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--brand-secondary)_12%,var(--card))] text-brand-secondary [&>svg]:size-5">
          <ArrowUpIcon />
        </span>
        <span className="text-sm font-medium">
          {dragging ? (
            "فایل را این‌جا رها کنید"
          ) : (
            title ?? (
              <>
                <span className="font-semibold text-brand-secondary">برای انتخاب کلیک کنید</span> یا فایل را این‌جا بکشید
              </>
            )
          )}
        </span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          name={name}
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          required={required && files.length === 0}
          aria-invalid={hasError || undefined}
          aria-describedby={rejections.length > 0 ? errorId : undefined}
          className="sr-only"
          onChange={(event) => add(Array.from(event.target.files ?? []))}
        />
      </label>

      {rejections.length > 0 && (
        <ul id={errorId} className="flex flex-col gap-1 text-xs text-destructive" aria-live="polite">
          {rejections.map(({ file, reason }) => (
            <li key={`${file.name}-${file.size}`}>
              «{file.name}»: {reason}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && layout === "list" && (
        <p className="mt-2 text-sm font-semibold" aria-live="polite">
          {uploadingCount > 0
            ? `${toFaDigits(uploadingCount)} فایل در حال بارگذاری…`
            : `${toFaDigits(files.length)} فایل`}
        </p>
      )}

      {files.length > 0 && (
        <ul
          data-slot="file-upload-list"
          data-layout={layout}
          className={cn(
            layout === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3" : "flex flex-col gap-2"
          )}
        >
          {files.map((file) => (
            <FileUploadItem
              key={`${file.name}-${file.size}-${file.lastModified}`}
              file={file}
              layout={layout}
              status={statuses.get(file)}
              disabled={disabled}
              removeLabel={removeLabel(file)}
              onRemove={() => remove(file)}
              onRetry={() => upload(file)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}


/**
 * تامنیلِ تصویر با object URL. یک بار برای هر File ساخته می‌شود و با حذفِ
 * فایل از فهرست آزاد می‌شود (نه در cleanupِ افکت، که در StrictMode تصویرِ
 * هنوز-بارنشده را می‌شکست).
 */
const thumbnails = new WeakMap<File, string>()

function thumbnailOf(file: File) {
  const previewable = file.type.startsWith("image/") || file.type.startsWith("audio/")
  if (!previewable || typeof URL.createObjectURL !== "function") return null
  let url = thumbnails.get(file)
  if (!url) {
    url = URL.createObjectURL(file)
    thumbnails.set(file, url)
  }
  return url
}

function releaseThumbnail(file: File) {
  const url = thumbnails.get(file)
  if (url) URL.revokeObjectURL(url)
  thumbnails.delete(file)
}

/** «PNG» از نام یا نوعِ فایل، برای خطِ اطلاعات. */
function fileKind(file: File) {
  const extension = file.name.includes(".") ? file.name.split(".").pop() : file.type.split("/").pop()
  return (extension ?? "").toUpperCase().slice(0, 5)
}

/** رنگِ برچسبِ نوعِ فایل؛ نوع با رنگ و متن هر دو گفته می‌شود، نه فقط رنگ. */
function kindTone(kind: string) {
  if (kind === "PDF") return "var(--dig-red-600)"
  if (["XLS", "XLSX", "CSV"].includes(kind)) return "var(--dig-green-600)"
  if (["DOC", "DOCX", "TXT"].includes(kind)) return "var(--dig-blue-600)"
  if (["ZIP", "RAR", "7Z"].includes(kind)) return "var(--dig-amber-700)"
  if (["PPT", "PPTX", "KEY"].includes(kind)) return "var(--dig-orange-700)"
  return "var(--brand-secondary)"
}

/**
 * آیکونِ واقعیِ فایل: برگه با گوشهٔ تاخورده و برچسبِ رنگیِ پسوند (PDF قرمز،
 * اکسل سبز، ورد آبی، فشرده کهربایی). مثلِ آیکونِ فایل در سیستم‌عامل، قرینه نمی‌شود.
 */
function FileTypeIcon({ kind, className }: { kind: string; className?: string }) {
  const tone = kindTone(kind)
  const label = kind.slice(0, 4)
  const width = 6 + label.length * 5.2
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" data-slot="file-type-icon" className={cn("shrink-0", className)}>
      <path
        d="M10 2.5h14.5l9 9V36a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 36V4A1.5 1.5 0 0 1 10 2.5Z"
        fill="var(--card)"
        stroke="var(--border)"
      />
      <path d="M24.5 2.5V10a1.5 1.5 0 0 0 1.5 1.5h7.5" fill={`color-mix(in oklab, ${tone} 14%, var(--card))`} stroke="var(--border)" />
      <rect x={4} y={19} width={width} height={11} rx={2.5} fill={tone} />
      <text
        x={4 + width / 2}
        y={26.6}
        textAnchor="middle"
        fontSize={6.6}
        fontWeight={700}
        fill="var(--dig-white)"
        style={{ fontFamily: "var(--font-sans)", letterSpacing: 0.2 }}
      >
        {label}
      </text>
    </svg>
  )
}

const iconButton =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-placeholder [&>svg]:size-4"

/**
 * هر فایل یک ردیفِ کم‌حرف است: تامنیل، نام، و یک خطِ اطلاعاتِ کوتاه. وضعیت
 * با کمترین متن گفته می‌شود: درصد و یک نوارِ نازک حینِ بارگذاری، تیکِ سبز
 * بعد از آن، و فقط در خطا یک پیامِ کوتاه با دکمهٔ «تلاش دوباره».
 */
function FileUploadItem({
  file,
  layout,
  status,
  disabled,
  removeLabel,
  onRemove,
  onRetry,
}: {
  file: File
  layout: "list" | "grid"
  status?: FileUploadStatus
  disabled: boolean
  removeLabel: string
  onRemove: () => void
  onRetry: () => void
}) {
  const thumbnail = thumbnailOf(file)
  const grid = layout === "grid"
  const uploading = status?.state === "uploading" ? status.progress : null
  const failed = status?.state === "error" ? status.message : null
  const done = status?.state === "done"
  const isAudio = file.type.startsWith("audio/")
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const [playback, setPlayback] = React.useState<{ playing: boolean; current: number; duration: number }>({
    playing: false,
    current: 0,
    duration: 0,
  })

  // فایلِ صوتی به‌جای تامنیل دکمهٔ پخش می‌گیرد؛ شروعِ یکی بقیهٔ پخش‌کننده‌های صفحه را مکث می‌کند.
  React.useEffect(() => {
    if (!isAudio) return
    const onOtherPlay = (event: Event) => {
      if (event.target !== audioRef.current) audioRef.current?.pause()
    }
    document.addEventListener(PLAYING_EVENT, onOtherPlay)
    return () => document.removeEventListener(PLAYING_EVENT, onOtherPlay)
  }, [isAudio])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.dispatchEvent(new Event(PLAYING_EVENT, { bubbles: true }))
      void audio.play().catch(() => undefined)
    } else audio.pause()
  }
  const started = playback.playing || playback.current > 0

  const doneMark = done && (
    <span className="flex shrink-0 text-success [&>svg]:size-3.5 [&>svg]:stroke-[2.5]" role="img" aria-label="بارگذاری شد">
      <CheckIcon />
    </span>
  )

  const meta = failed ? (
    <span className="flex min-w-0 items-center gap-2 text-xs">
      <span className="truncate text-destructive">{failed}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={onRetry}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded font-semibold text-foreground outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:size-3.5"
      >
        <RefreshIcon />
        تلاشِ دوباره
      </button>
    </span>
  ) : isAudio && started ? (
    <span className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground" dir="ltr">
      {formatDuration(playback.current)} / {formatDuration(playback.duration)}
    </span>
  ) : uploading !== null ? (
    <span className="text-xs tabular-nums text-muted-foreground">
      {formatFileSize(file.size)} · در حال بارگذاری…
    </span>
  ) : (
    <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      {doneMark}
      {/* bdi تا «PNG» لاتین ترتیبِ عدد و واحد را در RTL به‌هم نریزد. */}
      {/* در کارتِ grid تامنیل خودش نوع را نشان می‌دهد؛ فقط حجم. */}
      <span className="truncate">
        {formatFileSize(file.size)}
        {!grid && (
          <>
            {" · "}
            {done ? <span className="text-success">بارگذاری شد</span> : <bdi>{fileKind(file)}</bdi>}
          </>
        )}
      </span>
    </span>
  )

  // کنش‌ها هیچ‌وقت روی تصویر نمی‌نشینند؛ کنارِ نام، در همان ردیفِ متن.
  const actions = (
    <span className="flex shrink-0 items-center">
      {/* حینِ بارگذاری «لغو» (×)، بعد از آن «حذف» (سطل)؛ دو کارِ متفاوت، دو آیکونِ متفاوت. */}
      <button
        type="button"
        aria-label={uploading !== null ? `لغوِ بارگذاری ${file.name}` : removeLabel}
        title={uploading !== null ? "لغو" : "حذف"}
        disabled={disabled}
        onClick={onRemove}
        className={cn(iconButton, uploading === null && "hover:text-destructive")}
      >
        {uploading !== null ? <XIcon /> : <TrashIcon />}
      </button>
    </span>
  )

  const name = (
    // در grid نام تا دو خط می‌شکند تا پسوند بریده نشود؛ در list یک خط.
    // جهت فقط روی خودِ نام (bdi)، نه روی خطِ نگه‌دارنده؛ وگرنه نامِ لاتین کلِ خط را
    // چپ‌به‌راست می‌کرد و در فهرستِ راست‌چین سمتِ چپ می‌افتاد.
    <span
      className={cn("text-start font-medium", grid ? "line-clamp-2 px-0.5 [overflow-wrap:anywhere]" : "truncate")}
      title={file.name}
      aria-label={file.name}
    >
      <bdi dir="auto">{middleTruncate(file.name, grid ? 30 : 36)}</bdi>
    </span>
  )

  const progress = uploading !== null && (
    <span className="flex items-center gap-3">
      <Progress value={uploading} size="sm" color="primary" aria-label={`بارگذاری ${file.name}`} className="flex-1 rounded-full" />
      {!grid && <span className="w-9 shrink-0 text-end text-xs tabular-nums text-muted-foreground">{toFaDigits(Math.round(uploading))}٪</span>}
    </span>
  )

  const audioElement = isAudio && thumbnail && (
    <audio
      ref={audioRef}
      src={thumbnail}
      preload="metadata"
      onPlay={() => setPlayback((value) => ({ ...value, playing: true }))}
      onPause={() => setPlayback((value) => ({ ...value, playing: false }))}
      onEnded={() => setPlayback((value) => ({ ...value, playing: false, current: 0 }))}
      onTimeUpdate={(event) => {
        const current = event.currentTarget.currentTime
        setPlayback((value) => ({ ...value, current }))
      }}
      onLoadedMetadata={(event) => {
        const duration = event.currentTarget.duration
        if (Number.isFinite(duration)) setPlayback((value) => ({ ...value, duration }))
      }}
    />
  )

  const preview = isAudio ? (
    <button
      type="button"
      data-slot="file-upload-thumbnail"
      aria-label={playback.playing ? `مکث ${file.name}` : `پخش ${file.name}`}
      aria-pressed={playback.playing}
      onClick={togglePlayback}
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:brightness-125",
        grid ? "aspect-[4/3] w-full [&>svg]:size-8" : "size-9 [&>svg]:size-4"
      )}
    >
      {playback.playing ? <PauseIcon /> : <PlayIcon className="translate-x-px" />}
    </button>
  ) : (
    <span
      data-slot="file-upload-thumbnail"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-md text-muted-foreground",
        // تصویر و آیکونِ عمومی روی زمینهٔ خنثی؛ آیکونِ نوعِ فایل خودش برگه دارد و زمینه نمی‌خواهد.
        (thumbnail || !fileKind(file)) && "bg-muted",
        grid
          ? "aspect-[4/3] w-full [&>svg:not([data-slot=file-type-icon])]:size-8"
          : "size-11 rounded-lg [&>svg:not([data-slot=file-type-icon])]:size-4"
      )}
    >
      {thumbnail && !isAudio ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL محلی است، نه تصویرِ بهینه‌شدنی
        <img src={thumbnail} alt="" className="size-full object-cover" />
      ) : fileKind(file) ? (
        <FileTypeIcon kind={fileKind(file)} className={grid ? "size-16" : "size-11"} />
      ) : (
        <FileTextIcon />
      )}
    </span>
  )

  if (grid) {
    return (
      <li
        data-slot="file-upload-item"
        data-state={status?.state}
        aria-busy={uploading !== null || undefined}
        className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-2 text-sm data-[state=error]:border-destructive"
      >
        {audioElement}
        {preview}
        {progress}
        {/* نام تمام‌عرض (تا دو خط)، و زیرش یک ردیف: اطلاعات در ابتدا، کنش‌ها در انتها. */}
        {name}
        <span className="flex min-w-0 items-center justify-between gap-1">
          {meta}
          {actions}
        </span>
      </li>
    )
  }

  return (
    <li
      data-slot="file-upload-item"
      data-state={status?.state}
      aria-busy={uploading !== null || undefined}
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-sm data-[state=error]:border-destructive"
    >
      {audioElement}
      {preview}
      {/* نام و کنش در یک ردیف، اطلاعات زیرش و نوارِ پیشرفت با درصد در انتها. */}
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex min-w-0 items-start justify-between gap-2">
          {name}
          {actions}
        </span>
        {meta}
        {progress}
      </span>
    </li>
  )
}

/**
 * نامِ بلند از وسط کوتاه می‌شود تا پسوند دیده بماند:
 * «نمای-روبه‌روی-ساخ…نهایی.png». نامِ کامل در title و aria-label است.
 */
export function middleTruncate(name: string, max: number) {
  if (name.length <= max) return name
  const dot = name.lastIndexOf(".")
  const extension = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : ""
  const base = extension ? name.slice(0, dot) : name
  const room = max - extension.length - 1
  const head = Math.ceil(room * 0.6)
  const tail = room - head
  return `${base.slice(0, head)}…${base.slice(base.length - tail)}${extension}`
}

export { FileTypeIcon, FileUpload, type FileUploadProps }
