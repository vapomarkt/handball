import { z } from "zod";

export const PushPlatformSchema = z.enum(["IOS", "ANDROID"]);
export type PushPlatform = z.infer<typeof PushPlatformSchema>;

export const ExpoPushTokenSchema = z
  .string()
  .trim()
  .regex(
    /^ExponentPushToken\[[A-Za-z0-9\-_]+\]$|^ExpoPushToken\[[A-Za-z0-9\-_]+\]$/,
    "Ungültiges Expo-Push-Token-Format."
  );

export const RegisterPushTokenSchema = z.object({
  expoPushToken: ExpoPushTokenSchema,
  platform: PushPlatformSchema,
  deviceName: z.string().trim().min(1).max(120).optional().nullable(),
  appVersion: z.string().trim().min(1).max(40).optional().nullable(),
});
export type RegisterPushTokenInput = z.infer<typeof RegisterPushTokenSchema>;

export const UnregisterPushTokenSchema = z.object({
  expoPushToken: ExpoPushTokenSchema,
});
export type UnregisterPushTokenInput = z.infer<
  typeof UnregisterPushTokenSchema
>;

export type PushNotificationKind =
  | "EVENT_CANCELLED"
  | "EVENT_UPDATED"
  | "RSVP_REMINDER"
  | "ANNOUNCEMENT_CREATED"
  | "POLL_CREATED"
  | "DUTY_REMINDER";

export interface PushNotificationData {
  kind: PushNotificationKind;
  url: string;
  teamId?: string;
  eventId?: string;
  announcementId?: string;
  pollId?: string;
  dutyId?: string;
}
