// LLM side: pipeline A (label + explain batches of sentences) and, later, explanations for pipeline B.
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

export type BatchOutcome = {
  labels: Map<string, LlmLabel>; // id -> parsed result (only valid ids)
  cost: number;
  ms: number;
  attempts: number;
  malformed: number; // replies that failed parsing/validation/id check
  error?: string; // set when the batch still failed after retries
};

/**
 * Label one batch of consecutive sentences. Validates with zod and checks that every id comes back exactly once.
 * A malformed reply is retried once; if it fails again the batch is reported as failed (counted, never as "fair").
 */
export async function llmLabelBatch(
  batch: { id: string; text: string }[],
  opts: { maxAttempts?: number } = {},
): Promise<BatchOutcome> {
  const maxAttempts = opts.maxAttempts ?? 2;
  const user = batch.map((s) => `[${s.id}] ${s.text.trim()}`).join("\n");
  let cost = 0;
  let ms = 0;
  let malformed = 0;
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { data, ms: callMs } = await callLlm(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Label these ${batch.length} sentences:\n\n${user}` },
      ],
      { json: true, temperature: 0, maxTokens: 4000 + batch.length * 80 },
    );
    cost += data.usage.cost ?? 0;
    ms += callMs;
    try {
      const reply = data.choices[0]?.message.content ?? "";
      const parsed = ResponseSchema.parse(extractJson(reply));
      const byId = new Map(parsed.results.map((r) => [r.id, r]));
      const missing = batch.filter((s) => !byId.has(s.id)).map((s) => s.id);
      if (missing.length || parsed.results.length !== batch.length) {
        throw new Error(`ids mismatch: ${parsed.results.length} results for ${batch.length} sentences; missing ${missing.slice(0, 5).join(", ")}`);
      }
      return { labels: byId, cost, ms, attempts: attempt, malformed };
    } catch (err) {
      malformed++;
      lastError = String(err).slice(0, 500);
    }
  }
  return { labels: new Map(), cost, ms, attempts: maxAttempts, malformed, error: lastError };
}
