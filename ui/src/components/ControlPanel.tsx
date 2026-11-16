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

/** Compact by design: the whole panel should fit on a 720p projector without scrolling. */
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

      <section>
        <h2>Cost {running ? "so far" : "for this document"}</h2>
        <div className="cost-tiles">
          <div>
            <span className="tile-label">Jev</span>
            <span className="tile-value">{usd(jevTotal)}</span>
          </div>
          <div>
            <span className="tile-label">LLM only</span>
            <span className="tile-value">{usd(llmOnly)}</span>
          </div>
          <div className="tile-ratio">
            <span className="tile-label">cheaper</span>
            <span className="tile-value">×{ratio.toFixed(1)}</span>
          </div>
        </div>
        <p className="note compact">
          {p.analysedCount} sentences × {usd(p.measured.jevCostPerSentence)}
          {p.openedExplanations > 0 &&
            ` + ${p.openedExplanations} explanation${p.openedExplanations > 1 ? "s" : ""} × ${usd(p.measured.explainCostPerFlag)}`}
          . Per 100k sentences: {per100k(p.measured.jevCostPerSentence)} vs {per100k(p.measured.llmOnlyCostPerSentence)}.
        </p>
      </section>
    </div>
  );
}
