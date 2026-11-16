// The 8 rubric categories in rubric order, with display names from the dataset and a highlight colour each.
import labelNames from "../../data/label_names.json";

export type Category = { id: string; name: string; color: string };

// Distinct hues that read as highlights on both light and dark backgrounds (opacity is added per sentence).
const COLORS: Record<string, string> = {
  limitation_of_liability: "#e4572e",
  unilateral_termination: "#c03fbf",
  unilateral_change: "#f0a202",
  content_removal: "#2e86de",
  contract_by_using: "#17a589",
  choice_of_law: "#8e6cdf",
  jurisdiction: "#5d9c3b",
  arbitration: "#d6336c",
};

export const CATEGORIES: Category[] = labelNames.map((l) => ({ id: l.rubricId, name: l.name, color: COLORS[l.rubricId] ?? "#888" }));
export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
