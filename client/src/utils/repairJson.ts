/**
 * Attempts to recover a truncated JSON array by finding the last complete
 * object boundary and closing the array there.
 *
 * Returns the repaired value and item count, or null if the input is not
 * a truncated array or cannot be repaired.
 */
export function tryRepairTruncated(
  raw: string,
): { value: unknown; itemCount: number } | null {
  const trimmed = raw.trimEnd();
  if (!trimmed.startsWith("[") || trimmed.endsWith("]")) return null;

  for (const sep of ["\n},", "},"]) {
    const pos = trimmed.lastIndexOf(sep);
    if (pos === -1) continue;
    const cut = sep === "\n}," ? pos + 2 : pos + 1;
    const repaired = trimmed.slice(0, cut) + "\n]";
    try {
      const value = JSON.parse(repaired);
      if (!Array.isArray(value)) return null;
      return { value, itemCount: value.length };
    } catch {
      /* try next separator */
    }
  }
  return null;
}
