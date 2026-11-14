// Jev playground: small experiments to learn how state + questions behave.
// Run:  npm run play -- <experiment>      e.g.  npm run play -- hello
// Every run prints answers + usage and saves the raw request/response to results/playground/.
//
// Edit the requests below freely: change instructions, criteria, state shape and rerun.
import { mkdirSync, writeFileSync } from "node:fs";
import { callJev, type JevQuestion, type JevRequest } from "../src/openrouter.js";
import rubricFile from "../src/rubric.json" with { type: "json" };

// The 8 category questions (drop the "_note" key).
const { _note, ...rubricRaw } = rubricFile;
const rubric = rubricRaw as Record<string, JevQuestion>;

// A sentence that should trigger 2 categories (choice_of_law + jurisdiction) and nothing else.
const SAMPLE_CLAUSE =
  "These terms are governed by the laws of England and Wales, and any dispute shall be subject to the exclusive jurisdiction of the courts of London.";

type Experiment = () => Promise<void>;

async function run(label: string, req: JevRequest) {
  const { data, ms } = await callJev(req);
  console.log(`\n=== ${label} (${ms.toFixed(0)} ms) ===`);
  for (const [id, answer] of Object.entries(data.answers)) {
    console.log(`  ${id}:`, JSON.stringify(answer));
  }
  console.log("  usage:", JSON.stringify(data.usage));

  mkdirSync("results/playground", { recursive: true });
  const file = `results/playground/${Date.now()}_${label.replace(/\W+/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ request: req, response: data, ms }, null, 2));
  return data;
}

const experiments: Record<string, Experiment> = {
  // The exact example from PROJECT_BRIEF.md.
  hello: async () => {
    await run("hello", {
      state: { clause: "We may change these terms at any time without notice." },
      questions: {
        unilateral_change: {
          type: "noul",
          instructions:
            "Does this clause let the provider change the terms or service on its own, without the user's agreement?",
          criteria: {
            true: "The provider can modify terms or service unilaterally.",
            false: "Changes require notice and consent, or the clause is about something else.",
          },
        },
      },
    });
  },

  // Q: does wrapping the text in a named object change the answer?
  // The object lets instructions refer to `clause` by name; the string version can't.
  "state-shape": async () => {
    const q = rubric.choice_of_law as JevQuestion;
    await run("state-as-object", { state: { clause: SAMPLE_CLAUSE }, questions: { choice_of_law: q } });
    await run("state-as-string", {
      state: SAMPLE_CLAUSE,
      questions: {
        choice_of_law: { ...q, instructions: q.instructions.replace("`clause`", "this clause") },
      },
    });
  },

  // Q: is one call with all 8 questions cheaper/faster than 8 calls with 1 question each?
  // Also checks whether answers differ when questions are asked together vs alone.
  fanout: async () => {
    const state = { clause: SAMPLE_CLAUSE };
    const together = await run("fanout-1-call-8-questions", { state, questions: rubric });

    const started = performance.now();
    const separate = await Promise.all(
      Object.entries(rubric).map(([id, q]) => callJev({ state, questions: { [id]: q } })),
    );
    const wallMs = performance.now() - started;

    const sepCost = separate.reduce((sum, r) => sum + (r.data.usage.cost ?? 0), 0);
    console.log(`\n=== fanout-8-calls-1-question (parallel, ${wallMs.toFixed(0)} ms wall) ===`);
    console.log("  id                        together  separate");
    for (const r of separate) {
      const [id, a] = Object.entries(r.data.answers)[0]!;
      const t = together.answers[id];
      const p = (x: unknown) => (x && typeof x === "object" && "noul" in x ? (x.noul as number).toFixed(3) : "?");
      console.log(`  ${id.padEnd(24)}  ${p(t)}     ${p(a)}`);
    }
    console.log(`  cost: together=${together.usage.cost}  separate(sum)=${sepCost}`);
  },

  // Q: how much does wording matter on BORDERLINE clauses?
  // Each clause is asked a vague and a precise version of the same question.
  "criteria-wording": async () => {
    const cases = [
      {
        label: "jurisdiction-not-arbitration",
        // Names courts, but says nothing about arbitration -> arbitration should be LOW.
        clause: "Any claim arising from these terms shall be brought exclusively in the courts of Santa Clara County, California.",
        id: "arbitration",
        vague: "Is this clause about how disputes are resolved?",
      },
      {
        label: "notice-then-change",
        // Provider changes terms but with notice + right to reject -> borderline unilateral_change.
        clause: "We may amend these terms. We will notify you 30 days in advance and you may close your account if you do not agree.",
        id: "unilateral_change",
        vague: "Is this clause about changing the terms?",
      },
    ];
    for (const c of cases) {
      const state = { clause: c.clause };
      const precise = rubric[c.id] as JevQuestion;
      await run(`${c.label}`, {
        state,
        questions: {
          [`${c.id}_vague`]: { type: "noul", instructions: c.vague },
          [`${c.id}_precise`]: precise,
        },
      });
    }
  },

  // Q: what does each answer type look like for the same clause?
  types: async () => {
    const categories = Object.fromEntries(
      Object.entries(rubric).map(([id, q]) => [id, (q as { criteria?: { true: string } }).criteria?.true ?? null]),
    );
    await run("types", {
      state: { clause: "We may suspend or terminate your account at any time for any reason, without liability to you." },
      questions: {
        // noul: one category, probability of yes
        termination_noul: rubric.unilateral_termination as JevQuestion,
        // choice: forced to pick exactly ONE option, even though this clause hits 2 categories
        main_category: {
          type: "choice",
          instructions: "Which kind of unfair term best describes `clause`?",
          criteria: { ...categories, none: "The clause is fair or fits none of the categories." },
        },
        // score: ordinal levels, index 0..4 (the stretch-goal 'clarity' idea)
        clarity: {
          type: "score",
          instructions: "How clear and specific is `clause` about what the user gives up?",
          criteria: [
            "Crystal clear: precise conditions and consequences.",
            "Mostly clear: minor vagueness.",
            "Somewhat vague: key conditions undefined.",
            "Vague: broad discretion with little detail.",
            "Slippery: open-ended wording that could justify almost anything.",
          ],
        },
      },
    });
  },

  // Q: does surrounding text hurt? Same target sentence, alone vs inside 9 fair neighbours.
  "context-noise": async () => {
    const target = "We may remove any content you post at our sole discretion and without notice.";
    const neighbours = [
      "Welcome to our service.",
      "Please read these terms carefully.",
      "You must be at least 13 years old to create an account.",
      "You are responsible for keeping your password secure.",
      "Our privacy policy explains how we use your data.",
      "You can contact support at any time through the help centre.",
      "We offer free and paid subscription plans.",
      "Paid plans renew monthly unless cancelled.",
      "You may export your data from the settings page.",
    ];
    const q = { content_removal: rubric.content_removal as JevQuestion };
    await run("target-alone", { state: { clause: target }, questions: q });
    const surrounded = [...neighbours.slice(0, 5), target, ...neighbours.slice(5)].join(" ");
    await run("target-in-context", { state: { clause: surrounded }, questions: q });
  },
};

const name = process.argv[2];
const experiment = name ? experiments[name] : undefined;
if (!experiment) {
  console.log(`Usage: npm run play -- <${Object.keys(experiments).join("|")}>`);
  process.exit(1);
}
await experiment();
