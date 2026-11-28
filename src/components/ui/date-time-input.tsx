"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  isoDateToGermanDate,
  parseGermanDateToIso,
  parseGermanTimeTo24h,
  toLocalIsoDate,
} from "@/domain/date-time";
import { cn } from "@/lib/utils";

const GERMAN_MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

const GERMAN_WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

const HOURS_24 = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0")
);
const MINUTES_STEP_5 = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0")
);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseIsoParts(iso: string): { year: number; month: number; day: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  };
}

function buildCalendarCells(year: number, monthIndex: number): Array<number | null> {
  const firstDayOfWeek = new Date(year, monthIndex, 1).getDay();
  // Montag = 0, ..., Sonntag = 6
  const leadingEmpty = (firstDayOfWeek + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < leadingEmpty; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export interface GermanDateInputProps {
  id?: string;
  value: string; // ISO YYYY-MM-DD oder ""
  onChange: (isoDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Einheitliches deutsches Datumsfeld (`TT.MM.JJJJ`) mit deutschem Kalender-Picker.
 * Unabhängig von Browser-/OS-Spracheinstellungen (zeigt niemals MM/DD/YYYY).
 * Gibt intern und nach außen normalisiertes ISO-Datum (`YYYY-MM-DD`) weiter.
 */
export function GermanDateInput({
  id,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "TT.MM.JJJJ",
  className,
  "aria-label": ariaLabel,
}: GermanDateInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const selectedParts = parseIsoParts(value);
  const todayIso = toLocalIsoDate();
  const todayParts = parseIsoParts(todayIso)!;

  const [viewYear, setViewYear] = React.useState<number>(
    selectedParts?.year ?? todayParts.year
  );
  const [viewMonth, setViewMonth] = React.useState<number>(
    (selectedParts?.month ?? todayParts.month) - 1
  );

  const displayValue = draft !== null ? draft : isoDateToGermanDate(value);
  const isInvalidDraft =
    draft !== null && draft.trim() !== "" && parseGermanDateToIso(draft) === null;

  function syncValidity(text: string) {
    const el = inputRef.current;
    if (!el) return;
    const trimmed = text.trim();
    if (!trimmed) {
      el.setCustomValidity("");
      return;
    }
    if (parseGermanDateToIso(trimmed) === null) {
      el.setCustomValidity("Bitte Datum im Format TT.MM.JJJJ eingeben.");
    } else {
      el.setCustomValidity("");
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setDraft(next);
    syncValidity(next);

    const trimmed = next.trim();
    if (!trimmed) {
      onChange("");
      return;
    }

    // Nur bei vollständiger Eingabe (z. B. TT.MM.JJJJ oder TTMMJJJJ) live übernehmen
    if (
      /^\d{2}\.\d{2}\.\d{4}$/.test(trimmed) ||
      /^\d{8}$/.test(trimmed) ||
      /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ) {
      const parsed = parseGermanDateToIso(trimmed);
      if (parsed) {
        onChange(parsed);
      }
    }
  }

  function handleBlur() {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      onChange("");
      setDraft(null);
      syncValidity("");
      return;
    }
    const parsed = parseGermanDateToIso(trimmed);
    if (parsed) {
      onChange(parsed);
      setDraft(null);
      syncValidity("");
    } else {
      syncValidity(trimmed);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      const base = parseIsoParts(value) ?? todayParts;
      setViewYear(base.year);
      setViewMonth(base.month - 1);
    }
    setOpen(nextOpen);
  }

  function selectDay(day: number) {
    const iso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
    onChange(iso);
    setDraft(null);
    if (inputRef.current) inputRef.current.setCustomValidity("");
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const cells = buildCalendarCells(viewYear, viewMonth);

  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        lang="de"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={isInvalidDraft || undefined}
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        className={cn(
          "flex h-11 w-full min-w-0 max-w-full rounded-lg border bg-background pl-3.5 pr-10 py-2 text-sm tabular-nums text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isInvalidDraft ? "border-destructive" : "border-border"
        )}
      />
      <DropdownMenuPrimitive.Root
        open={open}
        onOpenChange={handleOpenChange}
        modal={false}
      >
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Kalender öffnen"
            title="Datum auswählen (TT.MM.JJJJ)"
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="start"
            sideOffset={6}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="z-[60] w-[276px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Vorheriger Monat"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {GERMAN_MONTHS[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Nächster Monat"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground">
              {GERMAN_WEEKDAYS.map((wd) => (
                <span key={wd} className="py-1">
                  {wd}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((day, idx) => {
                if (day === null) {
                  return <span key={`empty-${idx}`} className="h-8" />;
                }
                const cellIso = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
                const isSelected = cellIso === value;
                const isToday = cellIso === todayIso;
                return (
                  <button
                    key={cellIso}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      "h-8 w-full rounded-lg text-xs tabular-nums transition-colors cursor-pointer",
                      isSelected
                        ? "bg-primary/15 font-bold text-primary ring-1 ring-primary/40"
                        : isToday
                          ? "border border-border font-semibold text-foreground hover:bg-muted"
                          : "text-foreground hover:bg-muted"
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2">
              <button
                type="button"
                onClick={() => {
                  onChange(todayIso);
                  setDraft(null);
                  if (inputRef.current) inputRef.current.setCustomValidity("");
                  setOpen(false);
                }}
                className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
              >
                Heute ({isoDateToGermanDate(todayIso)})
              </button>
              {!required && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setDraft(null);
                    if (inputRef.current) inputRef.current.setCustomValidity("");
                    setOpen(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  Leeren
                </button>
              )}
            </div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </div>
  );
}

export interface GermanTimeInputProps {
  id?: string;
  value: string; // 24h HH:MM oder ""
  onChange: (time24h: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Einheitliches deutsches 24-Stunden-Zeitfeld (`HH:MM`, 00:00–23:59) mit
 * kompaktem 24h-Auswahlraster. Zeigt niemals 12h AM/PM.
 */
export function GermanTimeInput({
  id,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = "HH:MM",
  className,
  "aria-label": ariaLabel,
}: GermanTimeInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const normalizedValue = parseGermanTimeTo24h(value) ?? "";
  const [selectedHour, selectedMinute] = normalizedValue
    ? normalizedValue.split(":")
    : ["", ""];

  const displayValue = draft !== null ? draft : normalizedValue;
  const isInvalidDraft =
    draft !== null && draft.trim() !== "" && parseGermanTimeTo24h(draft) === null;

  function syncValidity(text: string) {
    const el = inputRef.current;
    if (!el) return;
    const trimmed = text.trim();
    if (!trimmed) {
      el.setCustomValidity("");
      return;
    }
    if (parseGermanTimeTo24h(trimmed) === null) {
      el.setCustomValidity("Bitte Uhrzeit im 24-Stunden-Format HH:MM eingeben.");
    } else {
      el.setCustomValidity("");
    }
  }

  function handleTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setDraft(next);
    syncValidity(next);

    const trimmed = next.trim();
    if (!trimmed) {
      onChange("");
      return;
    }

    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      const parsed = parseGermanTimeTo24h(trimmed);
      if (parsed) {
        onChange(parsed);
      }
    }
  }

  function handleBlur() {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (!trimmed) {
      onChange("");
      setDraft(null);
      syncValidity("");
      return;
    }
    const parsed = parseGermanTimeTo24h(trimmed);
    if (parsed) {
      onChange(parsed);
      setDraft(null);
      syncValidity("");
    } else {
      syncValidity(trimmed);
    }
  }

  function pickHour(hour: string) {
    const minute = selectedMinute || "00";
    onChange(`${hour}:${minute}`);
    setDraft(null);
    if (inputRef.current) inputRef.current.setCustomValidity("");
  }

  function pickMinute(minute: string) {
    const hour = selectedHour || "18";
    onChange(`${hour}:${minute}`);
    setDraft(null);
    if (inputRef.current) inputRef.current.setCustomValidity("");
    setOpen(false);
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        lang="de"
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={isInvalidDraft || undefined}
        value={displayValue}
        onChange={handleTextChange}
        onBlur={handleBlur}
        className={cn(
          "flex h-11 w-full min-w-0 max-w-full rounded-lg border bg-background pl-3.5 pr-10 py-2 text-sm tabular-nums text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isInvalidDraft ? "border-destructive" : "border-border"
        )}
      />
      <DropdownMenuPrimitive.Root
        open={open}
        onOpenChange={setOpen}
        modal={false}
      >
        <DropdownMenuPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Uhrzeit auswählen (24h)"
            title="Uhrzeit im 24h-Format auswählen (HH:MM)"
            className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            <Clock className="h-4 w-4" />
          </button>
        </DropdownMenuPrimitive.Trigger>
        <DropdownMenuPrimitive.Portal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={6}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="z-[60] w-[264px] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-xl space-y-2.5"
          >
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Stunde (24h)
              </p>
              <div className="grid grid-cols-6 gap-1">
                {HOURS_24.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pickHour(h)}
                    className={cn(
                      "h-8 rounded-md text-xs tabular-nums transition-colors cursor-pointer",
                      selectedHour === h
                        ? "bg-primary/15 font-bold text-primary ring-1 ring-primary/40"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 border-t border-border pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Minute
              </p>
              <div className="grid grid-cols-6 gap-1">
                {MINUTES_STEP_5.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMinute(m)}
                    className={cn(
                      "h-8 rounded-md text-xs tabular-nums transition-colors cursor-pointer",
                      selectedMinute === m
                        ? "bg-primary/15 font-bold text-primary ring-1 ring-primary/40"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    :{m}
                  </button>
                ))}
              </div>
            </div>

            {!required && normalizedValue && (
              <div className="flex justify-end border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setDraft(null);
                    if (inputRef.current) inputRef.current.setCustomValidity("");
                    setOpen(false);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  Leeren
                </button>
              </div>
            )}
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      </DropdownMenuPrimitive.Root>
    </div>
  );
}
