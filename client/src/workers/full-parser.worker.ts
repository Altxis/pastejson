// Full parse + truncation repair — runs off the main thread so huge files
// (100 MB+) don't freeze the browser tab.

import { tryRepairTruncated } from "../utils/repairJson";
import type { WorkerResult } from "../types";

self.onmessage = (e: MessageEvent<{ raw: string; fileSize: number; partialRead: boolean }>) => {
  const { raw, fileSize, partialRead } = e.data;

  try {
    const value = JSON.parse(raw);
    const warning = partialRead
      ? `⚠ Browser only read ${(raw.length / 1024 / 1024).toFixed(1)} MB of ${(fileSize / 1024 / 1024).toFixed(1)} MB — results may be incomplete.`
      : undefined;
    self.postMessage({ ok: true, value, warning } satisfies WorkerResult);
  } catch (parseErr) {
    const repaired = tryRepairTruncated(raw);
    if (repaired) {
      const sizeMB = (fileSize / 1024 / 1024).toFixed(1);
      const readMB = (raw.length / 1024 / 1024).toFixed(1);
      const readNote = partialRead
        ? ` (browser only read ${readMB} MB of ${sizeMB} MB)`
        : ` (file is ${sizeMB} MB)`;
      const warning =
        `⚠ File is truncated${readNote} — showing ${repaired.itemCount.toLocaleString()} recoverable items. ` +
        `The file was cut off mid-entry and is missing its closing ].`;
      self.postMessage({ ok: true, value: repaired.value, warning } satisfies WorkerResult);
    } else {
      const msg = (parseErr as Error).message;
      const extra = partialRead
        ? ` (browser only read ${(raw.length / 1024 / 1024).toFixed(1)} MB of ${(fileSize / 1024 / 1024).toFixed(1)} MB — file may be valid but too large for this tab)`
        : "";
      self.postMessage({ ok: false, error: msg + extra } satisfies WorkerResult);
    }
  }
};
