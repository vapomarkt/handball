import { createThrowOffApiClient } from "@throwoff/shared";
import { getAuthHeaders } from "./auth-client";
import { API_URL, APP_VERSION } from "./config";

/** Typed ThrowOff API client shared with the web app (@throwoff/shared). */
export const api = createThrowOffApiClient({
  baseUrl: API_URL,
  appVersion: APP_VERSION,
  getAuthHeaders,
});
