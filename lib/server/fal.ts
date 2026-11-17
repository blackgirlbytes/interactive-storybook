import "server-only";

const FAL_BASE = "https://fal.run";
const CHAT_URL = `${FAL_BASE}/openrouter/router/openai/v1/chat/completions`;

export class ConfigError extends Error {}

function falKey(): string {
  const key = process.env.FAL_KEY;
  if (!key) throw new ConfigError("FAL_KEY is not set. Add it to .env.local.");
  return key;
}

export const LLM_MODEL = process.env.FAL_LLM_MODEL || "google/gemini-2.5-flash";

function chatRequest(system: string, user: string, signal: AbortSignal | undefined, stream: boolean, extra?: string) {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  if (extra) messages.push({ role: "user", content: extra });
  return fetch(CHAT_URL, {
    method: "POST",
    signal,
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      // Reasoning adds roughly half a second before the first word and does not improve short story turns.
      reasoning: { enabled: false },
      stream,
    }),
  });
}

export async function chatJSON(system: string, user: string, signal?: AbortSignal, extra?: string): Promise<string> {
  const res = await chatRequest(system, user, signal, false, extra);
  if (!res.ok) throw new Error(`fal LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("fal LLM returned no content");
  return content;
}

/** Resolves once the model has accepted the request, then yields content deltas as they arrive. */
export async function chatStream(system: string, user: string, signal?: AbortSignal): Promise<AsyncGenerator<string>> {
  const res = await chatRequest(system, user, signal, true);
  if (!res.ok || !res.body) throw new Error(`fal LLM error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const reader = res.body.getReader();
  return (async function* () {
    const decoder = new TextDecoder();
    let buffer = "";
    try { for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        let chunk: { error?: { message?: string }; choices?: { delta?: { content?: string } }[] };
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        if (chunk.error) throw new Error(`fal LLM error: ${chunk.error.message ?? "stream failed"}`);
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) yield content;
      }
    } } finally {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  })();
}

interface FalImageResult {
  images?: { url: string; content_type?: string }[];
}

export async function falImage(endpoint: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${FAL_BASE}/${endpoint}`, {
    method: "POST",
    signal,
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`fal ${endpoint} error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as FalImageResult;
  const url = data.images?.[0]?.url;
  if (!url) throw new Error(`fal ${endpoint} returned no image`);
  return url;
}

const QUEUE_BASE = "https://queue.fal.run";

const videoSetting = process.env.FAL_VIDEO_MODEL?.trim();
/** Empty when clips are turned off with FAL_VIDEO_MODEL=off. */
export const VIDEO_MODEL = videoSetting === "off" ? "" : videoSetting || "minimax/h3-max-turbo/image-to-video";

// Queue status and result URLs use only the owner/app part of an endpoint id.
const queueApp = (endpoint: string) => endpoint.split("/").slice(0, 2).join("/");

async function queueFetch<T>(url: string, signal: AbortSignal | undefined, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal,
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`fal queue error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export async function falQueueSubmit(endpoint: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
  const data = await queueFetch<{ request_id?: string }>(`${QUEUE_BASE}/${endpoint}`, signal, { method: "POST", body: JSON.stringify(input) });
  if (!data.request_id) throw new Error(`fal ${endpoint} did not accept the job`);
  return data.request_id;
}

export async function falQueueStatus(endpoint: string, id: string, signal?: AbortSignal): Promise<string> {
  const data = await queueFetch<{ status?: string }>(`${QUEUE_BASE}/${queueApp(endpoint)}/requests/${id}/status`, signal);
  return data.status ?? "UNKNOWN";
}

export function falQueueResult<T>(endpoint: string, id: string, signal?: AbortSignal): Promise<T> {
  return queueFetch<T>(`${QUEUE_BASE}/${queueApp(endpoint)}/requests/${id}`, signal);
}
