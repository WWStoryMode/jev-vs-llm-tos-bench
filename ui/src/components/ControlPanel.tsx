import type { CSSProperties } from "react";
import { CATEGORIES } from "../categories";
import type { Measured } from "../types";

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
  measured: Measured;
  openedExplanations: number;
  recomputeMs: number;
  showExpert: boolean;
  onShowExpert: (on: boolean) => void;
  expert: ExpertStats;
};

/** Sentence-level comparison with the expert labels for this document, at the current threshold. */
export type ExpertStats = { unfair: number; fair: number; hits: number; falseAlarms: number; missed: number };

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–");

export const THRESHOLD = { min: 0.3, max: 0.9, step: 0.05, initial: 0.6 };

/** Money with enough digits to see sub-cent amounts. */
function usd(x: number): string {
  if (x === 0) return "$0";
  if (x < 0.01) return `$${x.toFixed(4)}`;
  if (x < 1) return `$${x.toFixed(3)}`;
  return `$${x.toFixed(2)}`;
}

export function ControlPanel(p: Props) {
  const running = p.analysedCount < p.sentenceCount;
  const jev = p.measured.jevCostPerSentence * p.analysedCount;
  const explain = p.measured.explainCostPerFlag * p.openedExplanations;
  const jevTotal = jev + explain;
  const llmOnly = p.measured.llmOnlyCostPerSentence * p.analysedCount;
  const ratio = jevTotal > 0 ? llmOnly / jevTotal : 0;
  const per100k = (perSentence: number) => usd(perSentence * 100_000);

  return (
    <div className="panel-stack">
      <section>
        <div className="panel-head">
          <h2>Sensitivity</h2>
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
          aria-label="Threshold"
          style={{ "--recorded": `${((p.recordedAt - THRESHOLD.min) / (THRESHOLD.max - THRESHOLD.min)) * 100}%` } as CSSProperties}
        />
        <div className="slider-scale">
          <span>more flags</span>
          <span>fewer flags</span>
        </div>
        <p className="stat">
          <strong>{p.flaggedCount}</strong> of {p.sentenceCount} sentences flagged
          {running && <span className="muted"> · {p.analysedCount} analysed so far</span>}
        </p>
        <p className="note">
          Recomputed in your browser from stored probabilities in {p.recomputeMs.toFixed(1)} ms. No API calls.
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
                  onClick={() => p.onFilter(p.filter === c.id ? undefined : c.id)}
                  style={{ "--cat": c.color } as CSSProperties}
                >
                  <span className="swatch" />
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-n">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <label className="toggle">
          <input type="checkbox" checked={p.showExpert} onChange={(e) => p.onShowExpert(e.target.checked)} />
          <span>Expert labels</span>
        </label>
        {p.showExpert && (
          <>
            <dl className="expert-stats">
              <dt>Recall</dt>
              <dd>
                {pct(p.expert.hits, p.expert.unfair)}{" "}
                <span className="muted">
                  ({p.expert.hits} of {p.expert.unfair} unfair found)
                </span>
              </dd>
              <dt>False alarms</dt>
              <dd>
                {pct(p.expert.falseAlarms, p.expert.fair)}{" "}
                <span className="muted">
                  ({p.expert.falseAlarms} of {p.expert.fair} fair flagged)
                </span>
              </dd>
            </dl>
            <ul className="legend">
              <li>
                <span className="legend-box hit" /> hit <span className="muted">· {p.expert.hits}</span>
              </li>
              <li>
                <span className="legend-box false_alarm" /> false alarm <span className="muted">· {p.expert.falseAlarms}</span>
              </li>
              <li>
                <span className="legend-box missed" /> missed <span className="muted">· {p.expert.missed}</span>
              </li>
            </ul>
            <p className="note">For this document, sentence level. Expert labels are sometimes inconsistent.</p>
          </>
        )}
      </section>

      <section>
        <h2>Cost</h2>
        <dl className="cost">
          <dt>{running ? "So far with Jev" : "This document with Jev"}</dt>
          <dd>{usd(jevTotal)}</dd>
          <dt>With LLM only</dt>
          <dd>{usd(llmOnly)}</dd>
        </dl>
        <p className="ratio">×{ratio.toFixed(1)} cheaper</p>
        <p className="note">
          Jev: {p.analysedCount} sentences × {usd(p.measured.jevCostPerSentence)}
          {p.openedExplanations > 0 &&
            ` + ${p.openedExplanations} explanation${p.openedExplanations > 1 ? "s" : ""} opened × ${usd(p.measured.explainCostPerFlag)}`}
          . At 100k sentences: {per100k(p.measured.jevCostPerSentence)} vs {per100k(p.measured.llmOnlyCostPerSentence)}. Measured on
          the recorded runs.
        </p>
      </section>
    </div>
  );
}
