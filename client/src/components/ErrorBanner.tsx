interface Props {
  message: string
}

export default function ErrorBanner({ message }: Props) {
  return (
    <div
      role="alert"
      style={{
        marginTop: '16px',
        padding: '12px 16px',
        background: 'var(--accent-bg)',
        border: '1px solid var(--accent-border)',
        borderRadius: '8px',
        fontFamily: 'var(--mono)',
        fontSize: '13px',
        color: 'var(--accent)',
        lineHeight: 1.6,
      }}
    >
      <strong>Invalid JSON</strong>
      <br />
      {message}
    </div>
  )
}
