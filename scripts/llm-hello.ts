// One LLM call through OpenRouter, logging usage.cost.
// Run:  npm run llm-hello
import { callLlm } from "../src/openrouter.js";
import { config } from "../src/config.js";

const { data, ms } = await callLlm(
  [
    { role: "system", content: "You review Terms of Service clauses. Reply in JSON." },
    {
      role: "user",
      content:
        'Clause: "We may change these terms at any time without notice."\n' +
        'Return {"unilateral_change": boolean, "explanation": string}.',
    },
  ],
  { json: true },
);

console.log(`model: ${config.llmModel} (${ms.toFixed(0)} ms)`);
console.log("content:", data.choices[0]?.message.content);
console.log("usage:", JSON.stringify(data.usage));
