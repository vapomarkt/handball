export const BRANDING = {
  appName: "ThrowOff",
  shortName: "ThrowOff",
  domain: "throwoff.app",
  url: "https://throwoff.app",
  tagline: "Die Plattform für Handball-Teams & Vereine",
  description:
    "Team- & Vereinsorganisation, Kaderverwaltung, Training, Taktik und Hallendienste in einer Plattform für aktive Handballer, Trainer und Eltern.",
  locale: "de-DE",
  colors: {
    primaryHex: "#D95D24", // Handball-Harz / Hallenboden-Terracotta
    secondaryHex: "#0F2942", // Hallen-Navy
    accentHex: "#0D9488", // Spielfeld-Teal
  },
  supportEmail: "hello@throwoff.app",
} as const;

export type BrandingConfig = typeof BRANDING;
