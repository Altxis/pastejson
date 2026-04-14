import { useState, useRef, startTransition } from "react";
import JsonInput from "./components/JsonInput";
import ViewTabs from "./components/ViewTabs";
import TreeView from "./components/TreeView";
import TableView from "./components/TableView";
import RawView from "./components/RawView";
import GraphView from "./components/GraphView";
import ErrorBanner from "./components/ErrorBanner";
import "./App.css";

type View = "tree" | "table" | "raw" | "graph";

type ParseState =
  | { status: "empty" }
  | { status: "parsing" }
  | { status: "error"; message: string }
  | { status: "ok"; value: unknown; raw: string };

export default function App() {
  const [view, setView] = useState<View>("tree");
  const [parseState, setParseState] = useState<ParseState>({ status: "empty" });
  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleParse(raw: string) {
    // Clear is immediate — no point debouncing an empty input
    if (!raw.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      workerRef.current?.terminate();
      setParseState({ status: "empty" });
      return;
    }

    // Debounce: wait 200ms after the last keystroke before parsing.
    // This keeps the existing tree visible while the user is still typing,
    // avoiding an expensive unmount + remount on every character.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      workerRef.current?.terminate();

      const worker = new Worker(
        new URL("./workers/parser.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      setParseState({ status: "parsing" });

      worker.onmessage = (
        e: MessageEvent<{ ok: boolean; value?: unknown; raw?: string; error?: string }>,
      ) => {
        const { ok, value, raw: formatted, error } = e.data;
        // startTransition lets React yield to browser paint events while
        // mounting the (potentially large) tree after the parse completes.
        startTransition(() => {
          if (ok) {
            setParseState({ status: "ok", value, raw: formatted ?? "" });
          } else {
            setParseState({ status: "error", message: error ?? "Unknown error" });
          }
        });
        worker.terminate();
      };

      worker.onerror = (e) => {
        setParseState({ status: "error", message: e.message });
        worker.terminate();
      };

      worker.postMessage(raw);
    }, 200);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          paste<span className="accent">json</span>
        </h1>
        <p className="app-tagline">
          Paste or drop a .json file — see something beautiful.
        </p>
      </header>

      <JsonInput onParse={handleParse} />

      {parseState.status === "error" && (
        <ErrorBanner message={parseState.message} />
      )}

      {parseState.status === "parsing" && (
        <div className="app-parsing">Parsing…</div>
      )}

      {parseState.status === "ok" && (
        <div className="viewer">
          <ViewTabs active={view} onChange={setView} />
          <div className="view-content" key={view}>
            {view === "tree" && <TreeView value={parseState.value} />}
            {view === "table" && <TableView value={parseState.value} />}
            {view === "raw" && <RawView raw={parseState.raw} />}
            {view === "graph" && <GraphView value={parseState.value} />}
          </div>
        </div>
      )}

      {parseState.status === "empty" && (
        <div className="app-empty">
          <p>Supports objects, arrays, strings, numbers, booleans and null.</p>
        </div>
      )}
    </div>
  );
}
