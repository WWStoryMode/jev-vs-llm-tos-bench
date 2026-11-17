// Live mode server for the Small Print Radar UI (docs/UI_BRIEF.md, Phase 2).
// Plain node:http, no framework. The browser only ever talks to /api/* here; the OpenRouter key stays server-side.
//
//   npm run server:dev        # http://127.0.0.1:8787 (the Vite dev server proxies /api to it)
//
// POST /api/classify {text}             -> Server-Sent Events: start, sentence (one per sentence), done
// POST /api/explain  {text, categories, model?} -> JSON {explanation, agree, model, cost, ms, cached}
//                    (model must be one of EXPLAIN_MODELS; defaults to EXPLAIN_MODEL)
// GET  /api/health                      -> models, rubric version, cache sizes (no secrets)
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { config } from "../src/config.js"; // throws a clear error if OPENROUTER_API_KEY is missing
import { jevClassify } from "../src/jev.js";
import { llmExplainBatch } from "../src/llm.js";
import { pool } from "../src/pool.js";
import { CATEGORIES, RUBRIC_VERSION } from "../src/rubric.js";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = "127.0.0.1"; // localhost only: deployment is out of scope
const MAX_SENTENCES = 300;
const MAX_BODY_BYTES = 200_000;
const CONCURRENCY = 8; // same as the eval

// ---------- sentence splitting ----------

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });

export function splitSentences(text: string): string[] {
  return [...segmenter.segment(text)].map((s) => s.segment.replace(/\s+/g, " ").trim()).filter((s) => s.length > 0);
}

// ---------- cache: repeating the demo must not cost twice ----------

type Probs = Record<string, number>;
type Explanation = { explanation: string; agree: boolean };

const hash = (...parts: string[]) => createHash("sha256").update(parts.join("\u0000")).digest("hex");
const jevCache = new Map<string, Probs>();
const explainCache = new Map<string, Explanation>();
const jevKey = (sentence: string) => hash("jev", config.jevModel, RUBRIC_VERSION, sentence);
const explainKey = (model: string, sentence: string, categories: string[]) =>
  hash("explain", model, RUBRIC_VERSION, sentence, [...categories].sort().join(","));
// Explanation models the browser may ask for: the default plus the configured list, nothing else.
const EXPLAIN_MODELS = [...new Set([config.explainModel, ...config.explainModels])];

// ---------- per-IP rate limit (fixed one-minute window) ----------

const LIMITS = { classify: 20, explain: 60 }; // requests per minute per IP
const windows = new Map<string, { start: number; count: number }>();

function rateLimited(ip: string, route: keyof typeof LIMITS): boolean {
  const key = `${route}:${ip}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start > 60_000) {
    windows.set(key, { start: now, count: 1 });
    return false;
  }
  w.count++;
  return w.count > LIMITS[route];
}

// ---------- helpers ----------

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, `Text too large (max ${MAX_BODY_BYTES / 1000} kB).`);
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

/** Error text that is safe to show in the browser: never headers, never the key. */
function publicError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const status = msg.match(/^OpenRouter \S+ (\d{3})/)?.[1];
  if (status === "401" || status === "403") return "The model provider rejected the API key (check .env on the server).";
  if (status === "402") return "The model provider account is out of credit.";
  if (status === "429") return "The model provider is rate-limiting us; try again shortly.";
  if (status) return `Model provider error ${status}.`;
  return "Unexpected server error.";
}

const clientIp = (req: IncomingMessage) => req.socket.remoteAddress ?? "unknown";

// ---------- routes ----------

const ClassifyBody = z.object({ text: z.string() });
const ExplainBody = z.object({
  text: z.string().min(1).max(2000),
  categories: z.array(z.enum(CATEGORIES as [string, ...string[]])).min(1),
  model: z.string().max(100).optional(),
});

async function classify(req: IncomingMessage, res: ServerResponse) {
  const parsed = ClassifyBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, 'Expected {"text": "..."}.');
  const sentences = splitSentences(parsed.data.text);
  if (sentences.length === 0) throw new HttpError(400, "No sentences found in the text.");
  if (sentences.length > MAX_SENTENCES) {
    throw new HttpError(400, `Too long: ${sentences.length} sentences (max ${MAX_SENTENCES}). Paste a shorter section.`);
  }

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
  let closed = false;
  res.on("close", () => (closed = true)); // client went away: stop starting new calls
  const send = (event: string, data: unknown) => !closed && res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const started = performance.now();
  let totalCost = 0;
  let cachedCount = 0;
  let errorCount = 0;
  send("start", { count: sentences.length, sentences, jevModel: config.jevModel, llmModel: config.explainModel, rubricVersion: RUBRIC_VERSION });

  await pool(sentences, CONCURRENCY, async (text, idx) => {
    if (closed) return;
    const key = jevKey(text);
    const hit = jevCache.get(key);
    if (hit) {
      cachedCount++;
      send("sentence", { idx, text, probs: hit, cost: 0, ms: 0, cached: true });
      return;
    }
    try {
      const r = await jevClassify(text);
      jevCache.set(key, r.probs);
      totalCost += r.cost;
      send("sentence", { idx, text, probs: r.probs, cost: r.cost, ms: Math.round(r.ms), cached: false });
    } catch (err) {
      errorCount++;
      console.error(`[classify] sentence ${idx} failed: ${err instanceof Error ? err.message.slice(0, 300) : err}`);
      send("sentence", { idx, text, error: publicError(err) }); // shown as "error, retry" — never as fair
    }
  });

  const totalMs = Math.round(performance.now() - started);
  send("done", { totalCost, totalMs, count: sentences.length, cached: cachedCount, errors: errorCount });
  console.log(`[classify] ${sentences.length} sentences, ${cachedCount} cached, ${errorCount} errors, $${totalCost.toFixed(6)}, ${totalMs} ms`);
  res.end();
}

async function explain(req: IncomingMessage, res: ServerResponse) {
  const parsed = ExplainBody.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, `Expected {"text": "...", "categories": [one or more of ${CATEGORIES.join(", ")}]}.`);
  const { text, categories } = parsed.data;
  const model = parsed.data.model ?? config.explainModel;
  if (!EXPLAIN_MODELS.includes(model)) {
    throw new HttpError(400, `That model isn't allowed for explanations. Allowed: ${EXPLAIN_MODELS.join(", ")}.`);
  }

  const key = explainKey(model, text, categories);
  const hit = explainCache.get(key);
  if (hit) return sendJson(res, 200, { ...hit, model, cost: 0, ms: 0, cached: true });

  // Same prompt, validation and retry as the benchmark's pipeline B step 3, with a batch of one.
  const out = await llmExplainBatch([{ id: "s0", text, categories }], { model });
  const result = out.labels.get("s0");
  if (!result) {
    console.error(`[explain] failed: ${out.error ?? "no result"}`);
    return sendJson(res, 502, { error: "The LLM did not return a usable explanation; try again.", cost: out.cost });
  }
  const value = { explanation: result.explanation, agree: result.agree };
  explainCache.set(key, value);
  console.log(`[explain] ${model} $${out.cost.toFixed(6)}, ${Math.round(out.ms)} ms`);
  sendJson(res, 200, { ...value, model, cost: out.cost, ms: Math.round(out.ms), cached: false });
}

// ---------- server ----------

const server = createServer(async (req, res) => {
  const route = `${req.method} ${req.url?.split("?")[0]}`;
  try {
    if (route === "GET /api/health") {
      return sendJson(res, 200, {
        ok: true,
        jevModel: config.jevModel,
        llmModel: config.llmModel,
        explainModel: config.explainModel,
        explainModels: EXPLAIN_MODELS,
        rubricVersion: RUBRIC_VERSION,
        maxSentences: MAX_SENTENCES,
        cached: { jev: jevCache.size, explain: explainCache.size },
      });
    }
    if (route === "POST /api/classify") {
      if (rateLimited(clientIp(req), "classify")) throw new HttpError(429, "Too many analyses from this address; wait a minute.");
      return await classify(req, res);
    }
    if (route === "POST /api/explain") {
      if (rateLimited(clientIp(req), "explain")) throw new HttpError(429, "Too many explanations from this address; wait a minute.");
      return await explain(req, res);
    }
    throw new HttpError(404, `No route ${route}.`);
  } catch (err) {
    if (res.headersSent) {
      res.end(); // mid-stream: the client sees the stream end without "done"
      return;
    }
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    console.error(`[${route}] ${err instanceof Error ? err.message.slice(0, 300) : err}`);
    sendJson(res, 500, { error: publicError(err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Live server on http://${HOST}:${PORT} · Jev ${config.jevModel} · explanations ${config.explainModel} · rubric ${RUBRIC_VERSION}`);
});
