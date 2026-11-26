"use client";

/**
 * Vorbereitete Erweiterungsstelle für künftige Social-Login-Anbieter (Google, Apple, etc.).
 * Bleibt aktuell deaktiviert, bis NEXT_PUBLIC_AUTH_SOCIAL_ENABLED="true" und die
 * Provider-Credentials in src/infrastructure/auth/auth.ts aktiviert werden.
 */
export function SocialAuthPlaceholder() {
  if (process.env.NEXT_PUBLIC_AUTH_SOCIAL_ENABLED !== "true") {
    return null;
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Oder weiter mit</span>
        </div>
      </div>
    </div>
  );
}
