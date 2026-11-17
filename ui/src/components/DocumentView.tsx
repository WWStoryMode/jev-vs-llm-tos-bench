import { useMemo, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { CATEGORY_BY_ID } from "../categories";
import { topCategory, verdict } from "../flags";
import { toBlocks } from "../layout";
import type { ReplaySentence } from "../types";

type Props = {
  sentences: ReplaySentence[];
  flags: Map<string, string[]>; // sentence id -> categories at/above the threshold
  threshold: number;
  filter?: string; // when set, sentences not flagged for this category are dimmed
  showExpert: boolean;
  openId?: string; // sentence whose "Why?" is open
  onWhy: (s: ReplaySentence, anchor: { rect: DOMRect; clickX: number }) => void;
  arrived: Set<string>; // ids that have a Jev result (or an error); the rest are still "in flight"
  onRetry?: (s: ReplaySentence) => void; // Live mode: re-run a sentence whose call failed
};

export const sentenceDomId = (id: string) => `s-${id}`;

const VERDICT_TAG = { hit: "✓ hit", false_alarm: "✗ false alarm", missed: "missed", fair: "" } as const;

export function DocumentView({ sentences, flags, threshold, filter, showExpert, openId, onWhy, arrived, onRetry }: Props) {
  const blocks = useMemo(() => toBlocks(sentences), [sentences]);
  const render = (s: ReplaySentence) => (
    <Sentence
      key={s.id}
      s={s}
      pending={!arrived.has(s.id)}
      onRetry={onRetry}
      flagged={flags.get(s.id) ?? []}
      threshold={threshold}
      filter={filter}
      showExpert={showExpert}
      open={openId === s.id}
      onWhy={onWhy}
    />
  );
  return (
    <article className={`doc${filter ? " filtering" : ""}${showExpert ? " expert" : ""}`}>
      {blocks.map((b, i) => (
        <section key={i}>
          {b.heading && <h3>{render(b.heading)}</h3>}
          {b.body.length > 0 && <p>{b.body.map(render)}</p>}
        </section>
      ))}
    </article>
  );
}

type SentenceProps = {
  s: ReplaySentence;
  pending: boolean;
  onRetry?: Props["onRetry"];
  flagged: string[];
  threshold: number;
  filter?: string;
  showExpert: boolean;
  open: boolean;
  onWhy: Props["onWhy"];
};

function Sentence({ s, pending, onRetry, flagged, threshold, filter, showExpert, open, onWhy }: SentenceProps) {
  if (s.error) {
    // A failed call is never shown as "fair": the sentence keeps a visible marker until it is retried.
    return (
      <span id={sentenceDomId(s.id)} className="s errored" title={s.error}>
        {s.displayText}
        <button className="error-chip" onClick={() => onRetry?.(s)} disabled={!onRetry}>
          error, retry
        </button>{" "}
      </span>
    );
  }
  if (pending) {
    return (
      <span id={sentenceDomId(s.id)} className="s pending">
        {s.displayText}{" "}
      </span>
    );
  }
  const match = !filter || flagged.includes(filter);
  const v = showExpert ? verdict(flagged, s.expert) : "fair";
  const tag =
    v === "missed" ? `missed · ${s.expert.map((c) => CATEGORY_BY_ID.get(c)?.name.toLowerCase() ?? c).join(", ")}` : VERDICT_TAG[v];
  const verdictTag = tag ? <span className={`verdict-tag ${v}`}>{tag}</span> : null;

  if (!flagged.length) {
    return (
      <span id={sentenceDomId(s.id)} className={`s v-${v}`}>
        {s.displayText}
        {verdictTag}{" "}
      </span>
    );
  }

  // Colour: the filtered category if one is selected, otherwise the most probable flagged one.
  const shown = filter && flagged.includes(filter) ? filter : topCategory(s.jev.probs, flagged)!;
  const p = s.jev.probs[shown] ?? 0;
  // Opacity scales with probability: just over the threshold is faint, near 1.0 is strong.
  const alpha = 0.18 + 0.5 * Math.min(1, Math.max(0, (p - threshold) / Math.max(0.01, 1 - threshold)));

  const openWhy = (e: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onWhy(s, { rect, clickX: "clientX" in e && e.clientX ? e.clientX : rect.left });
  };

  return (
    <span
      id={sentenceDomId(s.id)}
      className={`s flagged v-${v}${match ? " match" : ""}${open ? " open" : ""}`}
      style={{ "--cat": CATEGORY_BY_ID.get(shown)?.color, "--alpha": alpha } as CSSProperties}
      role="button"
      tabIndex={0}
      title="Why was this flagged?"
      onClick={openWhy}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), openWhy(e))}
    >
      {s.displayText}
      {flagged.map((c) => (
        <span key={c} className="chip" style={{ "--cat": CATEGORY_BY_ID.get(c)?.color } as CSSProperties}>
          {CATEGORY_BY_ID.get(c)?.name.toLowerCase()} · {(s.jev.probs[c] ?? 0).toFixed(2)}
        </span>
      ))}
      <span className="why-chip">why?</span>
      {verdictTag}{" "}
    </span>
  );
}
