import { useState } from "react";
import "./CopyButton.css";

interface Props {
  text: string;
  title?: string;
  compact?: boolean; // icon-only, for inline use in tree rows
}

export default function CopyButton({ text, title = "Copy", compact = false }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation(); // don't toggle tree collapse when clicking copy
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (compact) {
    return (
      <button
        type="button"
        title={copied ? "Copied!" : title}  /* drives the CSS ::after tooltip */
        onClick={handleClick}
        className={`copy-btn copy-btn--compact${copied ? " copy-btn--copied" : ""}`}
        aria-label={title}
      >
        {copied ? (
          // checkmark
          <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          // clipboard
          <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="3.5" y="2" width="6" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M3.5 4H2.5A.5.5 0 0 0 2 4.5v6a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5V10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>
    );
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
