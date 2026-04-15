import { useState, useRef } from "react";
import { flushSync } from "react-dom";
import JsonInput from "./components/JsonInput";
import ViewTabs from "./components/ViewTabs";
import TreeView from "./components/TreeView";
import TableView from "./components/TableView";
import RawView from "./components/RawView";
import GraphView from "./components/GraphView";
import ErrorBanner from "./components/ErrorBanner";
import { tryRepairTruncated } from "./utils/repairJson";
import type { View, WorkerResult } from "./types";
import "./App.css";
import { Analytics } from "@vercel/analytics/nuxt/runtime";

type ParseState =
  | { status: "empty" }
  | { status: "reading"; fileName: string; fileSize: number }
  | { status: "parsing" }
  | { status: "error"; message: string }
  | { status: "ok"; value: unknown; warning?: string };

// Files larger than this are parsed in a Web Worker to keep the UI responsive.
const WORKER_THRESHOLD_BYTES = 1 * 1024 * 1024; // 1 MB

export default function App() {
  const [view, setView] = useState<View>("tree");
  const [parseState, setParseState] = useState<ParseState>({ status: "empty" });
  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Called the instant the user picks/drops a file ────────────────────────
  // Fires before FileReader starts so the user sees immediate feedback even for
  // huge files that take many seconds to read from disk.
  function handleReadStart(fileName: string, fileSize: number) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    workerRef.current?.terminate();
    flushSync(() => setParseState({ status: "reading", fileName, fileSize }));
  }

  function handleReadError(message: string) {
    flushSync(() => setParseState({ status: "error", message }));
  }

  // ── Called when FileReader finishes loading the file content ──────────────
  function handleFile(raw: string, fileSize: number) {
    if (!raw.trim()) {
      setParseState({ status: "empty" });
      return;
    }

    const partialRead = fileSize > 0 && raw.length / fileSize < 0.95;

    // For large files, parse in a Web Worker so the main thread (and UI) stays
    // responsive during the potentially multi-second JSON.parse call.
    if (raw.length >= WORKER_THRESHOLD_BYTES) {
      setParseState({ status: "parsing" });

      if (workerRef.current) workerRef.current.terminate();

      const worker = new Worker(
        new URL("./workers/full-parser.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerResult>) => {
        worker.terminate();
        workerRef.current = null;
        const result = e.data;
        if (result.ok) {
          setParseState({
            status: "ok",
            value: result.value,
            warning: result.warning,
          });
        } else {
          setParseState({ status: "error", message: result.error });
        }
      };

      worker.onerror = (e) => {
        worker.terminate();
        workerRef.current = null;
        setParseState({
          status: "error",
          message: e.message ?? "Worker error",
        });
      };

      worker.postMessage({ raw, fileSize, partialRead });
      return;
    }

    // Small files: parse synchronously on the main thread.
    flushSync(() => setParseState({ status: "parsing" }));

    try {
      const value = JSON.parse(raw);
      const warning = partialRead
        ? `⚠ Browser only read ${(raw.length / 1024 / 1024).toFixed(1)} MB of ${(fileSize / 1024 / 1024).toFixed(1)} MB — results may be incomplete.`
        : undefined;
      flushSync(() => setParseState({ status: "ok", value, warning }));
    } catch (parseErr) {
      const repaired = tryRepairTruncated(raw);
      if (repaired) {
        const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
        const readMB = (raw.length / 1024 / 1024).toFixed(1);
        const readNote = partialRead
          ? ` (browser only read ${readMB} MB of ${sizeMB} MB)`
          : ` (file is ${sizeMB} MB)`;
        flushSync(() =>
          setParseState({
            status: "ok",
            value: repaired.value,
            warning:
              `⚠ File is truncated${readNote} — showing ${repaired.itemCount.toLocaleString()} recoverable items. ` +
              `The file was cut off mid-entry and is missing its closing ].`,
          }),
        );
        return;
      }

      const msg = (parseErr as Error).message;
      const extra = partialRead
        ? ` (browser only read ${(raw.length / 1024 / 1024).toFixed(1)} MB of ${(fileSize / 1024 / 1024).toFixed(1)} MB — file may be valid but too large for this tab)`
        : "";
      flushSync(() => setParseState({ status: "error", message: msg + extra }));
    }
  }

  // ── Typing path (debounced worker) ────────────────────────────────────────
  function handleType(raw: string) {
    if (!raw.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      workerRef.current?.terminate();
      setParseState({ status: "empty" });
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      workerRef.current?.terminate();

      const worker = new Worker(
        new URL("./workers/parser.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;
      setParseState({ status: "parsing" });

      worker.onmessage = (e: MessageEvent<{ ok: boolean; error?: string }>) => {
        const { ok, error } = e.data;
        worker.terminate();
        if (ok) {
          try {
            setParseState({ status: "ok", value: JSON.parse(raw) });
          } catch (err) {
            setParseState({ status: "error", message: (err as Error).message });
          }
        } else {
          setParseState({ status: "error", message: error ?? "Unknown error" });
        }
      };

      worker.onerror = (e) => {
        setParseState({ status: "error", message: e.message });
        worker.terminate();
      };

      worker.postMessage(raw);
    }, 200);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const sizeMB =
    parseState.status === "reading"
      ? (parseState.fileSize / 1024 / 1024).toFixed(1)
      : null;

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

      <JsonInput
        onType={handleType}
        onFile={handleFile}
        onReadStart={handleReadStart}
        onReadError={handleReadError}
      />

      {parseState.status === "error" && (
        <ErrorBanner message={parseState.message} />
      )}

      {parseState.status === "reading" && (
        <div className="app-parsing">
          Reading {parseState.fileName}
          {sizeMB ? ` (${sizeMB} MB)` : ""}…
        </div>
      )}

      {parseState.status === "parsing" && (
        <div className="app-parsing">Parsing…</div>
      )}

      {parseState.status === "ok" && (
        <>
          {parseState.warning && (
            <div className="app-warning">{parseState.warning}</div>
          )}
          <div className="viewer">
            <ViewTabs active={view} onChange={setView} />
            <div className="view-content" key={view}>
              {view === "tree" && <TreeView value={parseState.value} />}
              {view === "table" && <TableView value={parseState.value} />}
              {view === "raw" && <RawView value={parseState.value} />}
              {view === "graph" && <GraphView value={parseState.value} />}
            </div>
          </div>
        </>
      )}

      {parseState.status === "empty" && (
        <div className="app-empty">
          <p>Supports objects, arrays, strings, numbers, booleans and null.</p>
        </div>
      )}
      <Analytics />
    </div>
  );
}
