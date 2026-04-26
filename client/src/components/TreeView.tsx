import React, { useState, useMemo } from "react";
import { buildSearchIndex, type SearchIndex } from "../utils/search";
import CopyButton from "./CopyButton";
import "./TreeView.css";

const MAX_VISIBLE_CHILDREN = 100;
const LOAD_CHUNK = 100;
const SHOW_ALL_WARN_THRESHOLD = 500;
const MAX_INJECTED_MATCHES = 20; // max search-injected entries shown per node

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

  // isInjected = true for entries that appear only because of a search match
  // beyond shownCount. Normal entries come first, then the load-more button,
  // then the injected group — so the button sits in its natural position.
  type VisibleEntry = { key: string; value: unknown; gapBefore: number; isInjected: boolean };

  const visible = useMemo<VisibleEntry[]>(() => {
    if (!isCollapsible || effectiveCollapsed) return [];

    const isSearchActive = !!(search?.query);

    if (isArray) {
      const arr = value as unknown[];
      if (isSearchActive) {
        const result: VisibleEntry[] = [];
        let prevIndex = -1;
        for (let i = 0; i < arr.length; i++) {
          const childPath = path ? `${path}.${i}` : String(i);
          const isNormal = i < shownCount;
          const isMatch =
            search!.matchedPaths.has(childPath) || search!.ancestorPaths.has(childPath);
          if (isNormal || isMatch) {
            result.push({
              key: String(i),
              value: arr[i],
              gapBefore: i - prevIndex - 1,
              isInjected: !isNormal,
            });
            prevIndex = i;
          }
        }
        return result;
      }
      return Array.from({ length: shownCount }, (_, i) => ({
        key: String(i),
        value: (value as unknown[])[i],
        gapBefore: 0,
        isInjected: false,
      }));
    }

    const allEntries = Object.entries(value as Record<string, unknown>);
    if (isSearchActive) {
      const result: VisibleEntry[] = [];
      let prevOrigIndex = -1;
      allEntries.forEach(([k, v], origIndex) => {
        const childPath = path ? `${path}.${k}` : k;
        const isNormal = origIndex < shownCount;
        const isMatch =
          search!.matchedPaths.has(childPath) || search!.ancestorPaths.has(childPath);
        if (isNormal || isMatch) {
          result.push({
            key: k,
            value: v,
            gapBefore: origIndex - prevOrigIndex - 1,
            isInjected: !isNormal,
          });
          prevOrigIndex = origIndex;
        }
      });
      return result;
    }
    return (shownCount < allEntries.length ? allEntries.slice(0, shownCount) : allEntries)
      .map(([k, v]) => ({ key: k, value: v, gapBefore: 0, isInjected: false }));
  }, [value, isCollapsible, isArray, effectiveCollapsed, shownCount, search, path]);

  // hidden = items not yet in the normal paginated window (injected matches don't count)
  const hidden = childCount - shownCount;

  const normalEntries = visible.filter((e) => !e.isInjected);
  const injectedEntries = visible.filter((e) => e.isInjected);
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
          {path && (
            <CopyButton compact text={path} title="Copy path" />
          )}
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
        {path && (
          <CopyButton compact text={path} title="Copy path" />
        )}
      </div>

      {!effectiveCollapsed && (
        <>
          <div className="tree-node__children">
            {/* Normal paginated entries */}
            {normalEntries.map(({ key: k, value: v }) => (
              <TreeNode
                key={k}
                value={v}
                keyName={isArray ? undefined : k}
                depth={depth + 1}
                path={path ? `${path}.${k}` : k}
                search={search}
              />
            ))}

            {/* Load-more button sits right after the normal entries */}
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

            {/* Injected search matches beyond shownCount, capped to avoid flooding */}
            {injectedEntries.slice(0, MAX_INJECTED_MATCHES).map(({ key: k, value: v, gapBefore }) => (
              <React.Fragment key={k}>
                {gapBefore > 0 && (
                  <div
                    className="tree-node__gap"
                    style={{ "--depth": depth + 1 } as React.CSSProperties}
                  >
                    ··· {gapBefore.toLocaleString()} item{gapBefore !== 1 ? "s" : ""} ···
                  </div>
                )}
                <TreeNode
                  value={v}
                  keyName={isArray ? undefined : k}
                  depth={depth + 1}
                  path={path ? `${path}.${k}` : k}
                  search={search}
                />
              </React.Fragment>
            ))}
            {injectedEntries.length > MAX_INJECTED_MATCHES && (
              <div
                className="tree-node__gap"
                style={{ "--depth": depth + 1 } as React.CSSProperties}
              >
                ··· {(injectedEntries.length - MAX_INJECTED_MATCHES).toLocaleString()} more match{injectedEntries.length - MAX_INJECTED_MATCHES !== 1 ? "es" : ""} not shown ···
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
