import { useState } from 'react'

interface Props {
  text: string
  title?: string
}

export default function CopyButton({ text, title = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      title={title}
      onClick={handleClick}
      style={{
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: '3px 8px',
        fontSize: '11px',
        fontFamily: 'var(--mono)',
        color: copied ? 'var(--accent)' : 'var(--text)',
        borderColor: copied ? 'var(--accent-border)' : 'var(--border)',
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s',
        flexShrink: 0,
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
