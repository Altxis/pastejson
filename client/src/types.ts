export type View = "tree" | "table" | "raw" | "graph";

export type WorkerResult =
  | { ok: true; value: unknown; warning?: string }
  | { ok: false; error: string };
