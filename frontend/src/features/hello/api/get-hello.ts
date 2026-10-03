import { apiGet } from "@/shared/api";

export const HELLO_PATH = "/hello";

export type YdbStatus = {
  status: "ok" | "unavailable" | "not_configured";
  detail: string;
};

export type LlmStatus = {
  status: "ok" | "unavailable" | "not_configured";
  model: string;
  question: string;
  answer: string;
  detail: string;
};

export type HelloResponse = {
  message: string;
  ydb: YdbStatus;
  llm: LlmStatus;
};

export function getHello(signal?: AbortSignal) {
  return apiGet<HelloResponse>(HELLO_PATH, { signal });
}
