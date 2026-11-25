import Image from "next/image";
import { BRANDING } from "@/config/branding";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}

export function BrandLogo({
  className,
  showWordmark = true,
  size = "md",
}: BrandLogoProps) {
  const iconSize =
    size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const pxSize = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  const textSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/70 shadow-sm",
          iconSize
        )}
      >
        <Image
          src="/brand/icon-master-light-1024x1024.png"
          alt={showWordmark ? "" : BRANDING.appName}
          width={pxSize}
          height={pxSize}
          priority
          className="h-full w-full object-cover dark:hidden"
        />
        <Image
          src="/brand/icon-master-dark-1024x1024.png"
          alt={showWordmark ? "" : BRANDING.appName}
          width={pxSize}
          height={pxSize}
          priority
          className="hidden h-full w-full object-cover dark:block"
        />
      </span>
      {showWordmark && (
        <span
          className={cn(
            "font-bold tracking-tight text-foreground",
            textSize
          )}
        >
          {BRANDING.appName}
        </span>
      )}
    </div>
  );
}
