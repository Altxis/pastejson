import { useState, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import './JsonInput.css'

interface Props {
  onParse: (raw: string) => void
}

export default function JsonInput({ onParse }: Props) {
  const [text, setText] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    onParse(e.target.value)
  }

  function loadFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = (e.target?.result ?? '') as string
      setText(content)
      onParse(content)
    }
    reader.readAsText(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
  }

  return (
    <div
      className="json-input"
      data-drag-active={dragActive}
      onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragEnter={(e) => { e.preventDefault(); setDragActive(true) }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <textarea
        className="json-input__textarea"
        value={text}
        onChange={handleChange}
        placeholder={'Paste JSON here…\n\n{\n  "name": "Alice",\n  "age": 30\n}'}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
      <div className="json-input__toolbar">
        <span className="json-input__hint">or drop a .json file anywhere above</span>
        <input
          type="file"
          accept=".json,application/json,text/plain"
          ref={fileRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
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
  )
}
