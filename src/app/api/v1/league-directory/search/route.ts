import { requireViewerContext } from "@/infrastructure/auth/session";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(request: Request) {
  try {
    await requireViewerContext();
    const { searchParams } = new URL(request.url);
    const result = await services.leagueDirectory.search({
      countryCode: searchParams.get("countryCode") ?? "DE",
      federationCode: searchParams.get("federationCode") || undefined,
      seasonName: searchParams.get("seasonName") ?? undefined,
      ageGroup: searchParams.get("ageGroup") ?? undefined,
      gender: searchParams.get("gender") ?? undefined,
      leagueId: searchParams.get("leagueId") ?? undefined,
      regionCode: searchParams.get("regionCode") ?? undefined,
      q: searchParams.get("q") ?? undefined,
      clubName: searchParams.get("clubName") ?? undefined,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
