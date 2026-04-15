self.onmessage = (e: MessageEvent<string>) => {
  try {
    // Validate only — if JSON.parse throws, we return the error.
    // We intentionally do NOT stringify the result here; that would mean
    // doing two full parses (once here, once on the main thread) plus
    // transferring megabytes of formatted text across the worker boundary.
    // Instead the main thread re-parses the original string itself, which
    // is fast (~50 ms for multi-MB files) and avoids the transfer overhead.
    JSON.parse(e.data);
    self.postMessage({ ok: true });
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message });
  }
};
