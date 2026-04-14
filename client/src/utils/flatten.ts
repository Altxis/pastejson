export type FlatEntry = [path: string, value: string | number | boolean | null];

export function flatten(
  node: unknown,
  prefix = "",
  out: FlatEntry[] = [],
): FlatEntry[] {
  if (node === null || typeof node !== "object") {
    out.push([prefix || "(root)", node as FlatEntry[1]]);
    return out;
  }
  const entries: [string, unknown][] = Array.isArray(node)
    ? (node as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(node as Record<string, unknown>);
  for (const [key, val] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    flatten(val, path, out);
  }
  return out;
}
