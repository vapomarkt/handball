import { describe, expect, it, vi } from "vitest";
import {
  MEMBER_ROLE_LABELS,
  RegisterPushTokenSchema,
  ThrowOffApiError,
  createThrowOffApiClient,
  formatShortCode,
  normalizeInviteLookup,
} from "@throwoff/shared";
import {
  ExpoPushService,
  chunkArray,
} from "@/infrastructure/push/expo-push-service";

describe("@throwoff/shared Push-Token-Validierung & API-Client", () => {
  it("re-exportiert Rollenlabels inkl. Betreuer sowie Einladungs-Kurzcode-Helfer", () => {
    expect(MEMBER_ROLE_LABELS.TEAM_MANAGER).toBe("Betreuer");
    expect(normalizeInviteLookup("h7k-4p9")).toBe("H7K4P9");
    expect(formatShortCode("H7K4P9")).toBe("H7K-4P9");
  });

  it("akzeptiert gültige Expo-Push-Tokens und lehnt ungültige Strings ab", () => {
    const valid = RegisterPushTokenSchema.safeParse({
      expoPushToken: "ExponentPushToken[abc123_XYZ-99]",
      platform: "IOS",
      deviceName: "iPhone 16",
      appVersion: "0.1.0",
    });
    expect(valid.success).toBe(true);

    const invalid = RegisterPushTokenSchema.safeParse({
      expoPushToken: "not-a-valid-token",
      platform: "ANDROID",
    });
    expect(invalid.success).toBe(false);
  });

  it("sendet Auth-Header und X-App-Version und parst API-Fehler sauber", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "UNAUTHORIZED",
            message: "Bitte melde dich an.",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    );

    const client = createThrowOffApiClient({
      baseUrl: "https://throwoff.app/",
      appVersion: "1.0.0",
      getAuthHeaders: () => ({ Authorization: "Bearer test-token" }),
      fetchImpl: fetchMock,
    });

    await expect(client.getMe()).rejects.toMatchObject({
      name: "ThrowOffApiError",
      code: "UNAUTHORIZED",
      httpStatus: 401,
    } satisfies Partial<ThrowOffApiError>);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://throwoff.app/api/v1/me");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(headers["X-App-Version"]).toBe("1.0.0");
  });
});

describe("ExpoPushService", () => {
  it("teilt große Empfängerlisten in 100er-Chunks auf", () => {
    const items = Array.from({ length: 205 }, (_, i) => i);
    const chunks = chunkArray(items, 100);
    expect(chunks.map((c) => c.length)).toEqual([100, 100, 5]);
  });

  it("deaktiviert automatisch Tokens mit DeviceNotRegistered", async () => {
    const disabled: string[] = [];
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            { status: "ok", id: "ticket-1" },
            {
              status: "error",
              message: "Device not registered",
              details: { error: "DeviceNotRegistered" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const service = new ExpoPushService({
      store: {
        async findActiveTokensByUserIds() {
          return [
            "ExponentPushToken[valid_1]",
            "ExponentPushToken[stale_2]",
          ];
        },
        async disableTokens(tokens) {
          disabled.push(...tokens);
        },
      },
      fetchImpl: fetchMock,
    });

    const result = await service.sendToUsers({
      userIds: ["user-1", "user-2"],
      title: "Spielabsage",
      body: "Das Spiel am Samstag fällt aus.",
      data: {
        kind: "EVENT_CANCELLED",
        url: "throwoff://termine/evt-1",
        eventId: "evt-1",
      },
    });

    expect(result.attempted).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.invalidTokens).toEqual(["ExponentPushToken[stale_2]"]);
    expect(disabled).toEqual(["ExponentPushToken[stale_2]"]);
  });
});
