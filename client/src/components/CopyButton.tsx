import { useState } from "react";
import "./CopyButton.css";

interface Props {
  text: string;
  title?: string;
}

export default function CopyButton({ text, title = "Copy" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      title={title}
      onClick={handleClick}
      className={`copy-btn${copied ? " copy-btn--copied" : ""}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
