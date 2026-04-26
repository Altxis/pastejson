import { useState, useRef, useMemo, useCallback } from "react";
import { flatten } from "../utils/flatten";
import CopyButton from "./CopyButton";
import "./TableView.css";

const ROW_H = 36;
const HEADER_H = 37; // sticky header row height
const OVERSCAN = 10;
const MAX_FILTERED_ROWS = 2000;

interface Props {
  value: unknown;
  query: string;
}

function typeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-mark">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function TableView({ value, query }: Props) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => flatten(value), [value]);

  const { filtered, totalMatchCount } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { filtered: rows, totalMatchCount: rows.length };
    const all = rows.filter(([path, val]) => {
      const valStr = val === null ? "null" : String(val);
      return path.toLowerCase().includes(q) || valStr.toLowerCase().includes(q);
    });
    return {
      filtered: all.length > MAX_FILTERED_ROWS ? all.slice(0, MAX_FILTERED_ROWS) : all,
      totalMatchCount: all.length,
    };
  }, [rows, query]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.target as HTMLDivElement).scrollTop);
  }, []);

  // Header is sticky inside the scroll container — subtract its height from
  // the viewport so row count is correct, but scrollTop is unaffected.
  const containerH = containerRef.current?.clientHeight ?? 600;
  const rowViewH = containerH - HEADER_H;
  const visibleCount = Math.ceil(rowViewH / ROW_H);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(filtered.length, startIndex + visibleCount + OVERSCAN * 2);
  const visible = filtered.slice(startIndex, endIndex);
  const totalHeight = filtered.length * ROW_H;
  const topPad = startIndex * ROW_H;

  const isCapped = query.trim() && totalMatchCount > MAX_FILTERED_ROWS;
  const showCount = query.trim()
    ? isCapped
      ? `showing first ${MAX_FILTERED_ROWS.toLocaleString()} of ${totalMatchCount.toLocaleString()} matches`
      : `${filtered.length.toLocaleString()} of ${rows.length.toLocaleString()} rows`
    : `${rows.length.toLocaleString()} rows`;

  return (
    <div className="table-view">
      <div className="table-view__toolbar">
        <span className="table-view__count">{showCount}</span>
      </div>

      <div
        ref={containerRef}
        className="table-view__scroll"
        onScroll={handleScroll}
      >
        {/* Sticky header — inside the scroll container so it shares the same
            width context (including scrollbar gutter). No more column drift. */}
        <div className="table-view__head">
          <span className="table-view__th">Path</span>
          <span className="table-view__th">Type</span>
          <span className="table-view__th">Value</span>
          <span className="table-view__th" />
        </div>

        {/* Full-height inner div drives the scrollbar size */}
        <div style={{ height: totalHeight, position: "relative" }}>
          {/* Visible rows — absolutely positioned, no spacer rows */}
          <div
            className="table-view__rows"
            style={{ position: "absolute", top: topPad, left: 0, right: 0 }}
          >
            {visible.map(([path, val], i) => (
              <div key={startIndex + i} className="table-view__row">
                <span className="col-path">
                  <Highlight text={path} query={query} />
                </span>
                <span className="col-type">
                  <span className={`type-badge type-${typeName(val)}`}>
                    {typeName(val)}
                  </span>
                </span>
                <span className="col-value">
                  <Highlight text={String(val)} query={query} />
                </span>
                <span className="col-copy">
                  <CopyButton compact text={path} title="Copy path" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
