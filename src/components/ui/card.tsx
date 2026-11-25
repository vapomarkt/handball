import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Stretched-Link / Card-Overlay Trigger:
 * Auf den semantischen <button> oder <Link> im Kachel-Titel anwenden,
 * damit die gesamte Card (mit `interactive`) barrierefrei klickbar ist.
 */
export const CARD_OVERLAY_TRIGGER_CLASS =
  "text-left cursor-pointer focus:outline-none after:content-[''] after:absolute after:inset-0 after:rounded-xl";

/**
 * Hebt eingebettete interaktive Elemente (RSVP, Löschen, externe Links)
 * oder selektierbare Datenblöcke über den Card-Overlay-Trigger.
 */
export const CARD_ACTION_LAYER_CLASS = "relative z-10";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-xs",
        interactive &&
          "group relative transition-all duration-150 hover:border-primary/50 hover:shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/40 active:scale-[0.997]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-lg font-bold tracking-tight leading-snug", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";
