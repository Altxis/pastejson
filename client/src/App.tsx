import { useState } from 'react'
import JsonInput from './components/JsonInput'
import ViewTabs from './components/ViewTabs'
import TreeView from './components/TreeView'
import TableView from './components/TableView'
import RawView from './components/RawView'
import GraphView from './components/GraphView'
import ErrorBanner from './components/ErrorBanner'
import './App.css'

type View = 'tree' | 'table' | 'raw' | 'graph'

type ParseState =
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ok'; value: unknown; raw: string }

export default function App() {
  const [view, setView] = useState<View>('tree')
  const [parseState, setParseState] = useState<ParseState>({ status: 'empty' })

  function handleParse(raw: string) {
    if (!raw.trim()) {
      setParseState({ status: 'empty' })
      return
    }
    try {
      const value = JSON.parse(raw)
      setParseState({ status: 'ok', value, raw: JSON.stringify(value, null, 2) })
    } catch (e) {
      setParseState({ status: 'error', message: (e as Error).message })
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>paste<span className="accent">json</span></h1>
        <p className="app-tagline">Paste or drop a .json file — see something beautiful.</p>
      </header>

      <JsonInput onParse={handleParse} />

      {parseState.status === 'error' && (
        <ErrorBanner message={parseState.message} />
      )}

      {parseState.status === 'ok' && (
        <div className="viewer">
          <ViewTabs active={view} onChange={setView} />
          <div className="view-content" key={view}>
            {view === 'tree'  && <TreeView value={parseState.value} />}
            {view === 'table' && <TableView value={parseState.value} />}
            {view === 'raw'   && <RawView raw={parseState.raw} />}
            {view === 'graph' && <GraphView value={parseState.value} />}
          </div>
        </div>
      )}

      {parseState.status === 'empty' && (
        <div className="app-empty">
          <p>Supports objects, arrays, strings, numbers, booleans and null.</p>
        </div>
      )}
    </div>
  )
}
