// How a list of sentences is laid out as text: short heading-like lines start a new paragraph.
// Used both to render the analysed document and to fill the textarea from a recording.
import type { ReplaySentence } from "./types";

/** Short lines without trailing , ; : ("changes to terms of use.") read as section headings. */
export function isHeading(displayText: string): boolean {
  const t = displayText.trim();
  return t.split(/\s+/).length <= 6 && !/[;,:]$/.test(t);
}

export type Block = { heading?: ReplaySentence; body: ReplaySentence[] };

export function toBlocks(sentences: ReplaySentence[]): Block[] {
  const blocks: Block[] = [{ body: [] }];
  for (const s of sentences) {
    if (isHeading(s.displayText)) blocks.push({ heading: s, body: [] });
    else blocks[blocks.length - 1]!.body.push(s);
  }
  return blocks.filter((b) => b.heading || b.body.length);
}

/** Plain text of a recording, as it appears in the textarea. */
export function toPlainText(sentences: ReplaySentence[]): string {
  return toBlocks(sentences)
    .map((b) => [b.heading?.displayText, b.body.map((s) => s.displayText).join(" ")].filter(Boolean).join("\n"))
    .join("\n\n");
}

/** Compare texts ignoring whitespace differences, so reflowing a recording still counts as the same text. */
export const sameText = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
