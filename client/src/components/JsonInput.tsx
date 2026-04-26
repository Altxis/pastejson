import React, { useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { DragEvent, ChangeEvent, KeyboardEvent } from "react";
import "./JsonInput.css";

export interface JsonInputHandle {
  setValue: (raw: string) => void;
}

const TEXTAREA_PREVIEW = 10_000;
const TEXTAREA_CHUNK = 10_000;
const TEXTAREA_MAX = 500_000;
const API_BASE = import.meta.env.VITE_API_URL ?? "";

type InputMode = "paste" | "url";

type UrlState =
  | { status: "idle" }
  | { status: "fetching" }
  | { status: "done"; url: string }
  | { status: "error"; message: string };

interface FileMeta {
  total: number;
  displayed: number;
}

interface Props {
  onType: (raw: string) => void;
  onFile: (raw: string, fileSize: number) => void;
  onReadStart: (fileName: string, fileSize: number) => void;
  onReadError: (message: string) => void;
  onClear: () => void;
}

const JsonInput = forwardRef<JsonInputHandle, Props>(function JsonInput(
  { onType, onFile, onReadStart, onReadError, onClear }: Props,
  ref,
) {
  const [mode, setMode] = useState<InputMode>("paste");
  const [dragActive, setDragActive] = useState(false);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [urlState, setUrlState] = useState<UrlState>({ status: "idle" });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const rawRef = useRef<string>("");

  useImperativeHandle(ref, () => ({
    setValue(raw: string) {
      setMode("paste");
      rawRef.current = raw;
      if (textareaRef.current) {
        if (raw.length > TEXTAREA_PREVIEW) {
          textareaRef.current.value = raw.slice(0, TEXTAREA_PREVIEW);
          setFileMeta({ total: raw.length, displayed: TEXTAREA_PREVIEW });
        } else {
          textareaRef.current.value = raw;
          setFileMeta(null);
        }
      }
    },
  }));

  // ── Paste mode handlers ──────────────────────────────────────────────────

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    if (fileMeta) return; // read-only preview
    onType(e.target.value);
  }

  function handleTextareaScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const nearBottom = ta.scrollHeight - ta.scrollTop - ta.clientHeight < 120;
    if (nearBottom && canLoadMore) handleLoadMoreEditor();
  }

  function handleLoadMoreEditor() {
    if (!fileMeta || !textareaRef.current) return;
    const next = Math.min(fileMeta.displayed + TEXTAREA_CHUNK, fileMeta.total, TEXTAREA_MAX);
    textareaRef.current.value = rawRef.current.slice(0, next);
    setFileMeta({ total: fileMeta.total, displayed: next });
  }

  function handleClear() {
    rawRef.current = "";
    setFileMeta(null);
    setUrlState({ status: "idle" });
    if (textareaRef.current) {
      textareaRef.current.value = "";
      if (mode === "paste") textareaRef.current.focus();
    }
    onClear();
  }

  function loadFile(file: File) {
    const MAX_SAFE_BYTES = 500 * 1024 * 1024;
    if (file.size > MAX_SAFE_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(0);
      onReadError(
        `"${file.name}" is ${sizeMB} MB — too large for a browser tab. ` +
        `FileReader must load the whole file into memory at once. ` +
        `Try splitting the file, or use a command-line tool like \`jq\`.`
      );
      return;
    }
    onReadStart(file.name, file.size);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result ?? "") as string;
      rawRef.current = content;
      if (textareaRef.current) {
        if (content.length > TEXTAREA_PREVIEW) {
          textareaRef.current.value = content.slice(0, TEXTAREA_PREVIEW);
          setFileMeta({ total: content.length, displayed: TEXTAREA_PREVIEW });
        } else {
          textareaRef.current.value = content;
          setFileMeta(null);
        }
      }
      onFile(content, file.size);
    };
    reader.onerror = () => {
      onReadError(`Failed to read "${file.name}".`);
    };
    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }

  // ── URL mode handlers ────────────────────────────────────────────────────

  async function handleFetch() {
    const url = urlInput.trim();
    if (!url) return;

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      setUrlState({ status: "error", message: "Invalid URL — include https://" });
      return;
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      setUrlState({ status: "error", message: "Only http and https URLs are supported" });
      return;
    }

    setUrlState({ status: "fetching" });
    onReadStart(parsed.hostname, 0);

    // 1. Try direct browser fetch (works for APIs with CORS headers)
    try {
      const res = await fetch(url, { headers: { Accept: "application/json, text/plain, */*" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const raw = await res.text();
      setUrlState({ status: "done", url });
      onFile(raw, raw.length);
      return;
    } catch (directErr) {
      // If it looks like a CORS / network error, fall through to proxy.
      // TypeError with no useful status = almost certainly CORS.
      const isCors = directErr instanceof TypeError;
      if (!isCors) {
        const msg = directErr instanceof Error ? directErr.message : String(directErr);
        setUrlState({ status: "error", message: msg });
        onReadError(msg);
        return;
      }
    }

    // 2. Fall back to server-side proxy (bypasses CORS)
    try {
      const res = await fetch(
        `${API_BASE}/api/proxy?url=${encodeURIComponent(url)}`,
      );
      const json = await res.json() as { raw?: string; message?: string };
      if (!res.ok) throw new Error(json.message ?? `Proxy error ${res.status}`);
      const raw = json.raw ?? "";
      setUrlState({ status: "done", url });
      onFile(raw, raw.length);
    } catch (proxyErr) {
      const msg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
      setUrlState({ status: "error", message: msg });
      onReadError(msg);
    }
  }

  function handleUrlKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleFetch();
  }

  // ── Mode switch ──────────────────────────────────────────────────────────

  function switchMode(next: InputMode) {
    setMode(next);
    if (next === "url") setTimeout(() => urlInputRef.current?.focus(), 0);
    if (next === "paste") setTimeout(() => textareaRef.current?.focus(), 0);
  }

  // ── Derived state ────────────────────────────────────────────────────────

  const canLoadMore =
    fileMeta !== null &&
    fileMeta.displayed < fileMeta.total &&
    fileMeta.displayed < TEXTAREA_MAX;

  const isPreview = fileMeta !== null;
  const isFetching = urlState.status === "fetching";

  return (
    <div
      className="json-input"
      data-drag-active={dragActive && mode === "paste"}
      onDragOver={(e) => { if (mode === "paste") { e.preventDefault(); setDragActive(true); } }}
      onDragEnter={(e) => { if (mode === "paste") { e.preventDefault(); setDragActive(true); } }}
      onDragLeave={() => setDragActive(false)}
      onDrop={mode === "paste" ? handleDrop : undefined}
    >
      {/* ── Mode toggle ── */}
      <div className="json-input__mode-bar">
        <button
          className={`json-input__mode-btn${mode === "paste" ? " json-input__mode-btn--active" : ""}`}
          onClick={() => switchMode("paste")}
          type="button"
        >
          Paste
        </button>
        <button
          className={`json-input__mode-btn${mode === "url" ? " json-input__mode-btn--active" : ""}`}
          onClick={() => switchMode("url")}
          type="button"
        >
          URL
        </button>
      </div>

      {/* ── Paste mode ── */}
      {mode === "paste" && (
        <div className="json-input__textarea-wrap">
          <textarea
            ref={textareaRef}
            className={`json-input__textarea${isPreview ? " json-input__textarea--preview" : ""}`}
            onChange={handleChange}
            onScroll={handleTextareaScroll}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            placeholder={'Paste JSON here…\n\n{\n  "name": "Alice",\n  "age": 30\n}'}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            readOnly={isPreview}
          />
          {isPreview && (
            <button className="json-input__clear-btn" onClick={handleClear} type="button" title="Clear">
              ×
            </button>
          )}
        </div>
      )}

      {/* ── URL mode ── */}
      {mode === "url" && (
        <div className="json-input__url-area">
          <div className="json-input__url-row">
            <input
              ref={urlInputRef}
              className="json-input__url-input"
              type="url"
              value={urlInput}
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlState({ status: "idle" });
              }}
              onKeyDown={handleUrlKeyDown}
              placeholder="https://api.example.com/data"
              spellCheck={false}
              autoComplete="off"
              disabled={isFetching}
            />
            <button
              className="json-input__fetch-btn"
              onClick={handleFetch}
              disabled={isFetching || !urlInput.trim()}
              type="button"
            >
              {isFetching ? (
                <span className="json-input__spinner" aria-label="Fetching…" />
              ) : "Fetch"}
            </button>
          </div>

          {urlState.status === "done" && (
            <p className="json-input__url-meta">
              ✓ Loaded from <span className="json-input__url-source">{urlState.url}</span>
              <button className="json-input__clear-link" onClick={handleClear} type="button">clear</button>
            </p>
          )}
          {urlState.status === "error" && (
            <p className="json-input__url-error">{urlState.message}</p>
          )}
          {urlState.status === "idle" && (
            <p className="json-input__url-hint">
              Press Enter or click Fetch — CORS-blocked APIs are proxied automatically.
            </p>
          )}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="json-input__toolbar">
        {mode === "paste" ? (
          isPreview ? (
            <span className="json-input__hint">
              Preview — first {(fileMeta!.displayed / 1024).toFixed(0)} KB of{" "}
              {(fileMeta!.total / 1024 / 1024).toFixed(1)} MB shown ·{" "}
              <button className="json-input__clear-link" onClick={handleClear} type="button">
                clear to edit
              </button>
            </span>
          ) : (
            <span className="json-input__hint">or drop a .json file anywhere above</span>
          )
        ) : (
          <span className="json-input__hint">GET request · JSON response visualized instantly</span>
        )}
        <input
          type="file"
          accept=".json,application/json,text/plain"
          ref={fileRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        {mode === "paste" && (
          <button className="json-input__file-btn" onClick={() => fileRef.current?.click()} type="button">
            Load file
          </button>
        )}
      </div>
    </div>
  );
});

export default JsonInput;
