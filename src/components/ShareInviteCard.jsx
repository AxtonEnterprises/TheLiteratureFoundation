import { useMemo, useState } from "react";
import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
import { makeQrMatrix } from "../utils/qrCode.js";

function QrCode({ value, size = 184, label = "QR code" }) {
  const matrix = useMemo(() => {
    if (!value) return [];
    try {
      return makeQrMatrix(value);
    } catch (error) {
      console.error("Could not generate QR code:", error);
      return [];
    }
  }, [value]);

  if (!matrix.length) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--line)",
          borderRadius: 12,
          background: "#fff"
        }}
      >
        <span className="muted">QR unavailable</span>
      </div>
    );
  }

  const quiet = 4;
  const count = matrix.length;
  const viewSize = count + quiet * 2;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      width={size}
      height={size}
      style={{
        display: "block",
        maxWidth: "100%",
        height: "auto",
        background: "#fff",
        borderRadius: 12,
        border: "1px solid var(--line)"
      }}
      shapeRendering="crispEdges"
    >
      <rect width={viewSize} height={viewSize} fill="#fff" />
      {matrix.flatMap((row, rowIndex) =>
        row.map((dark, colIndex) =>
          dark ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex + quiet}
              y={rowIndex + quiet}
              width="1"
              height="1"
              fill="#111"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export default function ShareInviteCard({
  title,
  description,
  url,
  shareText,
  onRegenerate,
  regenerateLabel = "New link",
  loading = false
}) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function copyLink() {
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function shareLink() {
    if (!url) return;

    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      setSharing(true);
      await navigator.share({
        title: title || "Lit Chain",
        text: shareText || description || "Join me on Lit Chain.",
        url
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Share failed:", error);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <section
      className="panel"
      style={{
        padding: "1rem",
        display: "grid",
        gap: "1rem"
      }}
    >
      <div>
        <p className="eyebrow">Share</p>
        <h3 style={{ marginBottom: "0.35rem" }}>{title}</h3>
        {description && (
          <p className="muted" style={{ margin: 0 }}>
            {description}
          </p>
        )}
      </div>

      {loading ? (
        <p className="muted">Preparing share link...</p>
      ) : url ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(150px, 184px) minmax(0, 1fr)",
            gap: "1rem",
            alignItems: "center"
          }}
        >
          <QrCode value={url} label={`${title} QR code`} />

          <div style={{ minWidth: 0 }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              Share link
              <input
                value={url}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>

            <div
              className="button-row"
              style={{
                marginTop: "0.75rem",
                gap: "0.55rem",
                flexWrap: "wrap"
              }}
            >
              <button
                type="button"
                className="button secondary"
                onClick={copyLink}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy Link"}
              </button>

              <button
                type="button"
                className="button primary"
                onClick={shareLink}
                disabled={sharing}
              >
                <Share2 size={16} />
                {sharing ? "Sharing..." : "Share"}
              </button>

              {onRegenerate && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={onRegenerate}
                >
                  <RefreshCw size={16} />
                  {regenerateLabel}
                </button>
              )}
            </div>

            {onRegenerate && (
              <small className="muted" style={{ display: "block", marginTop: "0.65rem" }}>
                Creating a new link immediately revokes the old QR code and link.
              </small>
            )}
          </div>
        </div>
      ) : (
        <p className="muted">A share link could not be created.</p>
      )}
    </section>
  );
}
