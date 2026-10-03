export interface Challenge {
  type: "question" | "observation";
  question: string;
  options: string[];
  correct_option: number | null;
  explanation: string | null;
}

export interface Stop {
  position: number;
  exhibit_id: string;
  title: string;
  artist: string | null;
  date: string | null;
  image_url: string | null;
  location: string | null;
  description: string;
  personalization_reason: string;
  look_closer: string;
  challenge: Challenge;
  provenance_source?: string | null;
  source_url?: string | null;
}

export type GroupType = "solo" | "friends" | "family" | "couple";
export type DifficultyLevel = "beginner" | "amateur" | "expert";
export type TourStyle = "quest" | "story" | "meditative";

export interface RouteGenerateRequest {
  interests: string[];
  duration_minutes: number;
  group_type: GroupType;
  difficulty: DifficultyLevel;
  style: TourStyle;
}

export interface RouteGenerateResponse {
  route_id: string;
  title: string;
  intro: string;
  duration_minutes: number;
  is_fallback: boolean;
  stops: Stop[];
}
