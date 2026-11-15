// LLM side: pipeline A (label + explain batches of sentences) and pipeline B step 3 (explain what Jev flagged).
// The prompt is built from rubric.json so both pipelines use IDENTICAL category definitions.
import { z } from "zod";
import { callLlm } from "./openrouter.js";
import { CATEGORIES, rubric } from "./rubric.js";

// ---------- prompt ----------

function rubricText(): string {
  return CATEGORIES.map((c) => {
    const q = rubric[c]!;
    const crit = "criteria" in q && q.criteria && !Array.isArray(q.criteria) ? (q.criteria as { true?: string; false?: string }) : {};
    // `clause` in the rubric refers to Jev's state field; for the LLM it means "the sentence".
    const instr = q.instructions.replaceAll("`clause`", "the sentence");
    return `- ${c}\n  Question: ${instr}\n  Yes when: ${crit.true ?? ""}\n  No when: ${crit.false ?? ""}`;
  }).join("\n");
}

export const SYSTEM_PROMPT = `You review Terms of Service sentences for potentially unfair terms under EU consumer law.

For each sentence, decide which of these 8 categories apply. A sentence can have zero, one, or several categories. Most sentences have none.

Categories (answer each question about the sentence itself):
${rubricText()}

Sentences are given in document order with ids; use neighbouring sentences only to understand references like "these actions" or "those courts", but label each sentence on its own.

Respond with JSON only, no prose, in exactly this shape:
{"results": [{"id": "<id>", "labels": ["<category>", ...], "explanation": "<one short sentence>"}]}

Rules:
- Include every id exactly once, in the given order.
- "labels" uses only these category names: ${CATEGORIES.join(", ")}. Use [] for a fair sentence.
- "explanation": one short sentence saying why the sentence is unfair and to whom; use "" when labels is [].`;

// ---------- response validation ----------

const ResultSchema = z.object({
  id: z.string(),
  labels: z.array(z.enum(CATEGORIES as [string, ...string[]])),
  explanation: z.string(),
});
const ResponseSchema = z.object({ results: z.array(ResultSchema) });
export type LlmLabel = z.infer<typeof ResultSchema>;

/** Pull a JSON object out of the reply (tolerates ```json fences or stray text around it). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object in reply");
  return JSON.parse(text.slice(start, end + 1));
}

export type BatchOutcome<T = LlmLabel> = {
  labels: Map<string, T>; // id -> parsed result (only valid ids)
  cost: number;
  ms: number;
  attempts: number;
  malformed: number; // replies that failed parsing/validation/id check
  error?: string; // set when the batch still failed after retries
};

/**
 * Shared call-validate-retry loop: send one batch, parse the reply with zod, check that every id comes back
 * exactly once. A malformed reply is retried; if it still fails, the batch is reported as failed (never as "fair").
 */
async function callBatch<T extends { id: string }>(
  system: string,
  user: string,
  ids: string[],
  schema: z.ZodType<{ results: T[] }>,
  opts: { maxAttempts: number; maxTokens: number },
): Promise<BatchOutcome<T>> {
  let cost = 0;
  let ms = 0;
  let malformed = 0;
  let lastError = "";
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const { data, ms: callMs } = await callLlm(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { json: true, temperature: 0, maxTokens: opts.maxTokens },
    );
    cost += data.usage.cost ?? 0;
    ms += callMs;
    try {
      const reply = data.choices[0]?.message.content ?? "";
      const parsed = schema.parse(extractJson(reply));
      const byId = new Map(parsed.results.map((r) => [r.id, r]));
      const missing = ids.filter((id) => !byId.has(id));
      if (missing.length || parsed.results.length !== ids.length) {
        throw new Error(`ids mismatch: ${parsed.results.length} results for ${ids.length} sentences; missing ${missing.slice(0, 5).join(", ")}`);
      }
      return { labels: byId, cost, ms, attempts: attempt, malformed };
    } catch (err) {
      malformed++;
      lastError = String(err).slice(0, 500);
    }
  }
  return { labels: new Map(), cost, ms, attempts: opts.maxAttempts, malformed, error: lastError };
}

/** Pipeline A: label + explain one batch of consecutive sentences. */
export function llmLabelBatch(batch: { id: string; text: string }[], opts: { maxAttempts?: number } = {}): Promise<BatchOutcome> {
  const user = `Label these ${batch.length} sentences:\n\n${batch.map((s) => `[${s.id}] ${s.text.trim()}`).join("\n")}`;
  return callBatch(SYSTEM_PROMPT, user, batch.map((s) => s.id), ResponseSchema, {
    maxAttempts: opts.maxAttempts ?? 2,
    maxTokens: 4000 + batch.length * 80,
  });
}

// ---------- pipeline B step 3: explain what Jev flagged ----------

export const EXPLAIN_PROMPT = `You review Terms of Service sentences for potentially unfair terms under EU consumer law.

A fast classifier has already flagged each sentence below with one or more of these categories:
${rubricText()}

For each sentence, write a short explanation for a consumer of why the flagged categories make it potentially unfair and to whom. Also say whether you agree that at least one flagged category really applies to the sentence itself.

Sentences are flagged ones only, not consecutive, so judge each on its own.

Respond with JSON only, no prose, in exactly this shape:
{"results": [{"id": "<id>", "agree": true, "explanation": "<one short sentence>"}]}

Rules:
- Include every id exactly once, in the given order.
- "explanation": one short sentence about the flagged categories. If you disagree, say briefly why the sentence may be fair.`;

const ExplainSchema = z.object({
  results: z.array(z.object({ id: z.string(), agree: z.boolean(), explanation: z.string() })),
});
export type LlmExplanation = z.infer<typeof ExplainSchema>["results"][number];

/** Pipeline B step 3: explain a batch of Jev-flagged sentences, given Jev's categories. Labels stay Jev's. */
export function llmExplainBatch(
  batch: { id: string; text: string; categories: string[] }[],
  opts: { maxAttempts?: number } = {},
): Promise<BatchOutcome<LlmExplanation>> {
  const lines = batch.map((s) => `[${s.id}] (flagged: ${s.categories.join(", ")}) ${s.text.trim()}`);
  const user = `Explain these ${batch.length} flagged sentences:\n\n${lines.join("\n")}`;
  return callBatch(EXPLAIN_PROMPT, user, batch.map((s) => s.id), ExplainSchema, {
    maxAttempts: opts.maxAttempts ?? 2,
    maxTokens: 2000 + batch.length * 80,
  });
}
