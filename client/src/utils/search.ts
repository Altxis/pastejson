export interface SearchIndex {
  query: string;
  matchedPaths: ReadonlySet<string>;  // nodes whose key or value directly matches
  ancestorPaths: ReadonlySet<string>; // nodes that have a matching descendant
  matchCount: number;
}

/**
 * Walk the whole JSON tree and build two sets:
 *  - matchedPaths:  every path where the key name OR leaf value contains `query`
 *  - ancestorPaths: every path that has at least one matched descendant
 *                   (used to force-expand those tree nodes)
 */
export function buildSearchIndex(value: unknown, query: string): SearchIndex {
  const matched = new Set<string>();
  const ancestors = new Set<string>();
  if (query.trim()) {
    walk(value, query.toLowerCase(), "", matched, ancestors);
  }
  return { query, matchedPaths: matched, ancestorPaths: ancestors, matchCount: matched.size };
}

function walk(
  value: unknown,
  q: string,
  path: string,
  matched: Set<string>,
  ancestors: Set<string>,
): boolean {
  // Leaf — check the stringified value
  if (value === null || typeof value !== "object") {
    const str = value === null ? "null" : String(value);
    if (str.toLowerCase().includes(q)) {
      matched.add(path);
      return true;
    }
    return false;
  }

  const isArr = Array.isArray(value);
  const entries: [string, unknown][] = isArr
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>);

  let anyChildMatched = false;

  for (const [key, val] of entries) {
    const childPath = path ? `${path}.${key}` : key;
    let childOrDescendantMatched = false;

    // Key-name match (object keys only, not array indices)
    if (!isArr && key.toLowerCase().includes(q)) {
      matched.add(childPath);
      childOrDescendantMatched = true;
    }

    if (walk(val, q, childPath, matched, ancestors)) {
      childOrDescendantMatched = true;
    }

    if (childOrDescendantMatched) {
      anyChildMatched = true;
      ancestors.add(path); // mark *this* node as an ancestor of a match
    }
  }

  return anyChildMatched;
}
