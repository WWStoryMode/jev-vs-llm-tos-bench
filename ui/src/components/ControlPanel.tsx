import type { CSSProperties } from "react";
import { CATEGORIES } from "../categories";

type Props = {
  threshold: number;
  onThreshold: (t: number) => void;
  recordedAt: number; // threshold the saved explanations were recorded at
  sentenceCount: number;
  analysedCount: number; // < sentenceCount while the arrival animation runs
  flaggedCount: number;
  categoryCounts: Map<string, number>;
  filter?: string;
  onFilter: (category?: string) => void;
  cost: CostView;
  recomputeMs: number;
  expertAvailable: boolean; // false in Live mode: there is no answer key
  showExpert: boolean;
  onShowExpert: (on: boolean) => void;
  expert: ExpertStats;
  whyModels: string[]; // models that can explain a flag ("Why?")
  whyChoice: string; // one of whyModels, or COMPARE
  onWhyChoice: (choice: string) => void;
  whyIsLive: boolean; // Live: the choice decides which model is called (and paid for)
};

/** "Why?" choice that shows every model's explanation side by side. */
export const COMPARE = "compare";

/** Costs worked out by the caller: measured rates (Replay) or real usage.cost totals (Live). */
export type CostView = {
  jev: number; // Jev calls plus explanations opened
  llmOnly: { model: string; cost: number }[]; // one tile per LLM-only baseline
  llmOnlyEstimated: boolean;
  note: string;
};

/** "anthropic/claude-haiku-5.5" -> "Haiku 5.5" */
export function shortModel(id: string): string {
  const name = id.split("/").pop()!.replace(/^claude-/, "").replace(/-(?=\d)/, " ");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** How Jev compares with one LLM-only baseline, said both ways round so it is never misleading. */
function compare(jev: number, llm: number): { text: string; cheaper: boolean } | undefined {
  if (jev <= 0 || llm <= 0) return undefined;
  return llm >= jev ? { text: `Jev ${(llm / jev).toFixed(1)}× cheaper`, cheaper: true } : { text: `Jev ${(jev / llm).toFixed(1)}× pricier`, cheaper: false };
}

/** Sentence-level comparison with the expert labels for this document, at the current threshold. */
export type ExpertStats = { unfair: number; fair: number; hits: number; falseAlarms: number; missed: number };

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");

export const THRESHOLD = { min: 0.3, max: 0.9, step: 0.05, initial: 0.6 };

/** Money with enough digits to see sub-cent amounts. */
export function usd(x: number): string {
  if (x === 0) return "$0";
  if (x < 0.01) return `$${x.toFixed(4)}`;
  if (x < 1) return `$${x.toFixed(3)}`;
  return `$${x.toFixed(2)}`;
}

/** Compact by design: the whole panel should fit on a 720p projector without scrolling. */
export function ControlPanel(p: Props) {
  const running = p.analysedCount < p.sentenceCount;
  const { jev, llmOnly } = p.cost;

  return (
    <div className="panel-stack">
      <section>
        <div className="panel-head">
          <h2>Sensitivity threshold</h2>
          <span className="big">{p.threshold.toFixed(2)}</span>
        </div>
        <input
          type="range"
          className="slider"
          min={THRESHOLD.min}
          max={THRESHOLD.max}
          step={THRESHOLD.step}
          value={p.threshold}
          onChange={(e) => p.onThreshold(Number(e.target.value))}
          aria-label="Sensitivity threshold"
          style={{ "--recorded": `${((p.recordedAt - THRESHOLD.min) / (THRESHOLD.max - THRESHOLD.min)) * 100}%` } as CSSProperties}
        />
        <div className="slider-scale">
          <span>more flags</span>
          <span>fewer flags</span>
        </div>
        <p className="stat">
          <strong>{p.flaggedCount}</strong> of {p.sentenceCount} flagged
          {running && <span className="muted"> · {p.analysedCount} read</span>}
          <span className="muted" title="Recomputed in your browser from stored probabilities">
            {" "}
            · {p.recomputeMs.toFixed(1)} ms, no API calls
          </span>
        </p>
      </section>

      <section>
        <div className="panel-head">
          <h2>Categories</h2>
          {p.filter && (
            <button className="link" onClick={() => p.onFilter(undefined)}>
              show all
            </button>
          )}
        </div>
        <ul className="cats">
          {CATEGORIES.map((c) => {
            const n = p.categoryCounts.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <button
                  className={`cat${p.filter === c.id ? " active" : ""}`}
                  disabled={n === 0}
                  title={c.name}
                  onClick={() => p.onFilter(p.filter === c.id ? undefined : c.id)}
                  style={{ "--cat": c.color } as CSSProperties}
                >
                  <span className="swatch" />
                  <span className="cat-name">{c.short}</span>
                  <span className="cat-n">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {p.expertAvailable && (
      <section>
        <label className="toggle">
          <input type="checkbox" checked={p.showExpert} onChange={(e) => p.onShowExpert(e.target.checked)} />
          <span>Expert labels</span>
        </label>
        {p.showExpert && (
          <>
            <p className="expert-line">
              Recall <strong>{pct(p.expert.hits, p.expert.unfair)}</strong>{" "}
              <span className="muted">
                ({p.expert.hits}/{p.expert.unfair})
              </span>
              {" · "}False alarms <strong>{pct(p.expert.falseAlarms, p.expert.fair)}</strong>{" "}
              <span className="muted">
                ({p.expert.falseAlarms}/{p.expert.fair})
              </span>
            </p>
            <ul className="legend" title="This document, sentence level">
              <li>
                <span className="legend-box hit" /> hit {p.expert.hits}
              </li>
              <li>
                <span className="legend-box false_alarm" /> false alarm {p.expert.falseAlarms}
              </li>
              <li>
                <span className="legend-box missed" /> missed {p.expert.missed}
              </li>
            </ul>
          </>
        )}
      </section>
      )}

      {p.whyModels.length > 0 && (
        <section>
          <h2>"Why?" explained by</h2>
          <div className="segmented" role="radiogroup" aria-label='"Why?" explained by'>
            {[...p.whyModels, ...(p.whyModels.length > 1 ? [COMPARE] : [])].map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={p.whyChoice === m}
                className={p.whyChoice === m ? "on" : ""}
                onClick={() => p.onWhyChoice(m)}
                title={m === COMPARE ? "Show every model's explanation" : m}
              >
                {m === COMPARE ? "Compare" : shortModel(m)}
              </button>
            ))}
          </div>
          {p.whyIsLive && p.whyChoice === COMPARE && <p className="note compact">Compare calls each model once per flag.</p>}
        </section>
      )}

      <section>
        <h2>Cost {running ? "so far" : "for this document"}</h2>
        <div className="cost-tiles" style={{ gridTemplateColumns: `repeat(${1 + llmOnly.length}, 1fr)` }}>
          <div className="tile-jev">
            <span className="tile-label">Jev</span>
            <span className="tile-value">{usd(jev)}</span>
            {jev === 0 && llmOnly.some((l) => l.cost > 0) && <span className="tile-cmp">cached</span>}
          </div>
          {llmOnly.map((l) => {
            const c = compare(jev, l.cost);
            return (
              <div key={l.model} title={l.model}>
                <span className="tile-label">
                  {shortModel(l.model)} only{p.cost.llmOnlyEstimated ? " (est.)" : ""}
                </span>
                <span className="tile-value">{usd(l.cost)}</span>
                {c && <span className={`tile-cmp ${c.cheaper ? "good" : "bad"}`}>{c.text}</span>}
              </div>
            );
          })}
        </div>
        <p className="note compact">{p.cost.note}</p>
      </section>
    </div>
  );
}
