import Constants from "expo-constants";

const FALLBACK_API_URL = "https://throwoff.app";

/** Backend base URL (set via EXPO_PUBLIC_API_URL in .env or eas.json). */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL
).replace(/\/+$/, "");

export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";

export const APP_SCHEME = "throwoff";
