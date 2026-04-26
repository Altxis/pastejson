import { useState, useRef, useMemo, useCallback } from "react";
import { tokenize } from "../utils/tokenize";
import CopyButton from "./CopyButton";
import "./RawView.css";

// Syntax-highlight only up to this size; beyond it we use virtual-scrolled
// plain text to avoid creating 100k+ DOM <span> nodes.
const HIGHLIGHT_LIMIT = 50_000;

// Approx rendered height per line: font-size 13px × line-height 1.7 ≈ 22px
const LINE_H = 22;
const OVERSCAN = 30;

interface Props {
  value: unknown;
}

export default function RawView({ value }: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const raw = useMemo(() => JSON.stringify(value, null, 2) ?? "null", [value]);

  // For small JSON: full syntax highlighting, no virtual scroll needed.
  const tokens = useMemo(
    () => (raw.length <= HIGHLIGHT_LIMIT ? tokenize(raw) : null),
    [raw],
  );

  // For large JSON: split into lines and virtual-scroll plain text.
  const lines = useMemo(
    () => (tokens === null ? raw.split("\n") : null),
    [raw, tokens],
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  }, []);

  // ── Virtual window ─────────────────────────────────────────────────────────
  const containerH = scrollRef.current?.clientHeight ?? 600;
  const lineCount = lines?.length ?? 0;
  const visibleCount = Math.ceil(containerH / LINE_H);
  const startLine = Math.max(0, Math.floor(scrollTop / LINE_H) - OVERSCAN);
  const endLine = Math.min(lineCount, startLine + visibleCount + OVERSCAN * 2);
  const totalHeight = lineCount * LINE_H;
  const topPad = startLine * LINE_H;

  return (
    <div className="raw-view">
      <div className="raw-view__toolbar">
        <span className="raw-view__label">
          {raw.length.toLocaleString()} chars
          {lines && ` · ${lines.length.toLocaleString()} lines`}
          {tokens === null && " — plain text (too large to highlight)"}
        </span>
        <CopyButton text={raw} title="Copy JSON" />
      </div>

      {tokens ? (
        // ── Small file: full syntax-highlighted pre ───────────────────────────
        <pre className="raw-view__pre">
          {tokens.map((tok, i) =>
            tok.type === "whitespace" ? (
              tok.text
            ) : (
              <span key={i} className={`tok tok-${tok.type}`}>
                {tok.text}
              </span>
            ),
          )}
        </pre>
      ) : (
        // ── Large file: virtual-scrolled plain text ───────────────────────────
        // The outer div is the real scroll container (height: 70vh).
        // An inner div sets the full scroll height so the scrollbar is correct.
        // The pre is absolutely positioned at topPad within the inner div.
        <div
          ref={scrollRef}
          className="raw-view__scroll"
          onScroll={handleScroll}
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            <pre
              className="raw-view__pre raw-view__pre--virtual"
              style={{ top: topPad }}
            >
              {lines!.slice(startLine, endLine).join("\n")}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
