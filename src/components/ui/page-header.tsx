import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Kompakter, maximal zweizeiliger Seitenkopf nach docs/DESIGN_PRINCIPLES.md.
 * Actions-Slot darf max. 2 sichtbare Elemente enthalten (1x Primary + optional 1x Secondary/Overflow).
 */
export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {leading}
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl truncate">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-0.5 text-sm text-muted-foreground break-words">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
