import type { PushNotificationData } from "@throwoff/shared";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: PushNotificationData;
  sound?: "default" | null;
  channelId?: string;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?:
      | "DeviceNotRegistered"
      | "InvalidCredentials"
      | "MessageTooBig"
      | "MessageRateExceeded";
  };
}

export interface ExpoPushDeliveryResult {
  attempted: number;
  sent: number;
  invalidTokens: string[];
  errors: string[];
}

export interface PushDeviceStore {
  findActiveTokensByUserIds(userIds: string[]): Promise<string[]>;
  disableTokens(tokens: string[]): Promise<void>;
}

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const MAX_EXPO_CHUNK_SIZE = 100;

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class ExpoPushService {
  private readonly store: PushDeviceStore;
  private readonly fetchImpl: typeof fetch;
  private readonly accessToken?: string;

  constructor(options: {
    store: PushDeviceStore;
    fetchImpl?: typeof fetch;
    accessToken?: string;
  }) {
    this.store = options.store;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.accessToken = options.accessToken ?? process.env.EXPO_ACCESS_TOKEN;
  }

  async sendToUsers(params: {
    userIds: string[];
    title: string;
    body: string;
    data?: PushNotificationData;
    channelId?: string;
  }): Promise<ExpoPushDeliveryResult> {
    const uniqueUserIds = Array.from(new Set(params.userIds.filter(Boolean)));
    if (uniqueUserIds.length === 0) {
      return { attempted: 0, sent: 0, invalidTokens: [], errors: [] };
    }

    const tokens = Array.from(
      new Set(await this.store.findActiveTokensByUserIds(uniqueUserIds))
    );
    if (tokens.length === 0) {
      return { attempted: 0, sent: 0, invalidTokens: [], errors: [] };
    }

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      title: params.title,
      body: params.body,
      sound: "default",
      channelId: params.channelId ?? "default",
      ...(params.data ? { data: params.data } : {}),
    }));

    return this.sendMessages(messages);
  }

  async sendMessages(
    messages: ExpoPushMessage[]
  ): Promise<ExpoPushDeliveryResult> {
    if (messages.length === 0) {
      return { attempted: 0, sent: 0, invalidTokens: [], errors: [] };
    }

    const chunks = chunkArray(messages, MAX_EXPO_CHUNK_SIZE);
    let sent = 0;
    const invalidTokens: string[] = [];
    const errors: string[] = [];

    for (const chunk of chunks) {
      try {
        const headers: Record<string, string> = {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        };
        if (this.accessToken) {
          headers.Authorization = `Bearer ${this.accessToken}`;
        }

        const response = await this.fetchImpl(EXPO_PUSH_API_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          errors.push(`Expo Push HTTP ${response.status}`);
          continue;
        }

        const json = (await response.json()) as { data?: ExpoPushTicket[] };
        const tickets = Array.isArray(json.data) ? json.data : [];

        tickets.forEach((ticket, idx) => {
          const token = chunk[idx]?.to;
          if (ticket.status === "ok") {
            sent += 1;
          } else {
            const errCode = ticket.details?.error ?? ticket.message ?? "UNKNOWN";
            errors.push(`${token ?? "unknown"}: ${errCode}`);
            if (ticket.details?.error === "DeviceNotRegistered" && token) {
              invalidTokens.push(token);
            }
          }
        });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (invalidTokens.length > 0) {
      await this.store.disableTokens(invalidTokens);
    }

    return {
      attempted: messages.length,
      sent,
      invalidTokens,
      errors,
    };
  }
}
