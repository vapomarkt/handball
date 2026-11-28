import {
  Handball360Client,
  Handball360ClubSearchItem,
  Handball360MatchPayload,
  Handball360MatchReportPayload,
} from "@/domain/adapters/handball360-client";

export interface Handball360HttpClientConfig {
  /** Offizielle Partner-/API-Basis-URL (z. B. über HANDBALL360_API_BASE_URL). */
  baseUrl?: string | null;
  /** Optionaler Bearer-Token / API-Key aus einer DHB-Partnervereinbarung. */
  apiKey?: string | null;
  timeoutMs?: number;
}

/**
 * Konfigurierbarer, regelkonformer HTTP-Client für eine offizielle
 * Handball360 / handball.net-Datenschnittstelle.
 *
 * Hinweis aus dem technischen Spike (Nov 2026):
 * `www.handball.net` ist serverseitig durch Cloudflare geschützt (HTTP 403 ohne
 * Partner-Freigabe). Dieser Client umgeht keinerlei Schutzmechanismen, sondern
 * spricht ausschließlich eine konfigurierte, autorisierte API-Basis-URL an.
 */
export class Handball360HttpClient implements Handball360Client {
  private readonly baseUrl: string | null;
  private readonly apiKey: string | null;
  private readonly timeoutMs: number;

  constructor(config: Handball360HttpClientConfig = {}) {
    const rawBase = (
      config.baseUrl ??
      process.env.HANDBALL360_API_BASE_URL ??
      ""
    ).trim();
    this.baseUrl = rawBase ? rawBase.replace(/\/+$/, "") : null;
    this.apiKey =
      (config.apiKey ?? process.env.HANDBALL360_API_KEY ?? "").trim() || null;
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  private async requestJson<T>(path: string, params?: Record<string, string>): Promise<T> {
    if (!this.baseUrl) {
      throw new Error(
        "Handball360 API ist nicht konfiguriert (HANDBALL360_API_BASE_URL)."
      );
    }

    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v) url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "ThrowOff-Handball-Sync/1.0 (+https://throwoff.de)",
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(
        `Handball360-Abruf fehlgeschlagen (HTTP ${res.status}).`
      );
    }

    return (await res.json()) as T;
  }

  async searchClubsAndTeams(params: {
    query: string;
    federationCode?: string;
    seasonName?: string;
  }): Promise<Handball360ClubSearchItem[]> {
    return this.requestJson<Handball360ClubSearchItem[]>("/clubs/search", {
      q: params.query,
      ...(params.federationCode ? { federation: params.federationCode } : {}),
      ...(params.seasonName ? { season: params.seasonName } : {}),
    });
  }

  async fetchTeamSchedule(params: {
    teamExternalId: string;
    tournamentExternalId?: string | null;
    seasonName?: string | null;
  }): Promise<Handball360MatchPayload[]> {
    return this.requestJson<Handball360MatchPayload[]>(
      `/teams/${encodeURIComponent(params.teamExternalId)}/schedule`,
      {
        ...(params.tournamentExternalId
          ? { tournamentId: params.tournamentExternalId }
          : {}),
        ...(params.seasonName ? { season: params.seasonName } : {}),
      }
    );
  }

  async fetchMatchReport(
    matchId: string
  ): Promise<Handball360MatchReportPayload | null> {
    try {
      return await this.requestJson<Handball360MatchReportPayload>(
        `/matches/${encodeURIComponent(matchId)}/report`
      );
    } catch {
      return null;
    }
  }
}
