import { useMemo } from "react";
import { tokenize } from "../utils/tokenize";
import CopyButton from "./CopyButton";
import "./RawView.css";

const RENDER_LIMIT = 500_000;  // chars — render at most ~500 KB of text
const HIGHLIGHT_LIMIT = 50_000; // chars — syntax-highlight only up to ~50 KB;
                                 // beyond this we render plain text to avoid
                                 // creating 100k+ DOM <span> nodes which freezes
                                 // the browser for several seconds.

interface Props {
  value: unknown;
}

export default function RawView({ value }: Props) {
  // Format lazily — only runs when the Raw tab is first opened (or value changes).
  // Keeping this out of the worker means we avoid a large string transfer and a
  // redundant parse; JSON.stringify is fast enough on the main thread via useMemo.
  const raw = useMemo(() => JSON.stringify(value, null, 2) ?? "null", [value]);

  const truncated = raw.length > RENDER_LIMIT;
  const visible = truncated ? raw.slice(0, RENDER_LIMIT) : raw;

  // Only tokenize small-ish JSON. For large files the token array can reach
  // 100k+ entries, and mounting that many <span> elements blocks the main
  // thread for seconds. Plain text inside <pre> is a single text node and is
  // essentially free regardless of length.
  const tokens = useMemo(
    () => (visible.length <= HIGHLIGHT_LIMIT ? tokenize(visible) : null),
    [visible],
  );

  return (
    <div className="raw-view">
      <div className="raw-view__toolbar">
        <span className="raw-view__label">
          {raw.length.toLocaleString()} chars
          {truncated && " — rendered first 500 KB"}
          {!tokens && " — plain text (too large to highlight)"}
        </span>
        <CopyButton text={raw} title="Copy JSON" />
      </div>
      <pre className="raw-view__pre">
        {tokens
          ? tokens.map((tok, i) =>
              tok.type === "whitespace" ? (
                tok.text
              ) : (
                <span key={i} className={`tok tok-${tok.type}`}>
                  {tok.text}
                </span>
              ),
            )
          : visible}
        {truncated && (
          <span className="raw-view__truncated">
            {"\n\n"}… {(raw.length - RENDER_LIMIT).toLocaleString()} more chars
            (copy to see full output)
          </span>
        )}
      </pre>
    </div>
  );
}
