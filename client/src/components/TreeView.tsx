import { useState, useMemo } from "react";
import { buildSearchIndex, type SearchIndex } from "../utils/search";
import "./TreeView.css";

const MAX_VISIBLE_CHILDREN = 100;
const LOAD_CHUNK = 100;
const SHOW_ALL_WARN_THRESHOLD = 500;

interface TreeNodeProps {
  value: unknown;
  keyName?: string;
  depth: number;
  path: string;
  search: SearchIndex | null;
}

function preview(value: unknown): string {
  if (Array.isArray(value)) return `[ ${value.length} items ]`;
  if (value !== null && typeof value === "object") {
    const n = Object.keys(value as object).length;
    return `{ ${n} key${n !== 1 ? "s" : ""} }`;
  }
  return "";
}

/** Highlight the first occurrence of `query` inside `text`. */
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

function ValueSpan({ value, query }: { value: unknown; query: string }) {
  if (value === null) return <span className="tok-null">null</span>;
  if (typeof value === "string")
    return (
      <span className="tok-string">
        &ldquo;<Highlight text={value} query={query} />&rdquo;
      </span>
    );
  if (typeof value === "number")
    return (
      <span className="tok-number">
        <Highlight text={String(value)} query={query} />
      </span>
    );
  if (typeof value === "boolean")
    return (
      <span className="tok-boolean">
        <Highlight text={String(value)} query={query} />
      </span>
    );
  return (
    <span>
      <Highlight text={String(value)} query={query} />
    </span>
  );
}

function TreeNode({ value, keyName, depth, path, search }: TreeNodeProps) {
  const isCollapsible = value !== null && typeof value === "object";
  const isArray = isCollapsible && Array.isArray(value);

  const childCount = !isCollapsible
    ? 0
    : isArray
      ? (value as unknown[]).length
      : Object.keys(value as object).length;

  const [collapsed, setCollapsed] = useState(
    depth >= 2 || (depth >= 1 && childCount > 50),
  );

  const [shownCount, setShownCount] = useState(
    () => (isCollapsible ? Math.min(childCount, MAX_VISIBLE_CHILDREN) : 0),
  );

  // Force-expand nodes that contain a search match somewhere in their subtree.
  const isMatch = search !== null && search.matchedPaths.has(path);
  const hasDescendantMatch = search !== null && search.ancestorPaths.has(path);
  const effectiveCollapsed = hasDescendantMatch ? false : collapsed;

  const visible = useMemo<[string, unknown][]>(() => {
    if (!isCollapsible || effectiveCollapsed) return [];
    if (isArray) {
      const arr = value as unknown[];
      const result: [string, unknown][] = new Array(shownCount);
      for (let i = 0; i < shownCount; i++) result[i] = [String(i), arr[i]];
      return result;
    }
    const allEntries = Object.entries(value as Record<string, unknown>);
    return shownCount < allEntries.length ? allEntries.slice(0, shownCount) : allEntries;
  }, [value, isCollapsible, isArray, effectiveCollapsed, shownCount]);

  const hidden = childCount - shownCount;
  const nodeStyle = { "--depth": depth } as React.CSSProperties;
  const query = search?.query ?? "";

  const keyEl =
    keyName !== undefined ? (
      <>
        <span className="tree__key tok-key">
          &ldquo;<Highlight text={keyName} query={query} />&rdquo;
        </span>
        <span className="tree__colon">: </span>
      </>
    ) : null;

  // ── Leaf node ─────────────────────────────────────────────────────────────
  if (!isCollapsible) {
    return (
      <div className="tree-node tree-node--leaf" style={nodeStyle}>
        <div className={`tree-node__row${isMatch ? " tree-node__row--match" : ""}`}>
          <span className="tree__arrow" aria-hidden="true"> </span>
          {keyEl}
          <ValueSpan value={value} query={query} />
        </div>
      </div>
    );
  }

  // ── Collapsible node ──────────────────────────────────────────────────────
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";

  function toggle() {
    setCollapsed((c) => !c);
  }

  function handleLoadMore() {
    setShownCount((c) => Math.min(c + LOAD_CHUNK, childCount));
  }

  function handleShowAll() {
    if (
      hidden > SHOW_ALL_WARN_THRESHOLD &&
      !window.confirm(
        `This will render ${childCount.toLocaleString()} nodes and may freeze the browser for a few seconds. Continue?`,
      )
    )
      return;
    setShownCount(childCount);
  }

  return (
    <div className="tree-node" style={nodeStyle}>
      <div
        className={`tree-node__row${isMatch ? " tree-node__row--match" : ""}`}
        role="button"
        tabIndex={0}
        aria-expanded={!effectiveCollapsed}
        onClick={toggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle()}
      >
        <span
          className={`tree__arrow${effectiveCollapsed ? "" : " tree__arrow--open"}`}
          aria-hidden="true"
        >
          ▶
        </span>
        {keyEl}
        <span className="tree__brace">{open}</span>
        {effectiveCollapsed && <span className="tree__preview">{preview(value)}</span>}
        {effectiveCollapsed && <span className="tree__brace">{close}</span>}
      </div>

      {!effectiveCollapsed && (
        <>
          <div className="tree-node__children">
            {visible.map(([k, v]) => (
              <TreeNode
                key={k}
                value={v}
                keyName={isArray ? undefined : k}
                depth={depth + 1}
                path={path ? `${path}.${k}` : k}
                search={search}
              />
            ))}
            {hidden > 0 && (
              <div
                className="tree-node__load-more"
                style={{ "--depth": depth + 1 } as React.CSSProperties}
              >
                <span
                  className="tree-node__load-chunk"
                  role="button"
                  tabIndex={0}
                  onClick={handleLoadMore}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && handleLoadMore()
                  }
                >
                  +{Math.min(LOAD_CHUNK, hidden).toLocaleString()} more
                </span>
                {hidden > LOAD_CHUNK && (
                  <>
                    {" · "}
                    <span
                      className="tree-node__show-all"
                      role="button"
                      tabIndex={0}
                      onClick={handleShowAll}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && handleShowAll()
                      }
                    >
                      show all {childCount.toLocaleString()}
                    </span>
                  </>
                )}
                <span className="tree-node__hidden-count">
                  {" "}({hidden.toLocaleString()} hidden)
                </span>
              </div>
            )}
          </div>
          <div className="tree-node__close">
            <span className="tree__brace">{close}</span>
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  value: unknown;
  query: string;
}

export default function TreeView({ value, query }: Props) {
  const search = useMemo<SearchIndex | null>(() => {
    if (!query.trim()) return null;
    return buildSearchIndex(value, query);
  }, [value, query]);

  return (
    <div className="tree-view">
      <TreeNode value={value} depth={0} path="" search={search} />
    </div>
  );
}
