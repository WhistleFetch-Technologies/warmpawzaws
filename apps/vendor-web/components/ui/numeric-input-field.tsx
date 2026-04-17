"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "./utils";

function parseIncoming(
  value: React.ComponentProps<"input">["value"],
  allowDecimals: boolean
): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const s = String(value).trim();
  if (s === "" || s === "-" || s === ".") return 0;
  const n = allowDecimals ? parseFloat(s) : parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min?: number, max?: number): number {
  let x = n;
  if (min !== undefined && Number.isFinite(min)) x = Math.max(min, x);
  if (max !== undefined && Number.isFinite(max)) x = Math.min(max, x);
  return x;
}

function filterNumericText(
  raw: string,
  allowDecimals: boolean,
  allowNegative: boolean
): string {
  let s = raw;
  if (allowNegative) {
    const neg = s.startsWith("-");
    s = s.replace(/-/g, "");
    if (neg) s = "-" + s;
  } else {
    s = s.replace(/-/g, "");
  }
  if (!allowDecimals) return s.replace(/\D/g, "");
  const cleaned = s.replace(/[^0-9.-]/g, "");
  const sign = cleaned.startsWith("-") ? "-" : "";
  const body = sign ? cleaned.slice(1) : cleaned;
  const firstDot = body.indexOf(".");
  if (firstDot === -1) return sign + body.replace(/\./g, "");
  return (
    sign +
    body.slice(0, firstDot + 1) +
    body.slice(firstDot + 1).replace(/\./g, "")
  );
}

function emitChange(
  onChange: React.ChangeEventHandler<HTMLInputElement> | undefined,
  value: string
) {
  if (!onChange) return;
  const el = { value } as HTMLInputElement;
  onChange({
    target: el,
    currentTarget: el,
  } as React.ChangeEvent<HTMLInputElement>);
}

export const NumericInputField = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<"input">, "type" | "size">
>(function NumericInputField(
  {
    className,
    value,
    onChange,
    onBlur,
    onFocus,
    min: minProp,
    max: maxProp,
    step: stepProp,
    disabled,
    readOnly,
    placeholder,
    id,
    name,
    required,
    autoComplete,
    autoFocus,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    "aria-label": ariaLabel,
    ...rest
  },
  ref
) {
  const min =
    minProp === undefined || minProp === ""
      ? 0
      : Number(minProp);
  const max =
    maxProp === undefined || maxProp === ""
      ? undefined
      : Number(maxProp);
  const stepRaw = stepProp === undefined || stepProp === "" ? 1 : Number(stepProp);
  const step = Number.isFinite(stepRaw) && stepRaw !== 0 ? stepRaw : 1;
  const allowDecimals = !Number.isInteger(step);
  const allowNegative = Number.isFinite(min) && min < 0;
  const treatZeroAsEmpty = !allowNegative && min >= 0;
  const showStepButtons =
    !readOnly &&
    !disabled &&
    (allowDecimals ? Math.abs(step) >= 1 : true);

  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState<string | null>(null);

  const committed = parseIncoming(value, allowDecimals);

  React.useEffect(() => {
    if (!focused) setDraft(null);
  }, [value, focused]);

  const display =
    draft !== null
      ? draft
      : treatZeroAsEmpty && committed === 0
        ? ""
        : allowDecimals
          ? String(committed)
          : String(Math.trunc(committed));

  const effectivePlaceholder =
    placeholder !== undefined && placeholder !== ""
      ? placeholder
      : "0";

  const inputMode = allowDecimals ? ("decimal" as const) : ("numeric" as const);

  const applyCommitted = (n: number) => {
    const c = clamp(n, min, max);
    emitChange(onChange, allowDecimals ? String(c) : String(Math.trunc(c)));
  };

  const bump = (delta: number) => {
    const base =
      draft !== null && draft !== "" && draft !== "-" && draft !== "."
        ? parseIncoming(draft, allowDecimals)
        : committed;
    const next = clamp(base + delta, min, max);
    setDraft(null);
    applyCommitted(next);
  };

  const innerInput = (
    <input
      {...rest}
      ref={ref}
      id={id}
      name={name}
      type="text"
      inputMode={inputMode}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      aria-label={ariaLabel}
      value={display}
      placeholder={effectivePlaceholder}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 flex h-9 min-w-0 flex-1 border-0 bg-transparent px-3 py-0 text-base outline-none md:text-sm",
        "[appearance:textfield] [&::-webkit-search-cancel-button]:appearance-none",
        disabled && "cursor-not-allowed opacity-50",
        readOnly && "cursor-default",
      )}
      onFocus={(e) => {
        setFocused(true);
        if (treatZeroAsEmpty && committed === 0) setDraft("");
        else
          setDraft(
            allowDecimals ? String(committed) : String(Math.trunc(committed)),
          );
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = filterNumericText(
          e.target.value,
          allowDecimals,
          allowNegative,
        );
        setDraft(next);
        if (next === "" || next === "-" || next === ".") {
          emitChange(onChange, "");
          return;
        }
        const n = allowDecimals ? parseFloat(next) : parseInt(next, 10);
        if (!Number.isFinite(n)) return;
        emitChange(onChange, allowDecimals ? String(n) : String(Math.trunc(n)));
      }}
      onBlur={(e) => {
        setFocused(false);
        setDraft(null);
        const raw = e.target.value.trim();
        if (raw === "" || raw === "-" || raw === ".") {
          applyCommitted(clamp(0, min, max));
          onBlur?.(e);
          return;
        }
        const n = allowDecimals ? parseFloat(raw) : parseInt(raw, 10);
        const c = clamp(Number.isFinite(n) ? n : min, min, max);
        applyCommitted(c);
        onBlur?.(e);
      }}
    />
  );

  const shell = (child: React.ReactNode, row?: boolean) => (
    <div
      data-slot="input"
      className={cn(
        "border-input flex h-9 w-full min-w-0 rounded-md border bg-input-background px-0 transition-[color,box-shadow] outline-none",
        row && "items-stretch",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
    >
      {child}
    </div>
  );

  if (!showStepButtons) {
    return shell(innerInput, false);
  }

  return shell(
    <>
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || readOnly || committed <= min}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-l-md border-r border-input bg-muted/40 text-muted-foreground hover:bg-muted/70",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
        aria-label="Decrease value"
        onClick={() => bump(-step)}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      {innerInput}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || readOnly || (max !== undefined && committed >= max)}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-r-md border-l border-input bg-muted/40 text-muted-foreground hover:bg-muted/70",
          "disabled:pointer-events-none disabled:opacity-40",
        )}
        aria-label="Increase value"
        onClick={() => bump(step)}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </>,
    true,
  );
});

NumericInputField.displayName = "NumericInputField";
