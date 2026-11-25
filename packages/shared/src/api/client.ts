import { ThrowOffApiError } from "../errors";
import type {
  RegisterPushTokenInput,
  UnregisterPushTokenInput,
} from "../schemas/push";
import type {
  AnnouncementDTO,
  CarpoolOfferDTO,
  ClubDutyDTO,
  InviteInfoDTO,
  MePayloadDTO,
  PollDTO,
  TacticPlayDTO,
  TeamEventDTO,
  TeamMemberDTO,
  UpsertRsvpInput,
} from "../types/dto";

export interface ThrowOffApiClientConfig {
  /** Base URL without trailing slash (e.g. "https://throwoff.app" on mobile, "" in browser). */
  baseUrl: string;
  /** Optional provider for Authorization / Cookie headers (used by native clients). */
  getAuthHeaders?: () =>
    | Promise<Record<string, string>>
    | Record<string, string>;
  /** Optional app version sent as X-App-Version for diagnostics and soft-update checks. */
  appVersion?: string;
  /** Optional custom fetch implementation (useful in tests). */
  fetchImpl?: typeof fetch;
}

export class ThrowOffApiClient {
  private readonly baseUrl: string;
  private readonly getAuthHeaders?: ThrowOffApiClientConfig["getAuthHeaders"];
  private readonly appVersion?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ThrowOffApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.getAuthHeaders = config.getAuthHeaders;
    this.appVersion = config.appVersion;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const authHeaders = this.getAuthHeaders
      ? await this.getAuthHeaders()
      : {};

    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(this.appVersion ? { "X-App-Version": this.appVersion } : {}),
      ...authHeaders,
      ...(init.headers as Record<string, string> | undefined),
    };

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers,
        credentials: this.baseUrl === "" ? "same-origin" : "omit",
      });
    } catch (err) {
      throw new ThrowOffApiError(
        "NETWORK_ERROR",
        "Keine Verbindung zum ThrowOff-Server.",
        0,
        err instanceof Error ? err.message : err
      );
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      throw ThrowOffApiError.fromResponse(response.status, parsed);
    }

    return parsed as T;
  }

  getMe(): Promise<MePayloadDTO> {
    return this.request<MePayloadDTO>("/api/v1/me");
  }

  listTeamEvents(
    teamId: string,
    params?: { from?: string; to?: string }
  ): Promise<{ events: TeamEventDTO[] }> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return this.request<{ events: TeamEventDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events${qs ? `?${qs}` : ""}`
    );
  }

  getEventDetail(
    teamId: string,
    eventId: string
  ): Promise<{ event: TeamEventDTO }> {
    return this.request<{ event: TeamEventDTO }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}`
    );
  }

  upsertRsvp(
    teamId: string,
    eventId: string,
    input: UpsertRsvpInput
  ): Promise<{ rsvp: unknown }> {
    return this.request<{ rsvp: unknown }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/rsvp`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      }
    );
  }

  listCarpools(
    teamId: string,
    eventId: string
  ): Promise<{ carpools: CarpoolOfferDTO[] }> {
    return this.request<{ carpools: CarpoolOfferDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools`
    );
  }

  listTeamMembers(teamId: string): Promise<{ members: TeamMemberDTO[] }> {
    return this.request<{ members: TeamMemberDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/members`
    );
  }

  listAnnouncements(
    teamId: string
  ): Promise<{ announcements: AnnouncementDTO[] }> {
    return this.request<{ announcements: AnnouncementDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/announcements`
    );
  }

  listPolls(teamId: string): Promise<{ polls: PollDTO[] }> {
    return this.request<{ polls: PollDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/polls`
    );
  }

  votePoll(
    teamId: string,
    pollId: string,
    optionIds: string[]
  ): Promise<{ poll: PollDTO }> {
    return this.request<{ poll: PollDTO }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/polls/${encodeURIComponent(pollId)}/vote`,
      {
        method: "POST",
        body: JSON.stringify({ optionIds }),
      }
    );
  }

  listTactics(teamId: string): Promise<{ plays: TacticPlayDTO[] }> {
    return this.request<{ plays: TacticPlayDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/tactics`
    );
  }

  listClubDuties(clubId: string): Promise<{ duties: ClubDutyDTO[] }> {
    return this.request<{ duties: ClubDutyDTO[] }>(
      `/api/v1/clubs/${encodeURIComponent(clubId)}/duties`
    );
  }

  claimDuty(clubId: string, dutyId: string): Promise<{ assignment: unknown }> {
    return this.request<{ assignment: unknown }>(
      `/api/v1/clubs/${encodeURIComponent(clubId)}/duties/${encodeURIComponent(dutyId)}/claim`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
  }

  getInvite(token: string): Promise<{ invite: InviteInfoDTO }> {
    return this.request<{ invite: InviteInfoDTO }>(
      `/api/v1/invites/${encodeURIComponent(token)}`
    );
  }

  claimInvite(token: string): Promise<{ ok: boolean; teamId?: string }> {
    return this.request<{ ok: boolean; teamId?: string }>(
      `/api/v1/invites/${encodeURIComponent(token)}/claim`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );
  }

  registerPushToken(
    input: RegisterPushTokenInput
  ): Promise<{ device: { id: string; platform: string; enabled: boolean } }> {
    return this.request<{
      device: { id: string; platform: string; enabled: boolean };
    }>("/api/v1/me/push-tokens", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  unregisterPushToken(
    input: UnregisterPushTokenInput
  ): Promise<{ unregistered: boolean }> {
    return this.request<{ unregistered: boolean }>("/api/v1/me/push-tokens", {
      method: "DELETE",
      body: JSON.stringify(input),
    });
  }
}

export function createThrowOffApiClient(
  config: ThrowOffApiClientConfig
): ThrowOffApiClient {
  return new ThrowOffApiClient(config);
}
