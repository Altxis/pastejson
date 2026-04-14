import { useState, useRef, useMemo, useCallback } from "react";
import { flatten } from "../utils/flatten";
import CopyButton from "./CopyButton";
import "./TableView.css";

const ROW_H = 36;       // approximate rendered row height in px
const OVERSCAN = 10;    // extra rows to render above and below the viewport

interface Props {
  value: unknown;
}

function typeName(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export default function TableView({ value }: Props) {
  const [filter, setFilter] = useState("");
  const [debouncedFilter, setDebouncedFilter] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Memoize flatten — only recomputes when the parsed value changes, not on
  // every scroll/filter re-render. For large JSON (e.g. 23k entries) this
  // prevents the main thread from blocking on every scroll tick.
  const rows = useMemo(() => flatten(value), [value]);

  // Memoize filtering — only reruns when the debounced filter string or rows change.
  const filtered = useMemo(
    () =>
      debouncedFilter
        ? rows.filter(([path]) =>
            path.toLowerCase().includes(debouncedFilter.toLowerCase()),
          )
        : rows,
    [rows, debouncedFilter],
  );

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFilter(val);
    // Debounce the actual filter so we don't re-filter 70k rows on every keystroke
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => setDebouncedFilter(val), 150);
  }, []);

  // Virtual window
  const containerH = containerRef.current?.clientHeight ?? 600;
  const visibleCount = Math.ceil(containerH / ROW_H);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIndex = Math.min(
    filtered.length,
    startIndex + visibleCount + OVERSCAN * 2,
  );
  const visible = filtered.slice(startIndex, endIndex);
  const topH = startIndex * ROW_H;
  const bottomH = (filtered.length - endIndex) * ROW_H;

  return (
    <div className="table-view">
      <div className="table-view__toolbar">
        <input
          className="table-view__filter"
          type="text"
          placeholder="Filter by path…"
          value={filter}
          onChange={handleFilterChange}
        />
        <span className="table-view__count">{filtered.length} rows</span>
      </div>
      <div
        ref={containerRef}
        className="table-view__scroll"
        onScroll={(e) =>
          setScrollTop((e.target as HTMLDivElement).scrollTop)
        }
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
                <td
                  colSpan={4}
                  style={{ height: topH, padding: 0, border: "none" }}
                />
              </tr>
            )}
            {visible.map(([path, val], i) => (
              <tr key={startIndex + i}>
                <td className="col-path">{path}</td>
                <td className="col-type">
                  <span className={`type-badge type-${typeName(val)}`}>
                    {typeName(val)}
                  </span>
                </td>
                <td className="col-value">{String(val)}</td>
                <td className="col-copy">
                  <CopyButton text={path} title="Copy path" />
                </td>
              </tr>
            ))}
            {bottomH > 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{ height: bottomH, padding: 0, border: "none" }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
