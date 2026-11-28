"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FilterChipOption<T extends string> {
  value: T;
  label: string;
}

export interface FilterChipsProps<T extends string> {
  options: ReadonlyArray<FilterChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Einzeilige, horizontal scrollbare Filter-Leiste ohne mehrzeiligen Button-Umbruch.
 * Nutzt ruhigen Sekundär-Kontrast statt grellem bg-primary.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: FilterChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap",
              active
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
