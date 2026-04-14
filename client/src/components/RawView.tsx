import { tokenize } from "../utils/tokenize";
import CopyButton from "./CopyButton";
import "./RawView.css";

interface Props {
  raw: string;
}

export default function RawView({ raw }: Props) {
  const tokens = tokenize(raw);

  return (
    <div className="raw-view">
      <div className="raw-view__toolbar">
        <span className="raw-view__label">
          {raw.length.toLocaleString()} chars
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
      </pre>
    </div>
  );
}
