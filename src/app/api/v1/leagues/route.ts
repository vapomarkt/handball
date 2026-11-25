import {
  handleApiError,
  jsonOk,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await services.leagueCatalog.listLeagues({
      countryCode: searchParams.get("countryCode") || "DE",
      ageGroup: searchParams.get("ageGroup") || undefined,
      gender: searchParams.get("gender") || undefined,
      federationCode: searchParams.get("federationCode") || undefined,
      q: searchParams.get("q") || undefined,
    });
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
