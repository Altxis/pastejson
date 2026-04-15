import { useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";
import "./JsonInput.css";

// Initial chars shown in the textarea for large files.
const TEXTAREA_PREVIEW = 10_000;
const TEXTAREA_CHUNK = 10_000;
const TEXTAREA_MAX = 500_000;

interface FileMeta {
  total: number;
  displayed: number;
}

interface Props {
  onType: (raw: string) => void;
  onFile: (raw: string, fileSize: number) => void;
  onReadStart: (fileName: string, fileSize: number) => void;
  onReadError: (message: string) => void;
}

export default function JsonInput({ onType, onFile, onReadStart, onReadError }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawRef = useRef<string>("");

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setFileMeta(null);
    onType(e.target.value);
  }

  function loadFile(file: File) {
    // Chrome tabs have a ~512 MB–1 GB JS heap limit. FileReader.readAsText loads
    // the entire file into a string, then JSON.parse creates a second copy as the
    // parsed object — so a 500 MB file can easily consume 1+ GB and crash the tab.
    // Warn the user rather than silently OOM-crashing.
    const MAX_SAFE_BYTES = 500 * 1024 * 1024; // 500 MB
    if (file.size > MAX_SAFE_BYTES) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(0);
      onReadError(
        `"${file.name}" is ${sizeMB} MB — too large for a browser tab. ` +
        `FileReader must load the whole file into memory at once, and files this size tend to crash the tab. ` +
        `Try splitting the file, or use a command-line tool like \`jq\`.`
      );
      return;
    }

    // Signal immediately — before any async I/O — so the UI can show feedback
    // right away. FileReader.readAsText for a 200+ MB file takes 5–10 s and
    // gives no progress events by default; without this the user sees nothing.
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
      onReadError(
        `Failed to read "${file.name}". ` +
        `The file is ${(file.size / 1024 / 1024).toFixed(1)} MB — ` +
        `it may be too large for this browser session (try closing other tabs to free memory).`
      );
    };

    reader.readAsText(file);
  }

  function handleLoadMoreEditor() {
    if (!fileMeta || !textareaRef.current) return;
    const next = Math.min(fileMeta.displayed + TEXTAREA_CHUNK, fileMeta.total, TEXTAREA_MAX);
    textareaRef.current.value = rawRef.current.slice(0, next);
    setFileMeta({ total: fileMeta.total, displayed: next });
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
    // Reset so the same file can be re-selected after clearing
    e.target.value = "";
  }

  const canLoadMore =
    fileMeta !== null &&
    fileMeta.displayed < fileMeta.total &&
    fileMeta.displayed < TEXTAREA_MAX;

  const remaining = fileMeta
    ? Math.min(fileMeta.total, TEXTAREA_MAX) - fileMeta.displayed
    : 0;

  return (
    <div
      className="json-input"
      data-drag-active={dragActive}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      {/* Uncontrolled textarea. Also handles drag/drop directly because browsers
          treat textareas as native drop targets and consume the events before
          they bubble — without this, dropping on the textarea silently fails. */}
      <textarea
        ref={textareaRef}
        className="json-input__textarea"
        onChange={handleChange}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        placeholder={'Paste JSON here…\n\n{\n  "name": "Alice",\n  "age": 30\n}'}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
      <div className="json-input__toolbar">
        {canLoadMore ? (
          <button
            className="json-input__load-more-btn"
            onClick={handleLoadMoreEditor}
            type="button"
          >
            Load {Math.min(TEXTAREA_CHUNK, remaining).toLocaleString()} more chars in editor
            <span className="json-input__load-more-meta">
              ({((fileMeta!.total - fileMeta!.displayed) / 1024).toFixed(0)} KB remaining
              {fileMeta!.displayed >= TEXTAREA_MAX ? " — editor limit reached" : ""})
            </span>
          </button>
        ) : (
          <span className="json-input__hint">
            {fileMeta
              ? `${(fileMeta.total / 1024).toFixed(0)} KB file — editor limit reached, use tabs below`
              : "or drop a .json file anywhere above"}
          </span>
        )}
        <input
          type="file"
          accept=".json,application/json,text/plain"
          ref={fileRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <button
          className="json-input__file-btn"
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          Load file
        </button>
      </div>
    </div>
  );
}
