import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControlPanel, THRESHOLD, type ExpertStats } from "./components/ControlPanel";
import { DocumentView, sentenceDomId } from "./components/DocumentView";
import { WhyPopover, type WhyTarget } from "./components/WhyPopover";
import { flaggedAt, verdict } from "./flags";
import { sameText, toPlainText } from "./layout";
import type { ReplayDoc, ReplayIndex } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * One text box for both modes. Loading a recording fills the box; Analyse then either
 * replays the recorded results (text unchanged) or runs live (new or edited text, Phase 2).
 */
type Analysis = { mode: "replay"; doc: ReplayDoc } | { mode: "live" };

export function App() {
  const [index, setIndex] = useState<ReplayIndex>();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState<{ doc: ReplayDoc; text: string }>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [loadingSlug, setLoadingSlug] = useState<string>();
  const [error, setError] = useState<string>();
  const [threshold, setThreshold] = useState(THRESHOLD.initial);
  const [filter, setFilter] = useState<string>();
  const [showExpert, setShowExpert] = useState(false);
  const [why, setWhy] = useState<WhyTarget>();
  // Explanations viewed so far; each one counts toward cost (an LLM call in a live run).
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const closeWhy = useCallback(() => setWhy(undefined), []);
  // The document column scrolls on its own (the page doesn't), so the popover lives inside it.
  const docPanel = useRef<HTMLElement>(null);
  // Arrival animation: how many sentences have "returned" from Jev, and a run id to restart it.
  const [arrived, setArrived] = useState(0);
  const [runId, setRunId] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    getJson<ReplayIndex>("/replay/index.json").then(setIndex).catch((e) => setError(String(e)));
  }, []);

  async function loadRecording(slug: string) {
    if (!slug) return;
    setError(undefined);
    setLoadingSlug(slug);
    try {
      const doc = await getJson<ReplayDoc>(`/replay/${slug}.json`);
      const plain = toPlainText(doc.sentences);
      setRecording({ doc, text: plain });
      setText(plain);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingSlug(undefined);
    }
  }

  // Replay only when the box still holds the recording's text; any edit makes it a live run.
  const matchesRecording = useMemo(() => !!recording && sameText(text, recording.text), [text, recording]);
  const willReplay = matchesRecording && !!recording;

  function analyse() {
    setFilter(undefined);
    setWhy(undefined);
    setOpened(new Set());
    setAnalysis(willReplay ? { mode: "replay", doc: recording!.doc } : { mode: "live" });
    replay();
  }

  function replay() {
    setArrived(0);
    setElapsedMs(0);
    setWhy(undefined);
    setRunId((n) => n + 1);
  }

  const total = analysis?.mode === "replay" ? analysis.doc.sentences.length : 0;
  const running = total > 0 && arrived < total;

  // Replays the recorded run's pace: `concurrency` calls in flight, each taking the measured
  // per-call time, so sentence i returns at (floor(i / concurrency) + 1) × msPerCall. Document order.
  useEffect(() => {
    if (analysis?.mode !== "replay" || runId === 0) return;
    const { jevMsPerCall, jevConcurrency } = analysis.doc.measured;
    const n = analysis.doc.sentences.length;
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const ms = performance.now() - started;
      const done = Math.min(n, Math.floor(ms / jevMsPerCall) * jevConcurrency);
      setArrived(done);
      setElapsedMs(done >= n ? Math.ceil(n / jevConcurrency) * jevMsPerCall : ms);
      if (done < n) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analysis, runId]);

  function skip() {
    setRunId(0); // stops the clock
    setArrived(total);
    if (analysis?.mode === "replay") {
      const { jevMsPerCall, jevConcurrency } = analysis.doc.measured;
      setElapsedMs(Math.ceil(total / jevConcurrency) * jevMsPerCall);
    }
  }

  const sentences = analysis?.mode === "replay" ? analysis.doc.sentences : undefined;

  // The whole point of the slider: flags are recomputed here from stored probabilities, never fetched.
  const { flags, categoryCounts, flaggedCount, expert, recomputeMs } = useMemo(() => {
    const started = performance.now();
    const flags = new Map<string, string[]>();
    const categoryCounts = new Map<string, number>();
    const expert: ExpertStats = { unfair: 0, fair: 0, hits: 0, falseAlarms: 0, missed: 0 };
    let flaggedCount = 0;
    // Only sentences that have arrived count; the rest are still "in flight".
    for (const s of (sentences ?? []).slice(0, arrived)) {
      const f = flaggedAt(s.jev.probs, threshold);
      flags.set(s.id, f);
      if (f.length) flaggedCount++;
      for (const c of f) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
      if (s.expert.length) expert.unfair++;
      else expert.fair++;
      const v = verdict(f, s.expert);
      if (v === "hit") expert.hits++;
      else if (v === "false_alarm") expert.falseAlarms++;
      else if (v === "missed") expert.missed++;
    }
    return { flags, categoryCounts, flaggedCount, expert, recomputeMs: performance.now() - started };
  }, [sentences, threshold, arrived]);

  // A filtered category that no longer has flags at the new threshold is dropped.
  useEffect(() => {
    if (filter && !categoryCounts.get(filter)) setFilter(undefined);
  }, [filter, categoryCounts]);

  function chooseFilter(category?: string) {
    setFilter(category);
    if (!category || !sentences) return;
    const first = sentences.find((s) => flags.get(s.id)?.includes(category));
    if (first) document.getElementById(sentenceDomId(first.id))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="app">
      <header className="top">
        <h1>Small Print Radar</h1>
        <p className="tagline">Jev decides, the LLM explains.</p>
      </header>

      <main className="layout">
        <section className="doc-panel" ref={docPanel}>
          {!analysis ? (
            <div className="input">
              <div className="input-bar">
                <select value="" onChange={(e) => loadRecording(e.target.value)} disabled={!index}>
                  <option value="">{loadingSlug ? "Loading…" : "Load a recorded T&C…"}</option>
                  {index?.documents.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name} ({d.sentences} sentences)
                    </option>
                  ))}
                </select>
                {recording && (
                  <span className={`source ${matchesRecording ? "recorded" : "edited"}`}>
                    {matchesRecording ? `Recorded: ${recording.doc.name}` : "Edited — will run live"}
                  </span>
                )}
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste Terms & Conditions here, or load a recorded one above."
                spellCheck={false}
              />
              <div className="input-bar">
                <button className="primary" onClick={analyse} disabled={!text.trim()}>
                  {willReplay ? "Analyse (replay recorded run)" : "Analyse (live)"}
                </button>
                {text && (
                  <button
                    onClick={() => {
                      setText("");
                      setRecording(undefined);
                    }}
                  >
                    Clear
                  </button>
                )}
                {recording && matchesRecording && <span className="note">Recorded text is lowercased (UNFAIR-ToS source).</span>}
              </div>
            </div>
          ) : (
            <div className="result">
              <div className="input-bar">
                <button onClick={() => setAnalysis(undefined)}>← Edit text</button>
                {analysis.mode === "replay" && (
                  <>
                    <span className="source recorded">Replay of a recorded run · {analysis.doc.name}</span>
                    <span className={`progress${running ? " running" : ""}`}>
                      {running ? "Jev is reading… " : "Done · "}
                      {arrived}/{total} sentences · {(elapsedMs / 1000).toFixed(1)} s
                      <span className="muted">
                        {" "}
                        ({analysis.doc.measured.jevConcurrency} in flight, ~{analysis.doc.measured.jevMsPerCall} ms each)
                      </span>
                    </span>
                    {running ? <button onClick={skip}>Skip ⏭</button> : <button onClick={replay}>↻ Replay</button>}
                  </>
                )}
              </div>
              {analysis.mode === "replay" ? (
                <DocumentView
                  sentences={analysis.doc.sentences}
                  flags={flags}
                  threshold={threshold}
                  filter={filter}
                  showExpert={showExpert}
                  openId={why?.sentence.id}
                  arrived={arrived}
                  onWhy={(s, { rect, clickX }) => {
                    // Convert viewport coordinates to the scrolling column's own coordinates.
                    const panel = docPanel.current!;
                    const box = panel.getBoundingClientRect();
                    const top = rect.bottom - box.top + panel.scrollTop + 6;
                    const left = Math.max(8, Math.min(clickX - box.left - 40, box.width - 376));
                    setWhy({ sentence: s, flagged: flags.get(s.id) ?? [], top, left });
                    if (s.jev.explanation) setOpened((prev) => (prev.has(s.id) ? prev : new Set(prev).add(s.id)));
                  }}
                />
              ) : (
                <p className="notice">
                  Live analysis needs the local server (<code>npm run server:dev</code>) and arrives in Phase 2. Load a recorded
                  T&amp;C to see a replay.
                </p>
              )}
            </div>
          )}
          {error && <p className="error">{error}</p>}
          {why && analysis?.mode === "replay" && (
            <WhyPopover
              // keep the categories in step with the slider while the popover is open
              target={{ ...why, flagged: flags.get(why.sentence.id) ?? why.flagged }}
              recordedAt={analysis.doc.meta.threshold}
              explainModel={analysis.doc.meta.explainModel}
              showExpert={showExpert}
              onClose={closeWhy}
            />
          )}
        </section>

        <aside className="control-panel">
          {analysis?.mode === "replay" ? (
            <ControlPanel
              threshold={threshold}
              onThreshold={setThreshold}
              recordedAt={analysis.doc.meta.threshold}
              sentenceCount={analysis.doc.sentences.length}
              analysedCount={arrived}
              flaggedCount={flaggedCount}
              categoryCounts={categoryCounts}
              filter={filter}
              onFilter={chooseFilter}
              measured={analysis.doc.measured}
              openedExplanations={opened.size}
              recomputeMs={recomputeMs}
              showExpert={showExpert}
              onShowExpert={setShowExpert}
              expert={expert}
            />
          ) : (
            <div className="panel-stack">
              <section>
                <h2>How it works</h2>
                <p className="note">
                  Jev scores every sentence against 8 unfair-term questions. You choose how sensitive the flagging is; an LLM
                  explains a flag only when you ask why.
                </p>
              </section>
            </div>
          )}
        </aside>
      </main>

      <footer className="footer">
        Expert labels: UNFAIR-ToS (EU consumer law, 2019), sometimes inconsistent. Not legal advice. · Model: {index?.meta.jevModel ?? "…"}, rubric{" "}
        {index?.meta.rubricVersion ?? "…"}.
      </footer>
    </div>
  );
}
