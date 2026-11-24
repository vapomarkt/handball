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
  const textSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm",
          iconSize
        )}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          className="h-[68%] w-[68%]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Handball-Kreis & 6m-Wurfkreis-Anspielung */}
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="M8.5 10.5C12.5 13 19.5 13 23.5 10.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M8.5 21.5C12.5 19 19.5 19 23.5 21.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M16 4V28"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
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
