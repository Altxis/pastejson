import React, { useRef, useState, forwardRef, useImperativeHandle } from "react";
import type { DragEvent, ChangeEvent } from "react";
import "./JsonInput.css";

export interface JsonInputHandle {
  setValue: (raw: string) => void;
}

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

const JsonInput = forwardRef<JsonInputHandle, Props>(function JsonInput(
  { onType, onFile, onReadStart, onReadError }: Props,
  ref,
) {
  const [dragActive, setDragActive] = useState(false);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rawRef = useRef<string>("");

  useImperativeHandle(ref, () => ({
    setValue(raw: string) {
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

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setFileMeta(null);
    onType(e.target.value);
  }

  function handleTextareaScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const nearBottom = ta.scrollHeight - ta.scrollTop - ta.clientHeight < 120;
    if (nearBottom && canLoadMore) handleLoadMoreEditor();
  }

  function loadFile(file: File) {
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
    e.target.value = "";
  }

  const canLoadMore =
    fileMeta !== null &&
    fileMeta.displayed < fileMeta.total &&
    fileMeta.displayed < TEXTAREA_MAX;

  const hint = fileMeta
    ? `Large file — editor shows first ${(fileMeta.displayed / 1024).toFixed(0)} KB, use tabs below for full view`
    : "or drop a .json file anywhere above";

  return (
    <div
      className="json-input"
      data-drag-active={dragActive}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <textarea
        ref={textareaRef}
        className="json-input__textarea"
        onChange={handleChange}
        onScroll={handleTextareaScroll}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        placeholder={'Paste JSON here…\n\n{\n  "name": "Alice",\n  "age": 30\n}'}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
      <div className="json-input__toolbar">
        <span className="json-input__hint">{hint}</span>
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
});

export default JsonInput;
