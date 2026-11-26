import type { PushPlatform } from "@throwoff/shared";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";
import { api } from "./api";
import { APP_VERSION } from "./config";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

/**
 * Fragt (erst nach dem Login) die Push-Berechtigung an und registriert das
 * Expo-Push-Token beim ThrowOff-Backend. Gibt das Token zurück oder null.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Simulatoren/Emulatoren erhalten keine echten Push-Tokens.
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "ThrowOff",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn(
      "[push] Keine EAS projectId konfiguriert – `eas init` ausführen, um Push zu aktivieren."
    );
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  const platform: PushPlatform = Platform.OS === "ios" ? "IOS" : "ANDROID";
  await api.registerPushToken({
    expoPushToken: token,
    platform,
    deviceName: Device.deviceName ?? null,
    appVersion: APP_VERSION,
  });

  registeredToken = token;
  return token;
}

/** Deaktiviert das Push-Token dieses Geräts (z. B. beim Logout). */
export async function unregisterPushNotifications(): Promise<void> {
  if (!registeredToken) return;
  try {
    await api.unregisterPushToken({ expoPushToken: registeredToken });
  } finally {
    registeredToken = null;
  }
}

/** Öffnet beim Antippen einer Push-Nachricht den passenden Screen (data.url = throwoff://...). */
export function subscribeToNotificationTaps(): () => void {
  const open = (response: Notifications.NotificationResponse | null) => {
    const url = response?.notification.request.content.data?.url;
    if (typeof url === "string" && url.startsWith("throwoff://")) {
      const path = url.replace("throwoff://", "/");
      router.push(path as never);
    }
  };

  const last = Notifications.getLastNotificationResponse();
  if (last) open(last);

  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
