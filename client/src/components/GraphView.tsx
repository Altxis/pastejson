import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { buildGraph, NODE_WIDTH } from '../utils/buildGraph'
import type { GraphNode, GraphEdge } from '../utils/buildGraph'
import './GraphView.css'

interface Props {
  value: unknown
}

// ─── value formatting ────────────────────────────────────────────────────────

function valueClass(v: unknown): string {
  if (v === null) return 'null'
  return typeof v  // 'string' | 'number' | 'boolean'
}

function formatValue(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') {
    const s = v.length > 28 ? v.slice(0, 26) + '…' : v
    return `"${s}"`
  }
  return String(v)
}

// ─── sub-components ───────────────────────────────────────────────────────────

function NodeCard({ node }: { node: GraphNode }) {
  const badge = node.type === 'array' ? `[ ${node.primitiveRows.length + node.childEdges.length} ]` : `{ }`
  return (
    <div
      className={`graph-node graph-node--${node.type}`}
      style={{ left: node.x, top: node.y, width: NODE_WIDTH }}
    >
      <div className="graph-node__header">
        <span className="graph-node__key">{node.keyName}</span>
        <span className="graph-node__badge">{badge}</span>
      </div>
      {node.primitiveRows.map(({ key, value }, i) => (
        <div key={i} className="graph-node__row">
          <span className="graph-node__row-key">{key}</span>
          <span className={`graph-node__row-val tok-${valueClass(value)}`}>
            {formatValue(value)}
          </span>
        </div>
      ))}
      {node.extraRows > 0 && (
        <div className="graph-node__more">+{node.extraRows} more</div>
      )}
    </div>
  )
}

function EdgePath({ edge, nodesMap }: { edge: GraphEdge; nodesMap: Map<string, GraphNode> }) {
  const from = nodesMap.get(edge.fromId)
  const to   = nodesMap.get(edge.toId)
  if (!from || !to) return null

  const x1 = from.x + NODE_WIDTH
  const y1 = from.y + from.height / 2
  const x2 = to.x
  const y2 = to.y + to.height / 2
  const cx = (x1 + x2) / 2

  return (
    <path
      d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
      className="graph-edge"
    />
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function GraphView({ value }: Props) {
  const graphData = useMemo(() => buildGraph(value), [value])
  const nodesMap  = useMemo(
    () => new Map(graphData.nodes.map(n => [n.id, n])),
    [graphData],
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const [pan, setPan]     = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const dragging = useRef(false)
  const origin   = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  // Auto-fit on first render / when data changes
  const fitToView = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { clientWidth, clientHeight } = el
    const s = Math.min(
      1,
      (clientWidth  - 80) / graphData.canvasWidth,
      (clientHeight - 80) / graphData.canvasHeight,
    )
    setScale(s)
    setPan({
      x: (clientWidth  - graphData.canvasWidth  * s) / 2,
      y: (clientHeight - graphData.canvasHeight * s) / 2,
    })
  }, [graphData])

  useEffect(() => { fitToView() }, [fitToView])

  // ── wheel zoom toward cursor ──────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      setScale(s => {
        const ns = Math.min(3, Math.max(0.1, s * factor))
        setPan(p => ({
          x: mx - (mx - p.x) * (ns / s),
          y: my - (my - p.y) * (ns / s),
        }))
        return ns
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── drag to pan ───────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.graph-node')) return
    dragging.current = true
    origin.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return
    const { mx, my, px, py } = origin.current
    setPan({ x: px + e.clientX - mx, y: py + e.clientY - my })
  }
  function onMouseUp() { dragging.current = false }

  const gridOx = ((pan.x % 24) + 24) % 24
  const gridOy = ((pan.y % 24) + 24) % 24

  return (
    <div
      ref={containerRef}
      className="graph-view"
      style={{ backgroundPosition: `${gridOx}px ${gridOy}px` }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* toolbar */}
      <div className="graph-toolbar">
        {graphData.truncated && (
          <span className="graph-toolbar__warn">
            Large JSON — showing first 80 nodes
          </span>
        )}
        <button className="graph-toolbar__btn" onClick={fitToView} type="button">
          Fit
        </button>
        <button className="graph-toolbar__btn" onClick={() => setScale(s => Math.min(3, s * 1.25))} type="button">+</button>
        <button className="graph-toolbar__btn" onClick={() => setScale(s => Math.max(0.1, s / 1.25))} type="button">−</button>
      </div>

      {/* canvas */}
      <div
        className="graph-canvas"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
      >
        {/* edges (SVG layer behind nodes) */}
        <svg
          className="graph-edges"
          style={{ width: graphData.canvasWidth, height: graphData.canvasHeight }}
        >
          {graphData.edges.map((edge, i) => (
            <EdgePath key={i} edge={edge} nodesMap={nodesMap} />
          ))}
        </svg>

        {/* nodes */}
        {graphData.nodes.map(node => (
          <NodeCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  )
}
