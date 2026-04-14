import { useState } from "react";
import { flatten } from "../utils/flatten";
import CopyButton from "./CopyButton";
import "./TableView.css";

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
  const rows = flatten(value);
  const filtered = filter
    ? rows.filter(([path]) => path.toLowerCase().includes(filter.toLowerCase()))
    : rows;

  return (
    <div className="table-view">
      <div className="table-view__toolbar">
        <input
          className="table-view__filter"
          type="text"
          placeholder="Filter by path…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="table-view__count">{filtered.length} rows</span>
      </div>
      <div className="table-view__scroll">
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
            {filtered.map(([path, val], i) => (
              <tr key={i}>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
