import type { JevQuestion } from "./openrouter.js";
import rubricFile from "./rubric.json" with { type: "json" };

/** The 8 category questions from rubric.json (keys starting with "_" are notes, not questions). */
export const rubric = Object.fromEntries(
  Object.entries(rubricFile).filter(([key]) => !key.startsWith("_")),
) as Record<string, JevQuestion>;

export const CATEGORIES = Object.keys(rubric);

// "_note" starts with the version, e.g. "v1.1. One noul question..." -> "v1.1"
export const RUBRIC_VERSION = (rubricFile as { _note?: string })._note?.match(/^v\d+(?:\.\d+)*/)?.[0] ?? "unknown";
