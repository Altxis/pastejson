import type { View } from "../types";
import "./ViewTabs.css";

interface Props {
  active: View;
  onChange: (v: View) => void;
}

const TABS: { id: View; label: string }[] = [
  { id: "tree", label: "Tree" },
  { id: "table", label: "Table" },
  { id: "raw", label: "Raw" },
  { id: "graph", label: "Graph" },
];

export default function ViewTabs({ active, onChange }: Props) {
  return (
    <nav className="view-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className="view-tabs__btn"
          data-active={active === tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
