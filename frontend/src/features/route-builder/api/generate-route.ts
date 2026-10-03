import { apiPost } from "@/shared/api";

export type GenerateRouteRequest = {
  audience: string;
  interests: string[];
  duration_minutes: number;
  building_id: string;
};

export type RouteExhibit = {
  id: string;
  inventory_number: string | null;
  title: string | null;
  authors: string[];
  date_text: string | null;
  year: number | string | null;
  type: string | null;
  country: string | null;
  material: string | null;
  description: string;
  annotation: string;
  building_id: string | null;
  hall_id: string | null;
  building_name: string | null;
  hall: {
    id: string;
    building_id: string;
    building_name: string | null;
    floor_id: string;
    floor_number: string | null;
    number: string | null;
    name: string | null;
    floor_plan_url: string | null;
  } | null;
  image_urls: string[];
  source_url: string | null;
  show_in_hall: boolean | null;
  route_eligible: boolean;
};

export type RouteResult = {
  building_id: string;
  building_name: string | null;
  audience: string;
  duration_minutes: number;
  stops: Array<{
    exhibit: RouteExhibit;
    reason: string;
    activity: string;
  }>;
  explanation: string;
  availability_note: string;
  usage_note: string;
};

export function generateRoute(request: GenerateRouteRequest, signal?: AbortSignal) {
  return apiPost<RouteResult, GenerateRouteRequest>("/routes/generate", request, { signal });
}
