"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useSpring,
  type Transition,
} from "motion/react";
import { cn } from "cn";
import {
  IconAlertCircle,
  IconArchiveUp,
  IconClose,
  IconCloudUpload,
  IconDocumentText,
  IconGallery,
  IconGrid2x2,
  IconMusicNote,
  IconPause,
  IconPenTool,
  IconPlay,
  IconPresentationGraph,
  IconTickCircle,
  IconTrashBinMinimalistic,
  IconUploadMinimalistic,
  IconVideo,
} from "@devigner-ui/icons";
import { useReducedMotionPreference } from "devignerui/hooks";
import {
  EASE_OUT,
  SPRING_LAYOUT,
  SPRING_MOUSE,
  SPRING_PANEL,
  SPRING_PRESS,
  SPRING_SWAP,
} from "devignerui/motion";

/* ─── Shared ─── */

/** Side inset of the progress track (mx-3.5). The wash behind the card
 *  uses it so its edge lands exactly on the bar's head. */
const TRACK_INSET = "0.875rem";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

/** Index into UNITS that reads best for a byte count. */
function unitOf(bytes: number) {
  let unit = 0;
  while (bytes >= 1024 ** (unit + 1) && unit < UNITS.length - 1) unit++;
  return unit;
}

/** 1.4 MB, 391 MB. Binary units. `unit` lets a running count share its
 *  total's unit ("0.8 MB of 2.3 MB", not "812 KB of 2.3 MB"); `fixed` keeps
 *  the trailing .0 so the count doesn't jitter in width. */
function formatBytes(bytes: number, unit = unitOf(bytes), fixed = false) {
  const value = Math.max(0, bytes) / 1024 ** unit;
  const text = fixed ? value.toFixed(1) : String(+value.toFixed(1));
  return `${text} ${UNITS[unit]}`;
}

/** Text that trades places with a blur. */
const swap = {
  initial: { opacity: 0, y: 6, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -6, filter: "blur(4px)" },
};

/** Inline pieces of a line that fold away to nothing. */
const fold = {
  initial: { opacity: 0, width: 0, filter: "blur(4px)" },
  animate: { opacity: 1, width: "auto", filter: "blur(0px)" },
  exit: { opacity: 0, width: 0, filter: "blur(4px)" },
};

/** Icons and buttons trading places. */
const pop = {
  initial: { opacity: 0, scale: 0.5, filter: "blur(4px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.5, filter: "blur(4px)" },
};

const extensionOf = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

type Glyph = typeof IconArchiveUp;

/** Badge color and glyph by extension. Families, not brands: every archive
 *  is amber, every image blue, so a list scans by kind at a glance. */
const FAMILIES: [RegExp, string, Glyph][] = [
  [/^(zip|7z|tar|gz|tgz|bz2|xz)$/, "bg-amber-500", IconArchiveUp],
  [/^rar$/, "bg-violet-500", IconArchiveUp],
  [/^pdf$/, "bg-red-600", IconDocumentText],
  [/^(ai|eps|psd|cdr|fig|sketch|svg|indd)$/, "bg-orange-500", IconPenTool],
  [/^(png|jpe?g|gif|webp|avif|heic|bmp|tiff?)$/, "bg-blue-500", IconGallery],
  [/^(mp4|mov|webm|mkv|avi)$/, "bg-pink-500", IconVideo],
  [/^(mp3|wav|flac|aac|ogg|m4a)$/, "bg-sky-500", IconMusicNote],
  [/^(docx?|txt|rtf|md|pages|odt)$/, "bg-indigo-500", IconDocumentText],
  [/^(xlsx?|csv|numbers|ods)$/, "bg-emerald-500", IconGrid2x2],
  [/^(pptx?|key|odp)$/, "bg-orange-600", IconPresentationGraph],
];

const familyOf = (ext: string) => {
  const hit = FAMILIES.find(([re]) => re.test(ext));
  return {
    color: hit?.[1] ?? "bg-primary",
    Glyph: hit?.[2] ?? IconDocumentText,
  };
};

/** A dog-eared file: its type in a colored page, or the image itself when
 *  there is a preview. */
export function FileBadge({
  ext,
  preview,
  className,
}: {
  ext: string;
  preview?: string;
  className?: string;
}) {
  // Formats the browser can't decode (HEIC on most) fall back to the badge.
  const [broken, setBroken] = React.useState(false);
  if (preview && !broken) {
    return (
      <img
        src={preview}
        alt=""
        aria-hidden
        decoding="async"
        onError={() => setBroken(true)}
        className={cn(
          "size-10 shrink-0 rounded-lg object-cover ring-1 ring-border",
          className,
        )}
      />
    );
  }
  const { color, Glyph } = familyOf(ext);
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex h-10 w-9 shrink-0 flex-col items-center justify-between rounded-lg pt-2 pb-1.5 text-white",
        "[clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)]",
        color,
        className,
      )}
    >
      <span className="absolute top-0 right-0 size-2.5 rounded-bl-[3px] bg-white/40" />
      <Glyph variant="Bold" className="size-3.5" />
      <span className="text-[8px] leading-none font-bold tracking-wide uppercase">
        {ext.slice(0, 4) || "file"}
      </span>
    </div>
  );
}

/** An arc that spins while bytes move and freezes where it is on pause. */
function Spinner({ paused, still }: { paused: boolean; still: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn(
        "mr-1 ml-1.5 size-3.5 shrink-0",
        !still && "animate-spin",
        paused && "text-foreground/70 [animation-play-state:paused]",
      )}
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="2.5"
      />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="12 100"
      />
    </svg>
  );
}

/** Puts files on a file input so a native form submit carries them. */
function setInputFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input || typeof DataTransfer === "undefined") return;
  const dt = new DataTransfer();
  for (const file of files) dt.items.add(file);
  input.files = dt.files;
}

/* ─── File card ─── */

export type FileUploadStatus =
  "queued" | "uploading" | "paused" | "completed" | "error";

const LABELS: Record<FileUploadStatus, string> = {
  queued: "Queued",
  uploading: "Uploading",
  paused: "Paused",
  completed: "Completed",
  error: "Failed",
};

const TONES: Record<FileUploadStatus, string> = {
  queued: "text-amber-600 dark:text-amber-500",
  uploading: "text-primary",
  paused: "text-muted-foreground",
  completed: "text-foreground",
  error: "text-muted-foreground",
};

export interface FileUploadClassNames {
  root?: string;
  card?: string;
  badge?: string;
  name?: string;
  status?: string;
  track?: string;
  fill?: string;
  actions?: string;
}

export interface FileUploadProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children" | "onChange"
> {
  name: string;
  size: number;
  progress?: number;
  status?: FileUploadStatus;
  error?: React.ReactNode;
  extension?: string;
  preview?: string;
  onPause?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  onCancel?: () => void;
  onRemove?: () => void;
  onChange?: () => void;
  onDownload?: () => void;
  changeLabel?: string;
  downloadLabel?: string;
  retryLabel?: string;
  classNames?: FileUploadClassNames;
}

export function FileUpload({
  name,
  size,
  progress = 0,
  status = "uploading",
  error,
  extension,
  preview,
  onPause,
  onResume,
  onRetry,
  onCancel,
  onRemove,
  onChange,
  onDownload,
  changeLabel = "Change",
  downloadLabel = "Download",
  retryLabel = "Retry",
  classNames,
  className,
  ...rest
}: FileUploadProps) {
  const reduced = useReducedMotionPreference();
  const move = (t: Transition): Transition => (reduced ? { duration: 0 } : t);
  const tap = reduced ? undefined : { scale: 0.9 };

  const done = status === "completed";
  const paused = status === "paused";
  const errored = status === "error";
  const active = status === "uploading" || paused;
  const fraction = done ? 1 : Math.min(Math.max(progress, 0), 1);
  const percent = Math.floor(fraction * 100);
  const ext = (extension ?? extensionOf(name)).toLowerCase();
  const unit = unitOf(size);
  const toggle =
    status === "uploading"
      ? onPause
      : paused || status === "queued"
        ? onResume
        : undefined;
  const hasActions = done && (onChange || onDownload);

  const iconButton =
    "grid size-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      {...rest}
      className={cn(
        "relative w-full rounded-2xl bg-muted",
        className,
        classNames?.root,
      )}
    >
      <div
        className={cn(
          "group/upload relative overflow-hidden rounded-2xl text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05)] ring-1 transition-[background-color,box-shadow] duration-300 ease-out",
          errored
            ? "bg-[color-mix(in_oklab,var(--destructive)_6%,var(--card))] ring-destructive"
            : "bg-card ring-border",
          classNames?.card,
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 border-r bg-linear-to-r from-transparent transition-opacity duration-300 ease-out",
            paused
              ? "border-dashed border-foreground/10 to-foreground/3"
              : "border-primary/10 to-primary/5",
            active ? "opacity-100" : "opacity-0",
          )}
          style={{
            width: `calc(${TRACK_INSET} + (100% - 2 * ${TRACK_INSET}) * ${fraction})`,
          }}
        />

        <div className="relative flex items-center gap-3 p-3.5">
          <FileBadge
            ext={ext}
            preview={preview}
            className={classNames?.badge}
          />

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-semibold tracking-tight",
                classNames?.name,
              )}
            >
              {name}
            </p>
            <div
              className={cn(
                "mt-0.5 flex items-center overflow-hidden text-[13px] whitespace-nowrap tabular-nums text-muted-foreground",
                classNames?.status,
              )}
            >
              <AnimatePresence initial={false}>
                {(done || errored) && (
                  <motion.span
                    key={done ? "tick" : "alert"}
                    {...fold}
                    transition={move(SPRING_SWAP)}
                    className="flex shrink-0 items-center overflow-hidden"
                  >
                    {done ? (
                      <IconTickCircle
                        variant="Bold"
                        className="mr-1 size-4 text-emerald-500"
                      />
                    ) : (
                      <IconAlertCircle
                        variant="Bold"
                        className="mr-1 size-4 text-destructive"
                      />
                    )}
                  </motion.span>
                )}
              </AnimatePresence>
              <span
                aria-live="polite"
                className={cn(
                  "relative inline-flex transition-colors duration-300 ease-out",
                  errored ? "min-w-0" : "shrink-0",
                  TONES[status],
                )}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={status}
                    {...swap}
                    transition={move(SPRING_SWAP)}
                    className={errored ? "truncate" : undefined}
                  >
                    {errored ? (error ?? "Upload failed") : LABELS[status]}
                  </motion.span>
                </AnimatePresence>
              </span>
              <AnimatePresence initial={false}>
                {active && (
                  <motion.span
                    key="percent"
                    {...fold}
                    transition={move(SPRING_SWAP)}
                    className={cn(
                      "flex items-center overflow-hidden",
                      TONES[status],
                    )}
                  >
                    <Spinner paused={paused} still={reduced} />
                    {percent}%
                  </motion.span>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {!errored && (
                  <motion.span
                    key="bytes"
                    {...fold}
                    transition={move(SPRING_SWAP)}
                    className="flex items-center overflow-hidden"
                  >
                    <span
                      aria-hidden
                      className="mx-1.5 size-0.75 shrink-0 rounded-full bg-muted-foreground/50"
                    />
                    {formatBytes(fraction * size, unit, !done && fraction > 0)}
                  </motion.span>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {!done && !errored && (
                  <motion.span
                    key="total"
                    {...fold}
                    transition={move(SPRING_SWAP)}
                    className="overflow-hidden"
                  >
                    &nbsp;of {formatBytes(size)}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 self-start">
            <AnimatePresence initial={false}>
              {toggle && (
                <motion.button
                  key="toggle"
                  type="button"
                  onClick={toggle}
                  aria-label={
                    status === "uploading"
                      ? "Pause upload"
                      : paused
                        ? "Resume upload"
                        : "Start upload"
                  }
                  {...pop}
                  transition={move(SPRING_SWAP)}
                  whileTap={tap}
                  className={cn(
                    iconButton,
                    "bg-muted text-foreground transition-opacity duration-200 ease-out",
                    status === "uploading" &&
                      "[@media(hover:hover)_and_(pointer:fine)]:not-group-hover/upload:not-focus-visible:opacity-0",
                  )}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={status === "uploading" ? "pause" : "play"}
                      {...pop}
                      transition={move(SPRING_SWAP)}
                      className="grid place-items-center"
                    >
                      {status === "uploading" ? (
                        <IconPause variant="Bold" className="size-3" />
                      ) : (
                        <IconPlay variant="Bold" className="size-3" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {errored && onRetry && (
                <motion.button
                  key="retry"
                  type="button"
                  onClick={onRetry}
                  {...pop}
                  transition={move(SPRING_SWAP)}
                  whileTap={tap}
                  className="h-6 rounded-full px-2 text-[13px] font-semibold text-destructive outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {retryLabel}
                </motion.button>
              )}
            </AnimatePresence>
            <AnimatePresence mode="popLayout" initial={false}>
              {done
                ? onRemove && (
                    <motion.button
                      key="remove"
                      type="button"
                      onClick={onRemove}
                      aria-label="Remove file"
                      {...pop}
                      transition={move(SPRING_SWAP)}
                      whileTap={tap}
                      className={cn(
                        iconButton,
                        "bg-destructive/10 text-destructive hover:bg-destructive/15",
                      )}
                    >
                      <IconTrashBinMinimalistic
                        variant="Bold"
                        className="size-3.5"
                      />
                    </motion.button>
                  )
                : onCancel && (
                    <motion.button
                      key="cancel"
                      type="button"
                      onClick={onCancel}
                      aria-label={errored ? "Dismiss" : "Cancel upload"}
                      {...pop}
                      transition={move(SPRING_SWAP)}
                      whileTap={tap}
                      className={cn(
                        iconButton,
                        "text-foreground hover:bg-muted",
                      )}
                    >
                      <IconClose className="size-3.5" strokeWidth={2.2} />
                    </motion.button>
                  )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {active && (
            <motion.div
              key="bar"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={move(SPRING_LAYOUT)}
              className="relative"
            >
              <div
                role="progressbar"
                aria-label={`Uploading ${name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className={cn(
                  "mx-3.5 mb-3.5 h-1 overflow-hidden rounded-full bg-muted",
                  classNames?.track,
                )}
              >
                <div
                  style={{ transform: `scaleX(${fraction})` }}
                  className={cn(
                    "size-full origin-left transition-[background-color,opacity] duration-300 ease-out",
                    paused
                      ? "bg-foreground/80"
                      : "bg-linear-to-r from-primary/0 via-primary/50 to-primary",
                    classNames?.fill,
                  )}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {hasActions && (
          <motion.div
            key="actions"
            initial={{ height: 0, opacity: 0, y: -12 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -12 }}
            transition={move({ ...SPRING_PANEL, delay: 0.15 })}
            className="overflow-hidden"
          >
            <div className={cn("flex gap-2 p-2", classNames?.actions)}>
              {onChange && (
                <motion.button
                  type="button"
                  onClick={onChange}
                  whileTap={reduced ? undefined : { scale: 0.97 }}
                  transition={SPRING_PRESS}
                  className="h-9 flex-1 rounded-xl bg-background text-sm font-semibold text-foreground outline-none hover:bg-background/70 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {changeLabel}
                </motion.button>
              )}
              {onDownload && (
                <motion.button
                  type="button"
                  onClick={onDownload}
                  whileTap={reduced ? undefined : { scale: 0.97 }}
                  transition={SPRING_PRESS}
                  className="h-9 flex-1 rounded-xl bg-foreground text-sm font-semibold text-background outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {downloadLabel}
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Dropzone ─── */

export type FileRejectionReason =
  "file-too-large" | "file-invalid-type" | "too-many-files" | "custom";

export type FileValidator = (
  file: File,
  accepted: readonly File[],
) => string | null | undefined;

export interface FileRejection {
  file: File;
  reason: FileRejectionReason;
  message: string;
}

function acceptLabels(accept?: string) {
  if (!accept) return [];
  return accept
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      if (t.startsWith(".")) return t.slice(1).toUpperCase();
      const [type, sub] = t.split("/");
      if (sub === "*") return `${type}s`;
      return sub.length <= 4 ? sub.toUpperCase() : sub;
    });
}

const orFormat = new Intl.ListFormat("en", { type: "disjunction" });
const orList = (items: string[]) => orFormat.format(items);

function accepts(file: File, accept?: string) {
  if (!accept) return true;
  const ext = `.${extensionOf(file.name)}`;
  const mime = file.type.toLowerCase();
  return accept.split(",").some((raw) => {
    const t = raw.trim().toLowerCase();
    if (!t) return false;
    if (t.startsWith(".")) return ext === t;
    if (t.endsWith("/*")) return mime.startsWith(t.slice(0, -1));
    return mime === t;
  });
}

function validateFiles(
  files: File[],
  {
    accept,
    maxSize,
    maxFiles,
    validate,
  }: {
    accept?: string;
    maxSize?: number;
    maxFiles?: number;
    validate?: FileValidator;
  },
) {
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  const types = acceptLabels(accept);
  for (const file of files) {
    let custom: string | null | undefined;
    if (!accepts(file, accept)) {
      rejected.push({
        file,
        reason: "file-invalid-type",
        message: types.length
          ? `Only ${orList(types)} are allowed`
          : "This file type isn't allowed",
      });
    } else if (maxSize !== undefined && file.size > maxSize) {
      rejected.push({
        file,
        reason: "file-too-large",
        message: `Over the ${formatBytes(maxSize)} limit`,
      });
    } else if ((custom = validate?.(file, accepted))) {
      rejected.push({ file, reason: "custom", message: custom });
    } else if (maxFiles !== undefined && accepted.length >= maxFiles) {
      rejected.push({
        file,
        reason: "too-many-files",
        message:
          maxFiles <= 0
            ? "No more files can be added"
            : `Up to ${maxFiles} ${maxFiles === 1 ? "file" : "files"} at a time`,
      });
    } else accepted.push(file);
  }
  return { accepted, rejected };
}

function summarize(rejected: FileRejection[]) {
  const [first] = rejected;
  if (!first) return null;
  if (rejected.length === 1) return `${first.file.name}: ${first.message}.`;
  return `${first.message}. ${rejected.length} files left out.`;
}

const MIME_EXT: Record<string, string> = {
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/x-rar-compressed": "rar",
  "application/vnd.rar": "rar",
  "application/x-7z-compressed": "7z",
  "application/pdf": "pdf",
  "application/postscript": "ai",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
};

function extFromMime(mime: string) {
  if (MIME_EXT[mime]) return MIME_EXT[mime];
  const sub = mime.split("/")[1] ?? "";
  return sub.length > 0 && sub.length <= 4 ? sub : "";
}

export interface FileDropzoneClassNames {
  root?: string;
  icon?: string;
  label?: string;
  hint?: string;
}

export interface FileDropzoneProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children" | "onDrop"
> {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  validate?: FileValidator;
  blocked?: string;
  disabled?: boolean;
  onFiles?: (accepted: File[], rejected: FileRejection[]) => void;
  error?: React.ReactNode;
  label?: React.ReactNode;
  chooseLabel?: React.ReactNode;
  hint?: React.ReactNode;
  name?: string;
  classNames?: FileDropzoneClassNames;
}

type DragInfo = { count: number; ext: string };

export function FileDropzone({
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  validate,
  blocked,
  disabled = false,
  onFiles,
  error: forcedError,
  label = multiple ? "Drag and drop files or" : "Drag and drop a file or",
  chooseLabel = "choose",
  hint,
  name,
  classNames,
  className,
  onPaste,
  ...rest
}: FileDropzoneProps) {
  const reduced = useReducedMotionPreference();
  const move = (t: Transition): Transition => (reduced ? { duration: 0 } : t);
  const input = React.useRef<HTMLInputElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const depth = React.useRef(0);
  const [drag, setDrag] = React.useState<DragInfo | null>(null);
  const [ownError, setOwnError] = React.useState<string | null>(null);
  const error = forcedError ?? ownError;
  const x = useSpring(0, SPRING_MOUSE);
  const y = useSpring(0, SPRING_MOUSE);

  const types = acceptLabels(accept);
  const defaultHint =
    [
      maxSize !== undefined &&
        `Max ${formatBytes(maxSize)}${multiple ? " each" : ""}`,
      types.length > 0 && `only ${orList(types)}`,
    ]
      .filter(Boolean)
      .join(", ") || null;
  const hintText =
    hint ??
    (defaultHint && `${defaultHint[0].toUpperCase()}${defaultHint.slice(1)}.`);

  React.useEffect(() => {
    if (!blocked) setOwnError(null);
  }, [blocked]);

  const refuse = (message: string) => {
    setOwnError(message);
    if (!reduced && scope.current) {
      animate(
        scope.current,
        { x: [0, -6, 6, -3, 3, 0] },
        { duration: 0.4, ease: EASE_OUT },
      );
    }
  };

  const handle = (files: File[]) => {
    if (disabled || files.length === 0) return;
    const result = blocked
      ? {
          accepted: [],
          rejected: files.map((file) => ({
            file,
            reason: "too-many-files" as const,
            message: blocked,
          })),
        }
      : validateFiles(files, {
          accept,
          maxSize,
          maxFiles: multiple ? maxFiles : 1,
          validate,
        });
    const message = blocked ? `${blocked}.` : summarize(result.rejected);
    if (message) refuse(message);
    else setOwnError(null);
    if (name) setInputFiles(input.current, result.accepted);
    onFiles?.(result.accepted, result.rejected);
  };

  const open = () => {
    if (disabled) return;
    if (blocked) return refuse(`${blocked}.`);
    setOwnError(null);
    input.current?.click();
  };

  const place = (e: React.DragEvent, jump = false) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const py = e.clientY - box.top;
    if (jump) {
      x.jump(px);
      y.jump(py);
    } else {
      x.set(px);
      y.set(py);
    }
  };

  const hasFiles = (e: React.DragEvent) =>
    e.dataTransfer.types.includes("Files");

  const state = disabled
    ? "disabled"
    : drag
      ? "drag"
      : error
        ? "error"
        : "idle";

  return (
    <div
      ref={scope}
      {...rest}
      data-state={state}
      aria-disabled={disabled || undefined}
      onClick={(e) => {
        if (e.target !== input.current) open();
      }}
      onPaste={(e) => {
        onPaste?.(e);
        const files = Array.from(e.clipboardData.files);
        if (!files.length) return;
        e.preventDefault();
        handle(files);
      }}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        if (disabled) return;
        depth.current++;
        if (depth.current > 1) return;
        const items = Array.from(e.dataTransfer.items).filter(
          (i) => i.kind === "file",
        );
        place(e, true);
        setOwnError(null);
        setDrag({
          count: items.length,
          ext: extFromMime(items[0]?.type ?? ""),
        });
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = disabled ? "none" : "copy";
        if (!disabled) place(e);
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e) || disabled) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDrag(null);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDrag(null);
        handle(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-4 rounded-3xl border-2 p-4 transition-[background-color,border-color,box-shadow,opacity] duration-200 ease-out sm:gap-5 sm:p-5",
        "has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
        state === "idle" &&
          "border-dashed border-foreground/15 bg-muted/60 hover:border-foreground/30 hover:bg-muted",
        state === "drag" && "border-solid border-primary bg-primary/5",
        state === "error" &&
          "border-dashed border-destructive bg-destructive/5",
        state === "disabled" &&
          "cursor-not-allowed border-dashed border-foreground/10 bg-muted/60 opacity-50",
        className,
        classNames?.root,
      )}
    >
      <div
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-2xl transition-colors duration-200 ease-out",
          state === "error" ? "bg-destructive text-white" : "bg-background",
          state === "drag"
            ? "text-primary"
            : state === "idle"
              ? "text-foreground/70"
              : "",
          state === "disabled" && "text-muted-foreground",
          classNames?.icon,
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={state === "error" ? "error" : "upload"}
            {...pop}
            transition={move(SPRING_SWAP)}
            className="grid place-items-center"
          >
            {state === "error" ? (
              <IconAlertCircle variant="Bold" className="size-7" />
            ) : (
              <IconCloudUpload className="size-7" strokeWidth={2} />
            )}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[15px] font-semibold tracking-tight",
            state === "disabled" ? "text-muted-foreground" : "text-foreground",
            classNames?.label,
          )}
        >
          {label}{" "}
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="rounded-sm text-primary outline-none hover:underline hover:underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
          >
            {chooseLabel}
          </button>
        </p>
        <div className={cn("relative mt-1 text-sm", classNames?.hint)}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={state === "error" ? `e:${String(error)}` : "hint"}
              {...swap}
              transition={move(SPRING_SWAP)}
              role={state === "error" ? "alert" : undefined}
              className={cn(
                "text-xs",
                state === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {state === "error" ? error : hintText}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        hidden
        name={name}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.currentTarget.files ?? []);
          if (!name) e.currentTarget.value = "";
          handle(files);
        }}
      />

      <AnimatePresence>
        {drag && (
          <motion.div
            key="ghost"
            aria-hidden
            style={{ x, y }}
            className="pointer-events-none absolute top-0 left-0 z-10"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: -8 }}
              exit={{ opacity: 0, scale: 0.6, rotate: 0 }}
              transition={move(SPRING_PANEL)}
              className="relative -translate-x-10 -translate-y-11"
            >
              {drag.count > 1 && (
                <FileBadge
                  ext={drag.ext}
                  className="absolute inset-0 translate-x-2 rotate-12 opacity-60"
                />
              )}
              <FileBadge ext={drag.ext} className="relative shadow-lg" />
              <span className="absolute top-8 left-14 rounded-xl bg-foreground px-3 py-1.5 text-sm font-medium whitespace-nowrap text-background shadow-lg">
                {drag.count === 1 ? "1 file" : `${drag.count} files`}
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Uploader ─── */

export interface FileUploaderItem {
  id: string;
  file: File;
  status: FileUploadStatus;
  progress: number;
  error?: string;
  preview?: string;
}

export interface FileUploaderContext {
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}

export interface FileUploaderClassNames {
  root?: string;
  panel?: string;
  header?: string;
  dropzone?: string;
  list?: string;
  footer?: string;
}

export interface FileUploaderProps
  extends
    Omit<
      React.HTMLAttributes<HTMLDivElement>,
      "children" | "onChange" | "title" | "onSubmit"
    >,
    Pick<
      FileDropzoneProps,
      | "accept"
      | "maxSize"
      | "multiple"
      | "disabled"
      | "label"
      | "chooseLabel"
      | "hint"
    > {
  upload: (file: File, context: FileUploaderContext) => Promise<void>;
  maxFiles?: number;
  concurrency?: number;
  resumable?: boolean;
  name?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  onCancel?: () => void;
  onSubmit?: (files: File[]) => void;
  cancelLabel?: string;
  submitLabel?: string;
  onUploaded?: (file: File) => void;
  onDownload?: (file: File) => void;
  classNames?: FileUploaderClassNames;
}

let uid = 0;
const STAGGER = 0.08;
const STAGGER_CAP = 6;
const Dropzone = React.memo(FileDropzone);

interface RowActions {
  start: (item: FileUploaderItem) => void;
  stop: (id: string) => void;
  drop: (id: string) => void;
  patch: (id: string, next: Partial<FileUploaderItem>) => void;
  download: (file: File) => void;
}

const UploaderRow = React.memo(function UploaderRow({
  item,
  resumable,
  downloadable,
  actions,
}: {
  item: FileUploaderItem;
  resumable: boolean;
  downloadable: boolean;
  actions: RowActions;
}) {
  const { start, stop, drop, patch, download } = actions;
  return (
    <FileUpload
      name={item.file.name}
      size={item.file.size}
      progress={item.progress}
      status={item.status}
      error={item.error}
      preview={item.preview}
      onPause={
        resumable
          ? () => {
              stop(item.id);
              patch(item.id, { status: "paused" });
            }
          : undefined
      }
      onResume={
        item.status === "queued" || resumable ? () => start(item) : undefined
      }
      onRetry={() => {
        patch(item.id, { progress: 0 });
        start(item);
      }}
      onCancel={() => drop(item.id)}
      onRemove={() => drop(item.id)}
      onDownload={downloadable ? () => download(item.file) : undefined}
    />
  );
});

export function FileUploader({
  upload,
  accept,
  maxSize,
  maxFiles,
  multiple = true,
  disabled = false,
  concurrency = 2,
  resumable = false,
  name,
  label,
  chooseLabel,
  hint,
  title = "Upload Files",
  description = "Select the files you want to upload.",
  onClose,
  onCancel,
  onSubmit,
  cancelLabel = "Cancel",
  submitLabel = "Submit Files",
  onUploaded,
  onDownload,
  classNames,
  className,
  ...rest
}: FileUploaderProps) {
  const reduced = useReducedMotionPreference();
  const [items, setItems] = React.useState<FileUploaderItem[]>([]);
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  const controllers = React.useRef(new Map<string, AbortController>());
  const delays = React.useRef(new Map<string, number>());
  const formInput = React.useRef<HTMLInputElement>(null);
  const ids = React.useId().replace(/:/g, "");
  const titleId = `${ids}-title`;
  const latest = React.useRef({ upload, onUploaded, onDownload });
  latest.current = { upload, onUploaded, onDownload };

  const patch = React.useCallback(
    (id: string, next: Partial<FileUploaderItem>) =>
      setItems((list) =>
        list.map((i) => (i.id === id ? { ...i, ...next } : i)),
      ),
    [],
  );

  const start = React.useCallback(
    (item: FileUploaderItem) => {
      if (controllers.current.has(item.id)) return;
      const controller = new AbortController();
      controllers.current.set(item.id, controller);
      patch(item.id, { status: "uploading", error: undefined });
      const live = () => controllers.current.get(item.id) === controller;
      let frame = 0;
      let next = 0;
      latest.current
        .upload(item.file, {
          signal: controller.signal,
          onProgress: (f) => {
            next = Math.min(Math.max(f, 0), 1);
            if (frame) return;
            frame = requestAnimationFrame(() => {
              frame = 0;
              if (live()) patch(item.id, { progress: next });
            });
          },
        })
        .then(() => {
          if (!live()) return;
          controllers.current.delete(item.id);
          patch(item.id, { status: "completed", progress: 1 });
          latest.current.onUploaded?.(item.file);
        })
        .catch((err: unknown) => {
          if (!live()) return;
          controllers.current.delete(item.id);
          patch(item.id, {
            status: "error",
            error:
              err instanceof Error && err.message
                ? err.message
                : "Upload failed",
          });
        });
    },
    [patch],
  );

  const stop = React.useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
  }, []);

  const drop = React.useCallback(
    (id: string) => {
      stop(id);
      delays.current.delete(id);
      setItems((list) => {
        const gone = list.find((i) => i.id === id);
        if (gone?.preview) URL.revokeObjectURL(gone.preview);
        return list.filter((i) => i.id !== id);
      });
    },
    [stop],
  );

  const actions = React.useMemo<RowActions>(
    () => ({
      start,
      stop,
      drop,
      patch,
      download: (file) => latest.current.onDownload?.(file),
    }),
    [start, stop, drop, patch],
  );

  const onFiles = React.useCallback((accepted: File[]) => {
    if (!accepted.length) return;
    const added = accepted.map((file, n) => {
      const id = `f${++uid}`;
      delays.current.set(id, Math.min(n, STAGGER_CAP) * STAGGER);
      return {
        id,
        file,
        status: "queued" as const,
        progress: 0,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      };
    });
    itemsRef.current = [...itemsRef.current, ...added];
    setItems((list) => [...list, ...added]);
  }, []);

  const validate = React.useCallback<FileValidator>(
    (file, accepted) => {
      const same = (f: File) =>
        f.name === file.name &&
        f.size === file.size &&
        f.lastModified === file.lastModified;
      const list = itemsRef.current;
      if (list.some((i) => same(i.file)) || accepted.some(same))
        return "Already in the list";
      if (maxFiles === undefined) return;
      const room = maxFiles - list.length;
      if (accepted.length < room) return;
      return `Only ${room} more ${room === 1 ? "file" : "files"} can be added`;
    },
    [maxFiles],
  );

  const clear = () => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    delays.current.clear();
    setItems((list) => {
      list.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
      return [];
    });
  };

  React.useEffect(() => {
    const running = items.filter((i) => i.status === "uploading").length;
    items
      .filter((i) => i.status === "queued")
      .slice(0, Math.max(0, concurrency - running))
      .forEach(start);
  }, [items, concurrency, start]);

  const fileKey = items.map((i) => i.id).join();
  React.useEffect(() => {
    if (name)
      setInputFiles(
        formInput.current,
        itemsRef.current.map((i) => i.file),
      );
  }, [fileKey, name]);

  React.useEffect(() => {
    const running = controllers.current;
    return () => {
      running.forEach((c) => c.abort());
      running.clear();
      itemsRef.current.forEach(
        (i) => i.preview && URL.revokeObjectURL(i.preview),
      );
    };
  }, []);

  const full =
    maxFiles !== undefined && items.length >= maxFiles
      ? `${maxFiles} ${maxFiles === 1 ? "file" : "files"}`
      : undefined;
  const completed = items.filter((i) => i.status === "completed");
  const busy = items.some(
    (i) => i.status === "uploading" || i.status === "queued",
  );
  const ready = completed.length > 0 && !busy;
  const press = reduced ? undefined : { scale: 0.97 };

  return (
    <div
      {...rest}
      role="group"
      aria-labelledby={title ? titleId : undefined}
      className={cn(
        "relative w-full rounded-[28px] bg-muted p-1.5 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.25)] ring-1 ring-border",
        className,
        classNames?.root,
      )}
    >
      <div
        className={cn(
          "rounded-3xl bg-card text-card-foreground ring-1 ring-border",
          classNames?.panel,
        )}
      >
        {(title || onClose) && (
          <div
            className={cn(
              "flex items-start gap-3 border-b border-border p-4",
              classNames?.header,
            )}
          >
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-background shadow-[inset_0_-2px_0_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-border">
              <IconUploadMinimalistic className="size-5" strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              {title && (
                <h2
                  id={titleId}
                  className="text-[15px] font-semibold tracking-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {onClose && (
              <motion.button
                type="button"
                onClick={onClose}
                aria-label="Close"
                whileTap={press}
                transition={SPRING_PRESS}
                className="grid size-8 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <IconClose className="size-4.5" strokeWidth={2} />
              </motion.button>
            )}
          </div>
        )}

        <div className="relative flex flex-col gap-3 p-4">
          <div>
            <Dropzone
              accept={accept}
              maxSize={maxSize}
              multiple={multiple}
              validate={validate}
              blocked={
                full &&
                `You can add up to ${full}. Remove one to add another`
              }
              disabled={disabled}
              label={label}
              chooseLabel={chooseLabel}
              hint={full ? `${maxFiles} of ${full} added.` : hint}
              className={classNames?.dropzone}
              onFiles={onFiles}
            />
          </div>
          {name && (
            <input ref={formInput} type="file" name={name} multiple hidden />
          )}
          <ul className={cn("-mb-3 flex flex-col", classNames?.list)}>
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const delay = delays.current.get(item.id) ?? 0;
                return (
                  <motion.li
                    key={item.id}
                    initial={
                      reduced
                        ? false
                        : {
                            height: 0,
                            opacity: 0,
                            scale: 0.98,
                            filter: "blur(4px)",
                          }
                    }
                    animate={{
                      height: "auto",
                      opacity: 1,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      height: 0,
                      opacity: 0,
                      scale: 0.98,
                      filter: "blur(4px)",
                      transition: reduced
                        ? { duration: 0 }
                        : {
                            ...SPRING_LAYOUT,
                            opacity: { duration: 0.15, ease: EASE_OUT },
                            filter: { duration: 0.15, ease: EASE_OUT },
                          },
                    }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : {
                            ...SPRING_LAYOUT,
                            delay,
                            opacity: { duration: 0.2, ease: EASE_OUT, delay },
                            filter: { duration: 0.2, ease: EASE_OUT, delay },
                          }
                    }
                  >
                    <div className="pb-3">
                      <UploaderRow
                        item={item}
                        resumable={resumable}
                        downloadable={!!onDownload}
                        actions={actions}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      </div>

      {(onCancel || onSubmit) && (
        <div className={cn("flex gap-2 pt-1.5", classNames?.footer)}>
          {onCancel && (
            <motion.button
              type="button"
              whileTap={press}
              transition={SPRING_PRESS}
              onClick={() => {
                clear();
                onCancel();
              }}
              className="h-11 flex-1 rounded-3xl bg-foreground/6 text-sm font-semibold text-foreground outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              {cancelLabel}
            </motion.button>
          )}
          {onSubmit && (
            <motion.button
              type="button"
              disabled={!ready}
              whileTap={ready ? press : undefined}
              transition={SPRING_PRESS}
              onClick={() => onSubmit(completed.map((i) => i.file))}
              className="h-11 flex-1 rounded-3xl bg-primary text-sm font-semibold text-primary-foreground outline-none transition-opacity duration-200 ease-out hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitLabel}
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}
