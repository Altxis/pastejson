import { useState, useRef, useMemo, useCallback } from "react";
import { flatten } from "../utils/flatten";
import CopyButton from "./CopyButton";
import "./TableView.css";

const ROW_H = 36;
const OVERSCAN = 10;
const MAX_FILTERED_ROWS = 2000; // cap search results to keep the table snappy

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

  // Filter by path OR value. Cap at MAX_FILTERED_ROWS and keep the total for
  // the "showing first N of M" label.
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

  // Virtual window
  const containerH = containerRef.current?.clientHeight ?? 600;
  const visibleCount = Math.ceil(containerH / ROW_H);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(filtered.length, startIndex + visibleCount + OVERSCAN * 2);
  const visible = filtered.slice(startIndex, endIndex);
  const topH = startIndex * ROW_H;
  const bottomH = (filtered.length - endIndex) * ROW_H;

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
        <table className="table-view__table">
          <thead>
            <tr>
              <th>Path</th>
              <th>Type</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {topH > 0 && (
              <tr>
                <td colSpan={4} style={{ height: topH, padding: 0, border: "none" }} />
              </tr>
            )}
            {visible.map(([path, val], i) => (
              <tr key={startIndex + i}>
                <td className="col-path">
                  <Highlight text={path} query={query} />
                </td>
                <td className="col-type">
                  <span className={`type-badge type-${typeName(val)}`}>
                    {typeName(val)}
                  </span>
                </td>
                <td className="col-value">
                  <Highlight text={String(val)} query={query} />
                </td>
                <td className="col-copy">
                  <CopyButton text={path} title="Copy path" />
                </td>
              </tr>
            ))}
            {bottomH > 0 && (
              <tr>
                <td colSpan={4} style={{ height: bottomH, padding: 0, border: "none" }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
