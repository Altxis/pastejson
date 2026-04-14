self.onmessage = (e: MessageEvent<string>) => {
  try {
    const value = JSON.parse(e.data)
    const raw = JSON.stringify(value, null, 2)
    self.postMessage({ ok: true, value, raw })
  } catch (err) {
    self.postMessage({ ok: false, error: (err as Error).message })
  }
}
