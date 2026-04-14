export const NODE_WIDTH = 224
export const NODE_HEADER_H = 36
export const ROW_H = 22
export const NODE_FOOTER_PAD = 8
export const COL_GAP = 88
export const ROW_GAP = 20
export const MAX_INLINE_ROWS = 8
export const MAX_NODES = 80

export interface GraphNode {
  id: string
  keyName: string           // key that points to this node, or "root"
  type: 'object' | 'array'
  primitiveRows: { key: string; value: unknown }[]
  childEdges: { key: string; childId: string }[]
  extraRows: number         // rows hidden beyond MAX_INLINE_ROWS
  // layout (filled by layoutTree)
  x: number
  y: number
  height: number
}

export interface GraphEdge {
  fromId: string
  toId: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  canvasWidth: number
  canvasHeight: number
  truncated: boolean        // true if some nodes were skipped
}

function nodeHeight(rows: number): number {
  const capped = Math.min(rows, MAX_INLINE_ROWS)
  return NODE_HEADER_H + capped * ROW_H + NODE_FOOTER_PAD
}

function buildNode(
  value: unknown,
  keyName: string,
  id: string,
  nodesMap: Map<string, GraphNode>,
  edges: GraphEdge[],
  counter: { n: number },
): GraphNode {
  counter.n++
  const isArray = Array.isArray(value)
  const entries: [string, unknown][] = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v])
    : Object.entries(value as Record<string, unknown>)

  const primitiveRows: { key: string; value: unknown }[] = []
  const childEdges: { key: string; childId: string }[] = []

  for (const [k, v] of entries) {
    if (counter.n > MAX_NODES) break
    if (v !== null && typeof v === 'object') {
      const childId = `${id}.${k}`
      buildNode(v, isArray ? `[${k}]` : k, childId, nodesMap, edges, counter)
      childEdges.push({ key: k, childId })
      edges.push({ fromId: id, toId: childId })
    } else {
      primitiveRows.push({ key: k, value: v })
    }
  }

  const rows = primitiveRows.length
  const node: GraphNode = {
    id,
    keyName,
    type: isArray ? 'array' : 'object',
    primitiveRows: primitiveRows.slice(0, MAX_INLINE_ROWS),
    childEdges,
    extraRows: Math.max(0, rows - MAX_INLINE_ROWS),
    x: 0,
    y: 0,
    height: nodeHeight(rows),
  }
  nodesMap.set(id, node)
  return node
}

/** Returns the total vertical span consumed (px). */
function layoutNode(
  node: GraphNode,
  nodesMap: Map<string, GraphNode>,
  depth: number,
  startY: number,
): number {
  node.x = 40 + depth * (NODE_WIDTH + COL_GAP)

  if (node.childEdges.length === 0) {
    node.y = startY
    return node.height + ROW_GAP
  }

  let curY = startY
  const childCenters: number[] = []

  for (const { childId } of node.childEdges) {
    const child = nodesMap.get(childId)!
    const span = layoutNode(child, nodesMap, depth + 1, curY)
    childCenters.push(child.y + child.height / 2)
    curY += span
  }

  const bandTop    = childCenters[0]
  const bandBottom = childCenters[childCenters.length - 1]
  const centerY    = (bandTop + bandBottom) / 2 - node.height / 2

  // Never go above startY (avoids overlap with previous siblings)
  node.y = Math.max(startY, centerY)

  return Math.max(curY - startY, node.height + ROW_GAP)
}

export function buildGraph(value: unknown): GraphData {
  // Wrap bare primitives
  if (value === null || typeof value !== 'object') {
    const h = nodeHeight(1)
    const node: GraphNode = {
      id: 'root', keyName: 'root', type: 'object',
      primitiveRows: [{ key: '(value)', value }],
      childEdges: [], extraRows: 0,
      x: 40, y: 40, height: h,
    }
    return {
      nodes: [node], edges: [],
      canvasWidth: 40 + NODE_WIDTH + 40,
      canvasHeight: 40 + h + 40,
      truncated: false,
    }
  }

  const counter = { n: 0 }
  const nodesMap = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  const root = buildNode(value, 'root', 'root', nodesMap, edges, counter)
  layoutNode(root, nodesMap, 0, 40)

  // Shift upward if any node went above y=40
  const nodes = Array.from(nodesMap.values())
  const minY = Math.min(...nodes.map(n => n.y))
  if (minY < 40) {
    const shift = 40 - minY
    nodes.forEach(n => { n.y += shift })
  }

  const maxX = Math.max(...nodes.map(n => n.x + NODE_WIDTH))
  const maxY = Math.max(...nodes.map(n => n.y + n.height))

  return {
    nodes,
    edges,
    canvasWidth: maxX + 40,
    canvasHeight: maxY + 40,
    truncated: counter.n > MAX_NODES,
  }
}
