// All requests go to the same origin under /api: the API Gateway in the
// cloud, the Vite dev server proxy locally. Never hardcode a host.
const API_PREFIX = "/api";

// Browser URL of an API path, e.g. for a plain link: apiUrl("/docs") -> "/api/docs".
export function apiUrl(path: string): string {
  return `${API_PREFIX}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  let response: Response;
  try {
    response = await fetch(apiUrl(path), { ...init, headers });
  } catch {
    throw new ApiError("Network error: backend is unreachable");
  }
  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export async function apiPost<T, Body>(path: string, body: Body, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Network error: backend is unreachable");
  }
  if (!response.ok) {
    let detail = `Request failed with status ${response.status}`;
    try {
      const error = (await response.json()) as { detail?: unknown };
      if (typeof error.detail === "string") detail = error.detail;
    } catch {
      // Keep the status-based message when the backend did not return JSON.
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}
