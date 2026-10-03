import type { RouteGenerateRequest, RouteGenerateResponse } from "@/entities/route";
import { apiPost } from "@/shared/api";

export async function requestGenerateRoute(
  payload: RouteGenerateRequest
): Promise<RouteGenerateResponse> {
  return await apiPost<RouteGenerateResponse>("/route/generate", payload);
}
