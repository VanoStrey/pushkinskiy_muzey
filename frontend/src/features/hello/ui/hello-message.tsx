import { useEffect, useState } from "react";

import { apiUrl } from "@/shared/api";

import { getHello, HELLO_PATH, type HelloResponse, type LlmStatus, type YdbStatus } from "../api/get-hello";

type State =
  | { status: "loading" }
  | { status: "success"; data: HelloResponse }
  | { status: "error"; error: string };

const YDB_STYLES: Record<YdbStatus["status"], { label: string; className: string }> = {
  ok: { label: "YDB is connected", className: "border-green-300 bg-green-50 text-green-800" },
  unavailable: { label: "YDB is unavailable", className: "border-red-300 bg-red-50 text-red-800" },
  not_configured: { label: "YDB is not configured", className: "border-gray-300 bg-gray-50 text-gray-700" },
};

const LLM_STYLES: Record<LlmStatus["status"], { label: string; className: string }> = {
  ok: { label: "LLM answered", className: "border-green-300 bg-green-50 text-green-800" },
  unavailable: { label: "LLM is unavailable", className: "border-red-300 bg-red-50 text-red-800" },
  not_configured: { label: "LLM is not configured", className: "border-gray-300 bg-gray-50 text-gray-700" },
};

const linkClass = "text-blue-600 underline hover:text-blue-800";

// "Hello" becomes a link to the endpoint, so the raw JSON is one click away.
function MessageWithLink({ message }: { message: string }) {
  const href = apiUrl(HELLO_PATH);
  if (!message.startsWith("Hello")) {
    return (
      <a href={href} className={linkClass}>
        {message}
      </a>
    );
  }
  return (
    <>
      <a href={href} className={linkClass}>
        Hello
      </a>
      {message.slice("Hello".length)}
    </>
  );
}

export function HelloMessage() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    getHello(controller.signal)
      .then((data) => setState({ status: "success", data }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", error: error instanceof Error ? error.message : String(error) });
      });
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return <p className="text-gray-500">Loading message from the backend…</p>;
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
        <p className="font-semibold">Could not load message from the backend.</p>
        <p className="text-sm">{state.error}</p>
      </div>
    );
  }

  const { message, ydb, llm } = state.data;
  const ydbStyle = YDB_STYLES[ydb.status];
  const llmStyle = LLM_STYLES[llm.status];

  return (
    <div className="flex flex-col gap-4">
      <p data-testid="hello-message" className="text-xl font-medium">
        <MessageWithLink message={message} />
      </p>
      <div data-testid="ydb-status" className={`rounded-lg border p-4 ${ydbStyle.className}`}>
        <p className="font-semibold">{ydbStyle.label}</p>
        <p className="text-sm">{ydb.detail}</p>
      </div>
      <div data-testid="llm-status" className={`rounded-lg border p-4 ${llmStyle.className}`}>
        <p className="font-semibold">
          {llmStyle.label}: <code>{llm.model}</code>
        </p>
        <p className="text-sm italic">{llm.question}</p>
        <p className="mt-2 whitespace-pre-line text-sm">{llm.status === "ok" ? llm.answer : llm.detail}</p>
      </div>
    </div>
  );
}
