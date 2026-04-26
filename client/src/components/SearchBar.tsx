import { useState, useRef, useEffect } from "react";
import "./SearchBar.css";

interface Props {
  query: string;
  onChange: (q: string) => void;
  matchCount?: number;
}

export default function SearchBar({ query, onChange, matchCount }: Props) {
  // Local state for immediate input feedback; propagate debounced to parent
  const [local, setLocal] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when parent clears the query (e.g. new file loaded)
  useEffect(() => {
    if (query === "" && local !== "") setLocal("");
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLocal(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(val), 180);
  }

  function handleClear() {
    setLocal("");
    onChange("");
    inputRef.current?.focus();
  }

  const showCount = query.trim() !== "" && matchCount !== undefined;

  return (
    <div className="search-bar">
      <svg className="search-bar__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        className="search-bar__input"
        type="text"
        value={local}
        onChange={handleChange}
        placeholder="Search keys and values…"
        spellCheck={false}
        autoComplete="off"
      />
      {showCount && (
        <span className="search-bar__count">
          {matchCount === 0
            ? "no matches"
            : matchCount! > 999
              ? "1,000+ matches"
              : `${matchCount!.toLocaleString()} match${matchCount === 1 ? "" : "es"}`}
        </span>
      )}
      {local && (
        <button
          className="search-bar__clear"
          onClick={handleClear}
          type="button"
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
