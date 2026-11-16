import { useEffect, useRef, type CSSProperties } from "react";
import { CATEGORY_BY_ID } from "../categories";
import type { ReplaySentence } from "../types";

export type WhyTarget = { sentence: ReplaySentence; flagged: string[]; top: number; left: number };

type Props = {
  target: WhyTarget;
  recordedAt: number; // threshold the saved explanations were made at
  explainModel: string;
  showExpert: boolean;
  onClose: () => void;
};

/** "Why?" on a flag: the saved LLM explanation, or an honest note when this recording has none. */
export function WhyPopover({ target, recordedAt, explainModel, showExpert, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { sentence: s, flagged } = target;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      // clicks on another flag re-target the popover (handled by that flag), so don't close for those
      if (!ref.current?.contains(el) && !el.closest(".s.flagged")) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="why" role="dialog" aria-label="Why was this flagged?" style={{ top: target.top, left: target.left }}>
      <div className="why-head">
        <strong>Why?</strong>
        <button className="link" onClick={onClose} aria-label="Close">
          close
        </button>
      </div>
      <ul className="why-cats">
        {flagged.map((c) => (
          <li key={c} style={{ "--cat": CATEGORY_BY_ID.get(c)?.color } as CSSProperties}>
            <span className="swatch" /> {CATEGORY_BY_ID.get(c)?.name} <span className="muted">· {(s.jev.probs[c] ?? 0).toFixed(2)}</span>
          </li>
        ))}
      </ul>

      {s.jev.explanation ? (
        <>
          <p className="why-text">{s.jev.explanation}</p>
          {s.jev.llmAgrees === false && (
            <p className="why-disagree">The LLM doubted this flag: it did not agree a flagged category really applies.</p>
          )}
          <p className="note">
            Explained by {explainModel || "the LLM"} when this run was recorded (flags at {recordedAt.toFixed(2)}).
          </p>
        </>
      ) : (
        <p className="why-missing">Not explained in this recording — available in Live mode.</p>
      )}

      {showExpert && (
        <p className="note">
          Experts:{" "}
          {s.expert.length ? s.expert.map((c) => CATEGORY_BY_ID.get(c)?.name ?? c).join(", ") : "fair (not unfair under EU consumer law)"}
        </p>
      )}
    </div>
  );
}
