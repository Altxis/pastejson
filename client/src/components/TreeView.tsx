import { useState } from "react";
import "./TreeView.css";

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
  const [collapsed, setCollapsed] = useState(depth >= 2);

  const nodeStyle = { "--depth": depth } as React.CSSProperties;

  const keyEl =
    keyName !== undefined ? (
      <>
        <span className="tree__key tok-key">"{keyName}"</span>
        <span className="tree__colon">: </span>
      </>
    ) : null;

  if (!isCollapsible) {
    return (
      <div className="tree-node tree-node--leaf" style={nodeStyle}>
        <div className="tree-node__row">
          <span className="tree__arrow" aria-hidden="true">
            {" "}
          </span>
          {keyEl}
          <ValueSpan value={value} />
        </div>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);
  const open = isArray ? "[" : "{";
  const close = isArray ? "]" : "}";

  function toggle() {
    setCollapsed((c) => !c);
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
            {entries.map(([k, v]) => (
              <TreeNode
                key={k}
                value={v}
                keyName={isArray ? undefined : k}
                depth={depth + 1}
              />
            ))}
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
