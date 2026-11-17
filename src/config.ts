import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env (see .env.example)`);
  return value;
}

export const config = {
  apiKey: required("OPENROUTER_API_KEY"),
  jevModel: process.env.JEV_MODEL ?? "typesafe/jev-1.13",
  llmModel: process.env.LLM_MODEL ?? "anthropic/claude-sonnet-5.5",
  // Writes "Why?" explanations in the UI server and scripts/reexplain.ts; the eval's pipeline B still uses LLM_MODEL.
  // Haiku 5.5 by default: explanations as useful as Sonnet 5.5's at about 1/13 of the cost (NOTES.md, 2026-11-17).
  explainModel: process.env.EXPLAIN_MODEL ?? "anthropic/claude-haiku-5.5",
  // Models the UI may ask the server to explain with (comma-separated). The browser can't choose any other.
  explainModels: (process.env.EXPLAIN_MODELS ?? "anthropic/claude-haiku-5.5,anthropic/claude-sonnet-5.5")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
  baseUrl: "https://openrouter.ai/api/v1",
};
