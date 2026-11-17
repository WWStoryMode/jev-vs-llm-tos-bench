import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ControlPanel, THRESHOLD, usd, type CostView, type ExpertStats } from "./components/ControlPanel";
import { DocumentView, sentenceDomId } from "./components/DocumentView";
import { WhyPopover, type ExplainView, type WhyTarget } from "./components/WhyPopover";
import { flaggedAt, verdict } from "./flags";
import { sameText, toPlainText } from "./layout";
import { classifyStream, explainSentence, type ExplainResult } from "./live";
import type { ReplayDoc, ReplayIndex, ReplaySentence } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * One text box for both modes. Loading a recording fills the box; Analyse then either
 * replays the recorded results (text unchanged) or runs live (new or edited text).
 */
type Analysis = { mode: "replay"; doc: ReplayDoc } | { mode: "live" };

/** A live run as it streams in. Sentences start empty (pending) and fill as results arrive, in any order. */
type LiveRun = {
  status: "connecting" | "running" | "done" | "failed";
  sentences: ReplaySentence[];
  arrived: Set<string>;
  costs: Map<string, number>; // real usage.cost per sentence (0 when served from the server cache)
  cachedCount: number;
  startedAt: number;
  elapsedMs: number;
  error?: string;
  jevModel?: string;
  llmModel?: string;
};

type LiveExplain = { status: "loading" } | ({ status: "done" } & ExplainResult) | { status: "error"; message: string };

const liveSentence = (text: string, idx: number): ReplaySentence => ({
  id: `live-${idx}`,
  text,
  displayText: text,
  expert: [],
  jev: { probs: {} },
  llmOnly: { labels: [] },
});
const explainKey = (s: ReplaySentence, categories: string[]) => `${s.text}\u0000${[...categories].sort().join(",")}`;

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
  const closeWhy = useCallback(() => setWhy(undefined), []);
  // The document column scrolls on its own (the page doesn't), so the popover lives inside it.
  const docPanel = useRef<HTMLElement>(null);

  // Replay: saved explanations viewed (each counts at the measured per-flag rate), and the arrival clock.
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [arrivedCount, setArrivedCount] = useState(0);
  const [runId, setRunId] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Live: the streaming run, its abort handle, and explanations fetched on demand.
  const [live, setLive] = useState<LiveRun>();
  const liveAbort = useRef<AbortController>(undefined);
  const [explains, setExplains] = useState<Map<string, LiveExplain>>(new Map());

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
    setExplains(new Map());
    liveAbort.current?.abort();
    if (willReplay) {
      setLive(undefined);
      setAnalysis({ mode: "replay", doc: recording!.doc });
      replay();
    } else {
      setShowExpert(false); // no answer key for pasted text
      setAnalysis({ mode: "live" });
      startLive(text);
    }
  }

  function backToText() {
    liveAbort.current?.abort();
    setAnalysis(undefined);
  }

  // ---------- Replay: arrival animation at the recorded pace ----------

  function replay() {
    setArrivedCount(0);
    setElapsedMs(0);
    setWhy(undefined);
    setRunId((n) => n + 1);
  }

  const replayTotal = analysis?.mode === "replay" ? analysis.doc.sentences.length : 0;

  // `concurrency` calls in flight, each taking the measured per-call time, so sentence i
  // returns at (floor(i / concurrency) + 1) × msPerCall, in document order.
  useEffect(() => {
    if (analysis?.mode !== "replay" || runId === 0) return;
    const { jevMsPerCall, jevConcurrency } = analysis.doc.measured;
    const n = analysis.doc.sentences.length;
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      const ms = performance.now() - started;
      const done = Math.min(n, Math.floor(ms / jevMsPerCall) * jevConcurrency);
      setArrivedCount(done);
      setElapsedMs(done >= n ? Math.ceil(n / jevConcurrency) * jevMsPerCall : ms);
      if (done < n) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analysis, runId]);

  function skip() {
    setRunId(0); // stops the clock
    setArrivedCount(replayTotal);
    if (analysis?.mode === "replay") {
      const { jevMsPerCall, jevConcurrency } = analysis.doc.measured;
      setElapsedMs(Math.ceil(replayTotal / jevConcurrency) * jevMsPerCall);
    }
  }

  // ---------- Live: stream /api/classify ----------

  function startLive(input: string) {
    const ctrl = new AbortController();
    liveAbort.current = ctrl;
    const startedAt = performance.now();
    setLive({ status: "connecting", sentences: [], arrived: new Set(), costs: new Map(), cachedCount: 0, startedAt, elapsedMs: 0 });

    classifyStream(
      input,
      {
        onStart: (e) =>
          setLive((l) => l && { ...l, status: "running", sentences: e.sentences.map(liveSentence), jevModel: e.jevModel, llmModel: e.llmModel }),
        onSentence: (e) =>
          setLive((l) => {
            if (!l) return l;
            const sentences = l.sentences.slice();
            const prev = sentences[e.idx];
            if (!prev) return l;
            const ok = "probs" in e;
            sentences[e.idx] = ok ? { ...prev, jev: { probs: e.probs }, error: undefined } : { ...prev, error: e.error };
            const arrived = new Set(l.arrived).add(prev.id);
            const costs = new Map(l.costs);
            if (ok) costs.set(prev.id, e.cost);
            return {
              ...l,
              sentences,
              arrived,
              costs,
              cachedCount: l.cachedCount + (ok && e.cached ? 1 : 0),
              elapsedMs: performance.now() - l.startedAt,
            };
          }),
        onDone: (e) => setLive((l) => l && { ...l, status: "done", elapsedMs: e.totalMs }),
      },
      ctrl.signal,
    ).catch((err: Error) =>
      setLive((l) => {
        if (!l) return l;
        // Sentences that never came back are marked as errors, never left looking "fair".
        const sentences = l.sentences.map((s) => (l.arrived.has(s.id) ? s : { ...s, error: err.message }));
        return { ...l, status: "failed", error: err.message, sentences, arrived: new Set(sentences.map((s) => s.id)) };
      }),
    );
  }

  /** Re-run one sentence whose call failed (same endpoint, one sentence). */
  async function retrySentence(target: ReplaySentence) {
    setLive((l) => l && { ...l, sentences: l.sentences.map((s) => (s.id === target.id ? { ...s, error: undefined } : s)), arrived: withoutId(l.arrived, target.id) });
    let result: { probs: Record<string, number>; cost: number; cached: boolean } | undefined;
    let failure = "No result returned.";
    try {
      await classifyStream(target.text, {
        onStart: () => {},
        onSentence: (e) => {
          if (e.idx !== 0) return;
          if ("probs" in e) result = { probs: e.probs, cost: e.cost, cached: e.cached };
          else failure = e.error;
        },
        onDone: () => {},
      });
    } catch (err) {
      failure = (err as Error).message;
    }
    setLive((l) => {
      if (!l) return l;
      const sentences = l.sentences.map((s) =>
        s.id !== target.id ? s : result ? { ...s, jev: { probs: result.probs }, error: undefined } : { ...s, error: failure },
      );
      const costs = new Map(l.costs);
      if (result) costs.set(target.id, (costs.get(target.id) ?? 0) + result.cost);
      return { ...l, sentences, costs, arrived: new Set(l.arrived).add(target.id) };
    });
  }

  // ---------- what's on screen (shared by both modes) ----------

  const sentences = analysis?.mode === "replay" ? analysis.doc.sentences : analysis?.mode === "live" ? live?.sentences : undefined;
  const arrived = useMemo(() => {
    if (analysis?.mode === "replay") return new Set(analysis.doc.sentences.slice(0, arrivedCount).map((s) => s.id));
    return live?.arrived ?? new Set<string>();
  }, [analysis, arrivedCount, live?.arrived]);
  const total = sentences?.length ?? 0;
  const running = analysis?.mode === "replay" ? arrived.size < total : live?.status === "connecting" || live?.status === "running";

  // The whole point of the slider: flags are recomputed here from stored probabilities, never fetched.
  const { flags, categoryCounts, flaggedCount, expert, recomputeMs } = useMemo(() => {
    const started = performance.now();
    const flags = new Map<string, string[]>();
    const categoryCounts = new Map<string, number>();
    const expert: ExpertStats = { unfair: 0, fair: 0, hits: 0, falseAlarms: 0, missed: 0 };
    let flaggedCount = 0;
    // Only sentences that have arrived count; the rest are still "in flight". Errors count as neither.
    for (const s of sentences ?? []) {
      if (!arrived.has(s.id) || s.error) continue;
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

  // ---------- cost ----------

  const analysedCount = useMemo(() => (sentences ?? []).filter((s) => arrived.has(s.id) && !s.error).length, [sentences, arrived]);

  const cost: CostView | undefined = useMemo(() => {
    if (analysis?.mode === "replay") {
      const m = analysis.doc.measured;
      const jev = m.jevCostPerSentence * analysedCount;
      const explain = m.explainCostPerFlag * opened.size;
      const per100k = (x: number) => usd(x * 100_000);
      return {
        jev: jev + explain,
        llmOnly: m.llmOnlyCostPerSentence * analysedCount,
        llmOnlyEstimated: false,
        note:
          `${analysedCount} sentences × ${usd(m.jevCostPerSentence)}` +
          (opened.size ? ` + ${opened.size} explanation${opened.size > 1 ? "s" : ""} × ${usd(m.explainCostPerFlag)}` : "") +
          `. Per 100k sentences: ${per100k(m.jevCostPerSentence)} vs ${per100k(m.llmOnlyCostPerSentence)}. Measured on the recorded runs.`,
      };
    }
    if (analysis?.mode === "live" && live) {
      const jev = [...live.costs.values()].reduce((a, b) => a + b, 0);
      const explainDone = [...explains.values()].filter((e): e is Extract<LiveExplain, { status: "done" }> => e.status === "done");
      const explain = explainDone.reduce((a, e) => a + e.cost, 0);
      const chars = live.sentences.filter((s) => live.costs.has(s.id)).reduce((n, s) => n + s.text.length, 0);
      const rate = index?.measured.llmOnlyCostPerChar ?? 0;
      return {
        jev: jev + explain,
        llmOnly: chars * rate,
        llmOnlyEstimated: true,
        note:
          `Real cost from the provider: Jev ${usd(jev)}` +
          (explainDone.length ? ` + ${explainDone.length} explanation${explainDone.length > 1 ? "s" : ""} ${usd(explain)}` : "") +
          (live.cachedCount ? `; ${live.cachedCount} sentences served from cache ($0)` : "") +
          `. LLM-only estimated as text length × the recorded LLM-only rate.`,
      };
    }
    return undefined;
  }, [analysis, analysedCount, opened, live, explains, index]);

  // ---------- "Why?" ----------

  async function fetchExplain(s: ReplaySentence, categories: string[]) {
    const key = explainKey(s, categories);
    setExplains((m) => new Map(m).set(key, { status: "loading" }));
    try {
      const r = await explainSentence(s.text, categories);
      setExplains((m) => new Map(m).set(key, { status: "done", ...r }));
    } catch (err) {
      setExplains((m) => new Map(m).set(key, { status: "error", message: (err as Error).message }));
    }
  }

  function openWhy(s: ReplaySentence, { rect, clickX }: { rect: DOMRect; clickX: number }) {
    // Convert viewport coordinates to the scrolling column's own coordinates.
    const panel = docPanel.current!;
    const box = panel.getBoundingClientRect();
    const top = rect.bottom - box.top + panel.scrollTop + 6;
    const left = Math.max(8, Math.min(clickX - box.left - 40, box.width - 376));
    const flagged = flags.get(s.id) ?? [];
    setWhy({ sentence: s, flagged, top, left });
    if (analysis?.mode === "replay") {
      if (s.jev.explanation) setOpened((prev) => (prev.has(s.id) ? prev : new Set(prev).add(s.id)));
    } else if (flagged.length) {
      const existing = explains.get(explainKey(s, flagged));
      if (!existing || existing.status === "error") fetchExplain(s, flagged); // one LLM call per flag, on demand
    }
  }

  function explainView(target: WhyTarget): ExplainView {
    const s = target.sentence;
    if (analysis?.mode === "replay") {
      if (!s.jev.explanation) return { kind: "missing" };
      return {
        kind: "saved",
        text: s.jev.explanation,
        agree: s.jev.llmAgrees,
        note: `Explained by ${analysis.doc.meta.explainModel || "the LLM"} when this run was recorded (flags at ${analysis.doc.meta.threshold.toFixed(2)}).`,
      };
    }
    const e = explains.get(explainKey(s, target.flagged));
    if (!e || e.status === "loading") return { kind: "loading" };
    if (e.status === "error") return { kind: "error", message: e.message, onRetry: () => fetchExplain(s, target.flagged) };
    return {
      kind: "live",
      text: e.explanation,
      agree: e.agree,
      note: `Explained just now by ${e.model} · ${e.cached ? "cached, $0" : `${usd(e.cost)}, ${(e.ms / 1000).toFixed(1)} s`}.`,
    };
  }

  // In Replay the popover follows the slider; in Live it keeps the categories it was explained for.
  const whyTarget = why && analysis?.mode === "replay" ? { ...why, flagged: flags.get(why.sentence.id) ?? why.flagged } : why;

  // ---------- render ----------

  const progress =
    analysis?.mode === "replay" ? (
      <>
        <span className="source recorded">Replay of a recorded run · {analysis.doc.name}</span>
        <span className={`progress${running ? " running" : ""}`}>
          {running ? "Jev is reading… " : "Done · "}
          {arrived.size}/{total} sentences · {(elapsedMs / 1000).toFixed(1)} s
          <span className="muted">
            {" "}
            ({analysis.doc.measured.jevConcurrency} in flight, ~{analysis.doc.measured.jevMsPerCall} ms each)
          </span>
        </span>
        {running ? <button onClick={skip}>Skip ⏭</button> : <button onClick={replay}>↻ Replay</button>}
      </>
    ) : analysis?.mode === "live" && live ? (
      <>
        <span className="source live">Live · {live.jevModel ?? "Jev"}</span>
        <span className={`progress${running ? " running" : ""}`}>
          {live.status === "connecting"
            ? "Connecting…"
            : `${running ? "Jev is reading… " : live.status === "failed" ? "Stopped · " : "Done · "}${arrived.size}/${total} sentences · ${(live.elapsedMs / 1000).toFixed(1)} s`}
          {live.cachedCount > 0 && <span className="muted"> · {live.cachedCount} from cache</span>}
        </span>
      </>
    ) : null;

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
                {!willReplay && text.trim() && <span className="note">Live runs call Jev for real (about $0.00005 per sentence).</span>}
              </div>
            </div>
          ) : (
            <div className="result">
              <div className="input-bar">
                <button onClick={backToText}>← Edit text</button>
                {progress}
              </div>
              {live?.status === "failed" && <p className="error">{live.error}</p>}
              {sentences && sentences.length > 0 && (
                <DocumentView
                  sentences={sentences}
                  flags={flags}
                  threshold={threshold}
                  filter={filter}
                  showExpert={showExpert && analysis.mode === "replay"}
                  openId={why?.sentence.id}
                  arrived={arrived}
                  onRetry={analysis.mode === "live" ? retrySentence : undefined}
                  onWhy={openWhy}
                />
              )}
            </div>
          )}
          {error && <p className="error">{error}</p>}
          {whyTarget && analysis && (
            <WhyPopover target={whyTarget} explain={explainView(whyTarget)} showExpert={showExpert && analysis.mode === "replay"} onClose={closeWhy} />
          )}
        </section>

        <aside className="control-panel">
          {analysis && cost && sentences && sentences.length > 0 ? (
            <ControlPanel
              threshold={threshold}
              onThreshold={setThreshold}
              recordedAt={analysis.mode === "replay" ? analysis.doc.meta.threshold : THRESHOLD.initial}
              sentenceCount={total}
              analysedCount={running ? analysedCount : total}
              flaggedCount={flaggedCount}
              categoryCounts={categoryCounts}
              filter={filter}
              onFilter={chooseFilter}
              cost={cost}
              recomputeMs={recomputeMs}
              expertAvailable={analysis.mode === "replay"}
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
        Expert labels: UNFAIR-ToS (EU consumer law, 2019), sometimes inconsistent. Not legal advice. · Model: {index?.meta.jevModel ?? "…"},
        rubric {index?.meta.rubricVersion ?? "…"}.
      </footer>
    </div>
  );
}

function withoutId(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
