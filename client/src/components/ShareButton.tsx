import { useState } from "react";
import CopyButton from "./CopyButton";
import "./ShareButton.css";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface Props {
  value: unknown;
}

type ShareState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; url: string; expiresAt: string }
  | { status: "error"; message: string };

export default function ShareButton({ value }: Props) {
  const [state, setState] = useState<ShareState>({ status: "idle" });

  async function handleShare() {
    if (state.status === "loading") return;
    setState({ status: "loading" });

    try {
      const raw = JSON.stringify(value, null, 2);
      const res = await fetch(`${API_BASE}/api/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string }).message ?? `Server error ${res.status}`,
        );
      }

      const { id, expiresAt } = (await res.json()) as {
        id: string;
        expiresAt: string;
      };

      const url = `${window.location.origin}/s/${id}`;
      setState({ status: "done", url, expiresAt });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  }

  function handleDismiss() {
    setState({ status: "idle" });
  }

  const expiryLabel =
    state.status === "done"
      ? new Date(state.expiresAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

  return (
    <div className="share-button">
      <button
        className="share-button__trigger"
        onClick={handleShare}
        disabled={state.status === "loading"}
        type="button"
      >
        {state.status === "loading" ? (
          <span className="share-button__spinner" aria-label="Sharing…" />
        ) : (
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="12" cy="3" r="1.75" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="13" r="1.75" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="4" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.3 4.2 5.7 6.9M10.3 11.8 5.7 9.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        Share
      </button>

      {state.status === "done" && (
        <div className="share-popup" role="dialog" aria-label="Share link">
          <div className="share-popup__row">
            <input
              className="share-popup__url"
              type="text"
              readOnly
              value={state.url}
              onFocus={(e) => e.target.select()}
            />
            <CopyButton text={state.url} title="Copy link" />
          </div>
          <div className="share-popup__meta">
            Expires {expiryLabel}
            <button
              className="share-popup__close"
              onClick={handleDismiss}
              type="button"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {state.status === "error" && (
        <div className="share-popup share-popup--error" role="alert">
          <span>{state.message}</span>
          <button
            className="share-popup__close"
            onClick={handleDismiss}
            type="button"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
