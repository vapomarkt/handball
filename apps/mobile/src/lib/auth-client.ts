import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_URL, APP_SCHEME } from "./config";

/**
 * Better Auth client for iOS & Android.
 * The session cookie is persisted in the iOS Keychain / Android Keystore via expo-secure-store.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: "throwoff",
      storage: SecureStore,
    }),
  ],
});

/** Headers that authenticate requests against /api/v1/* (same session as the web app). */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const cookie = await authClient.getCookie();
  return cookie ? { Cookie: cookie } : {};
}
