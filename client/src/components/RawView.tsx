import { tokenize } from "../utils/tokenize";
import CopyButton from "./CopyButton";
import "./RawView.css";

const RENDER_LIMIT = 500_000; // chars — ~500 KB of formatted JSON

interface Props {
  raw: string;
}

export default function RawView({ raw }: Props) {
  const truncated = raw.length > RENDER_LIMIT;
  const visible = truncated ? raw.slice(0, RENDER_LIMIT) : raw;
  const tokens = tokenize(visible);

  return (
    <div className="raw-view">
      <div className="raw-view__toolbar">
        <span className="raw-view__label">
          {raw.length.toLocaleString()} chars
          {truncated && " — rendered first 500 KB"}
        </span>
        <CopyButton text={raw} title="Copy JSON" />
      </div>
      <pre className="raw-view__pre">
        {tokens.map((tok, i) =>
          tok.type === "whitespace" ? (
            tok.text
          ) : (
            <span key={i} className={`tok tok-${tok.type}`}>
              {tok.text}
            </span>
          ),
        )}
        {truncated && (
          <span className="raw-view__truncated">
            {"\n\n"}… {(raw.length - RENDER_LIMIT).toLocaleString()} more chars
            (copy to see full output)
          </span>
        )}
      </pre>
    </div>
  );
}
