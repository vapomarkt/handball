import { ThrowOffApiError } from "../errors";
import type {
  RegisterPushTokenInput,
  UnregisterPushTokenInput,
} from "../schemas/push";
import type { CarpoolDTO } from "../../../../src/domain/schemas/carpool";
import type {
  CashboxOverviewDTO,
  TeamAnnouncementDTO,
  TeamPollDTO,
} from "../../../../src/domain/schemas/community";
import type { WorkDutyDTO } from "../../../../src/domain/schemas/duty";
import type {
  EventAttendanceResponseDTO,
  EventDTO,
  SubmitRsvpInput,
} from "../../../../src/domain/schemas/event";
import type {
  ClaimInviteInput,
  InvitePreviewDTO,
} from "../../../../src/domain/schemas/invite";
import type {
  TeamMemberPublicDTO,
  TeamMemberSensitiveDTO,
} from "../../../../src/domain/schemas/member";
import type {
  QuickProfileUpdateInput,
  UpdateOnboardingStateInput,
  UserOnboardingStateDTO,
} from "../../../../src/domain/schemas/onboarding-state";
import type { TacticPlayDTO } from "../../../../src/domain/schemas/tactic";
import type { MePayloadDTO } from "../types/dto";

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
  ): Promise<{ events: EventDTO[] }> {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const qs = query.toString();
    return this.request<{ events: EventDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events${qs ? `?${qs}` : ""}`
    );
  }

  getEventDetail(
    teamId: string,
    eventId: string
  ): Promise<{ event: EventDTO }> {
    return this.request<{ event: EventDTO }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}`
    );
  }

  upsertRsvp(
    teamId: string,
    eventId: string,
    input: SubmitRsvpInput
  ): Promise<{ attendance: EventAttendanceResponseDTO }> {
    return this.request<{ attendance: EventAttendanceResponseDTO }>(
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
  ): Promise<{ carpools: CarpoolDTO[] }> {
    return this.request<{ carpools: CarpoolDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools`
    );
  }

  listTeamMembers(teamId: string): Promise<{
    members: Array<TeamMemberPublicDTO | TeamMemberSensitiveDTO>;
  }> {
    return this.request<{
      members: Array<TeamMemberPublicDTO | TeamMemberSensitiveDTO>;
    }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/members`
    );
  }

  listAnnouncements(
    teamId: string
  ): Promise<{ announcements: TeamAnnouncementDTO[] }> {
    return this.request<{ announcements: TeamAnnouncementDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/announcements`
    );
  }

  listPolls(teamId: string): Promise<{ polls: TeamPollDTO[] }> {
    return this.request<{ polls: TeamPollDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/polls`
    );
  }

  votePoll(
    teamId: string,
    pollId: string,
    optionId: string
  ): Promise<{ poll: TeamPollDTO }> {
    return this.request<{ poll: TeamPollDTO }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/polls/${encodeURIComponent(pollId)}/vote`,
      {
        method: "POST",
        body: JSON.stringify({ optionId }),
      }
    );
  }

  getCashboxOverview(teamId: string): Promise<CashboxOverviewDTO> {
    return this.request<CashboxOverviewDTO>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/cashbox`
    );
  }

  listTactics(teamId: string): Promise<{ plays: TacticPlayDTO[] }> {
    return this.request<{ plays: TacticPlayDTO[] }>(
      `/api/v1/teams/${encodeURIComponent(teamId)}/tactics`
    );
  }

  listClubDuties(
    clubId: string,
    params?: { teamId?: string }
  ): Promise<{ duties: WorkDutyDTO[] }> {
    const query = new URLSearchParams();
    if (params?.teamId) query.set("teamId", params.teamId);
    const qs = query.toString();
    return this.request<{ duties: WorkDutyDTO[] }>(
      `/api/v1/clubs/${encodeURIComponent(clubId)}/duties${qs ? `?${qs}` : ""}`
    );
  }

  claimDuty(
    clubId: string,
    dutyId: string,
    memberId: string
  ): Promise<{ assignment: unknown }> {
    return this.request<{ assignment: unknown }>(
      `/api/v1/clubs/${encodeURIComponent(clubId)}/duties/${encodeURIComponent(dutyId)}/claim`,
      {
        method: "POST",
        body: JSON.stringify({ memberId }),
      }
    );
  }

  getInvite(token: string): Promise<{ invite: InvitePreviewDTO }> {
    return this.request<{ invite: InvitePreviewDTO }>(
      `/api/v1/invites/${encodeURIComponent(token)}`
    );
  }

  claimInvite(
    token: string,
    input: Partial<ClaimInviteInput> = {}
  ): Promise<unknown> {
    return this.request<unknown>(
      `/api/v1/invites/${encodeURIComponent(token)}/claim`,
      {
        method: "POST",
        body: JSON.stringify(input),
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

  updateOnboardingState(
    input: UpdateOnboardingStateInput
  ): Promise<{ onboardingState: UserOnboardingStateDTO }> {
    return this.request<{ onboardingState: UserOnboardingStateDTO }>(
      "/api/v1/me/onboarding-state",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    );
  }

  updateMyProfile(
    input: Partial<QuickProfileUpdateInput>
  ): Promise<{ member: unknown; child: unknown }> {
    return this.request<{ member: unknown; child: unknown }>(
      "/api/v1/me/profile",
      {
        method: "PATCH",
        body: JSON.stringify(input),
      }
    );
  }
}

export function createThrowOffApiClient(
  config: ThrowOffApiClientConfig
): ThrowOffApiClient {
  return new ThrowOffApiClient(config);
}
