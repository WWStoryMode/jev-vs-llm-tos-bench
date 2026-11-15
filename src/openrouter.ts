// Thin OpenRouter client shared by Jev (System One) and LLM (chat completions).
// One API key and one base URL, so swapping models is just an env change.
import { config } from "./config.js";

// ---------- Jev request/response types (from docs.typesafe.ai/api) ----------

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};
export type ChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string | null>; // option name -> description, max 255
};
export type ScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[]; // ordered levels, index = score (0-based), max 10
};
export type JevQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type JevRequest = {
  model?: string; // defaults to JEV_MODEL
  state: string | Record<string, unknown> | unknown[];
  questions: Record<string, JevQuestion>; // keys are YOUR ids; never sent to the model as meaning
};

export type JevAnswer =
  | { type: "noul"; noul: number; confidence?: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: "score"; score: number; confidence: number; probabilities: Record<string, number>; legend: Record<string, string> }
  | { type: "refusal" };

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number; // USD, added by OpenRouter
  [k: string]: unknown;
};

export type JevResponse = {
  id?: string;
  model: string;
  answers: Record<string, JevAnswer>;
  usage: Usage;
};

export type Timed<T> = { data: T; ms: number };

// ---------- core POST helper ----------

const RETRYABLE = new Set([408, 429, 500, 502, 503, 524, 529]);
const MAX_ATTEMPTS = 4;

/** Number of retried requests since start (reported as a reliability metric). */
export let retryCount = 0;

async function post<T>(path: string, body: unknown): Promise<Timed<T>> {
  for (let attempt = 1; ; attempt++) {
    const started = performance.now();
    let status = 0;
    let text = "";
    try {
      const res = await fetch(`${config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      status = res.status;
      text = await res.text();
      if (res.ok) return { data: JSON.parse(text) as T, ms: performance.now() - started };
    } catch (err) {
      text = String(err); // network error: treat as retryable
    }
    // OpenRouter errors look like {error:{code,message,metadata}}
    const retryable = status === 0 || RETRYABLE.has(status);
    if (!retryable || attempt >= MAX_ATTEMPTS) throw new Error(`OpenRouter ${path} ${status}: ${text}`);
    retryCount++;
    await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1) + Math.random() * 250)); // backoff + jitter
  }
}

// ---------- Jev ----------

export function callJev(req: JevRequest): Promise<Timed<JevResponse>> {
  return post<JevResponse>("/systemone", { model: config.jevModel, ...req });
}

// ---------- LLM (OpenAI-compatible chat completions) ----------

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatResponse = {
  id: string;
  model: string;
  choices: { message: { role: string; content: string }; finish_reason: string }[];
  usage: Usage;
};

export function callLlm(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; json?: boolean; maxTokens?: number } = {},
): Promise<Timed<ChatResponse>> {
  return post<ChatResponse>("/chat/completions", {
    model: opts.model ?? config.llmModel,
    messages,
    temperature: opts.temperature ?? 0,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    usage: { include: true }, // ask OpenRouter to return usage.cost
  });
}
