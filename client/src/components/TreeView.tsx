import { useState, useMemo } from "react";
import "./TreeView.css";

const MAX_VISIBLE_CHILDREN = 100;  // initially shown
const LOAD_CHUNK = 100;            // added per "load more" click
const SHOW_ALL_WARN_THRESHOLD = 500; // confirm before rendering this many new nodes at once

interface TreeNodeProps {
  value: unknown;
  keyName?: string;
  depth: number;
}

function preview(value: unknown): string {
  if (Array.isArray(value)) return `[ ${value.length} items ]`;
  if (value !== null && typeof value === "object") {
    const n = Object.keys(value as object).length;
    return `{ ${n} key${n !== 1 ? "s" : ""} }`;
  }
  return "";
}

function ValueSpan({ value }: { value: unknown }) {
  if (value === null) return <span className="tok-null">null</span>;
  if (typeof value === "string")
    return <span className="tok-string">"{value}"</span>;
  if (typeof value === "number")
    return <span className="tok-number">{String(value)}</span>;
  if (typeof value === "boolean")
    return <span className="tok-boolean">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function TreeNode({ value, keyName, depth }: TreeNodeProps) {
  const isCollapsible = value !== null && typeof value === "object";
  const isArray = isCollapsible && Array.isArray(value);

  const childCount = !isCollapsible
    ? 0
    : isArray
      ? (value as unknown[]).length
      : Object.keys(value as object).length;

  // Collapse at depth ≥ 2, or at depth 1 when the node has > 50 children.
  const [collapsed, setCollapsed] = useState(
    depth >= 2 || (depth >= 1 && childCount > 50),
  );

  // Start by showing at most MAX_VISIBLE_CHILDREN; the user can load more in
  // chunks via the "+N more" button instead of rendering everything at once.
  const [shownCount, setShownCount] = useState(
    () => (isCollapsible ? Math.min(childCount, MAX_VISIBLE_CHILDREN) : 0),
  );

  // Only materialise the entries we're actually going to render.
  // Rules-of-Hooks: useMemo must be called unconditionally, before any early
  // return. For leaf nodes isCollapsible=false so this returns [] immediately.
  const visible = useMemo<[string, unknown][]>(() => {
    if (!isCollapsible || collapsed) return [];
    if (isArray) {
      const arr = value as unknown[];
      const result: [string, unknown][] = new Array(shownCount);
      for (let i = 0; i < shownCount; i++) result[i] = [String(i), arr[i]];
      return result;
    }
    const allEntries = Object.entries(value as Record<string, unknown>);
    return shownCount < allEntries.length ? allEntries.slice(0, shownCount) : allEntries;
  }, [value, isCollapsible, isArray, collapsed, shownCount]);

  const hidden = childCount - shownCount;
  const nodeStyle = { "--depth": depth } as React.CSSProperties;

  const keyEl =
    keyName !== undefined ? (
      <>
        <span className="tree__key tok-key">"{keyName}"</span>
        <span className="tree__colon">: </span>
      </>
    ) : null;

  // ── Leaf node ─────────────────────────────────────────────────────────────
  if (!isCollapsible) {
    return (
      <div className="tree-node tree-node--leaf" style={nodeStyle}>
        <div className="tree-node__row">
          <span className="tree__arrow" aria-hidden="true"> </span>
          {keyEl}
          <ValueSpan value={value} />
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
        className="tree-node__row"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={toggle}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle()}
      >
        <span
          className={`tree__arrow${collapsed ? "" : " tree__arrow--open"}`}
          aria-hidden="true"
        >
          ▶
        </span>
        {keyEl}
        <span className="tree__brace">{open}</span>
        {collapsed && <span className="tree__preview">{preview(value)}</span>}
        {collapsed && <span className="tree__brace">{close}</span>}
      </div>

      {!collapsed && (
        <>
          <div className="tree-node__children">
            {visible.map(([k, v]) => (
              <TreeNode
                key={k}
                value={v}
                keyName={isArray ? undefined : k}
                depth={depth + 1}
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
}

export default function TreeView({ value }: Props) {
  return (
    <div className="tree-view">
      <TreeNode value={value} depth={0} />
    </div>
  );
}
