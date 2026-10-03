import type { RouteGenerateRequest, RouteGenerateResponse } from "../model/types";

export const TOUR_STORAGE_KEY = "pushkin_museum_tour_state_v1";
export const TOUR_STORAGE_VERSION = 1;

export type TourStage = "preferences" | "overview" | "tour" | "completed";

export interface SavedTourState {
  version: number;
  stage: TourStage;
  preferences: RouteGenerateRequest | null;
  route: RouteGenerateResponse | null;
  currentStopIndex: number;
  userAnswers: Record<number, number | null>;
  dismissedBreakIndex: number | null;
  savedAt: number;
}

/**
 * Validates whether a loaded object conforms to the expected tour state structure.
 */
export function validateTourState(data: unknown): data is SavedTourState {
  if (!data || typeof data !== "object") return false;
  const state = data as Partial<SavedTourState>;

  if (state.version !== TOUR_STORAGE_VERSION) return false;
  if (!state.stage || !["preferences", "overview", "tour", "completed"].includes(state.stage)) {
    return false;
  }

  // If tour has progressed past preferences, route must be a valid object with stops
  if (state.stage !== "preferences") {
    if (!state.route || !Array.isArray(state.route.stops) || state.route.stops.length === 0) {
      return false;
    }
  }

  if (typeof state.currentStopIndex !== "number" || state.currentStopIndex < 0) {
    return false;
  }

  if (!state.userAnswers || typeof state.userAnswers !== "object") {
    return false;
  }

  return true;
}

/**
 * Safely persists current tour progress to localStorage.
 */
export function saveTourState(
  state: Omit<SavedTourState, "version" | "savedAt">
): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    const payload: SavedTourState = {
      ...state,
      version: TOUR_STORAGE_VERSION,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    // QuotaExceededError or security policy restriction
    console.warn("Failed to persist tour state to localStorage:", err);
    return false;
  }
}

/**
 * Safely loads and validates persisted tour progress from localStorage.
 * If data is corrupted, unrecognized or outdated, safely clears it and returns null.
 */
export function loadTourState(): SavedTourState | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(TOUR_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (validateTourState(parsed)) {
      return parsed;
    }

    // Incompatible or corrupt data detected -> safely purge
    console.warn("Invalid or outdated tour state in localStorage; clearing.");
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
    return null;
  } catch (err) {
    console.warn("Error reading tour state from localStorage:", err);
    try {
      window.localStorage.removeItem(TOUR_STORAGE_KEY);
    } catch {
      // Ignore secondary storage error
    }
    return null;
  }
}

/**
 * Clears tour progress from localStorage (e.g. upon user reset / start new tour).
 */
export function clearTourState(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn("Failed to clear tour state from localStorage:", err);
    return false;
  }
}
