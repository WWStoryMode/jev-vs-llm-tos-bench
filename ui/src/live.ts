// Browser side of Live mode. Talks only to our own /api (proxied to server/index.ts); never to OpenRouter.

export type LiveStart = { count: number; sentences: string[]; jevModel: string; llmModel: string; rubricVersion: string };
export type LiveSentence =
  | { idx: number; text: string; probs: Record<string, number>; cost: number; ms: number; cached: boolean; error?: undefined }
  | { idx: number; text: string; error: string };
export type LiveDone = { totalCost: number; totalMs: number; count: number; cached: number; errors: number };

type Handlers = {
  onStart: (e: LiveStart) => void;
  onSentence: (e: LiveSentence) => void;
  onDone: (e: LiveDone) => void;
};

/** Turn a failed response into a message a presenter can act on. */
async function errorMessage(res: Response): Promise<string> {
  const body = await res.text();
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON: usually the Vite proxy saying the server isn't running
  }
  if (res.status >= 500) return "Live server not reachable. Start it with `npm run server:dev`.";
  return `Request failed (${res.status}).`;
}

/**
 * POST /api/classify and parse its Server-Sent Events as they arrive.
 * (EventSource only supports GET, so this reads the stream with fetch.)
 */
export async function classifyStream(text: string, h: Handlers, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    throw new Error("Live server not reachable. Start it with `npm run server:dev`.");
  }
  if (!res.ok || !res.body) throw new Error(await errorMessage(res));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.match(/^data: (.*)$/m)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "start") h.onStart(payload as LiveStart);
      else if (event === "sentence") h.onSentence(payload as LiveSentence);
      else if (event === "done") {
        sawDone = true;
        h.onDone(payload as LiveDone);
      }
    }
  }
  if (!sawDone && !signal?.aborted) throw new Error("The analysis stopped before finishing. Sentences without a result are marked.");
}

export type ExplainResult = { explanation: string; agree: boolean; model: string; cost: number; ms: number; cached: boolean };

/** POST /api/explain for one sentence and the categories Jev flagged. */
export async function explainSentence(text: string, categories: string[]): Promise<ExplainResult> {
  let res: Response;
  try {
    res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, categories }),
    });
  } catch {
    throw new Error("Live server not reachable. Start it with `npm run server:dev`.");
  }
  if (!res.ok) throw new Error(await errorMessage(res));
  return (await res.json()) as ExplainResult;
}
