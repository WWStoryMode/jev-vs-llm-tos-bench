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
  baseUrl: "https://openrouter.ai/api/v1",
};
